import { getSession } from "@/lib/auth";
import { draftOnboardingRecord } from "@/lib/agent-onboarding";
import { setOfficerPhoto } from "@/lib/db";
import { jsonError, jsonOk, logApiError } from "@/lib/http";
import { deleteOfficerPhoto, MAX_PHOTO_BYTES, officerPhotoUrl, saveOfficerPhoto } from "@/lib/officer-profile";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Multipart overhead allowance on top of the 2 MB photo limit. */
const MAX_REQUEST_BYTES = MAX_PHOTO_BYTES + 64 * 1024;

/**
 * Uploads the signed-in loan officer's headshot (multipart field "photo"). The type is read
 * from the file's own bytes (JPEG, PNG or WebP); the declared type and name are ignored.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Authentication required.", 401, "UNAUTHORIZED");

  const limited = rateLimit(`officer-photo:${session.sub}`, 10, 60_000);
  if (!limited.ok) {
    return jsonError("Too many uploads — please wait a minute and try again.", 429, "RATE_LIMITED", {
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_REQUEST_BYTES) {
    return jsonError("Photos must be 2 MB or smaller.", 413, "FILE_TOO_LARGE");
  }

  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError("Send the photo as a multipart form upload.", 400, "INVALID_BODY");
    }
    const file = form.get("photo");
    if (!file || typeof file === "string") return jsonError("Choose a photo to upload.", 400, "MISSING_FILE");
    if (file.size > MAX_PHOTO_BYTES) return jsonError("Photos must be 2 MB or smaller.", 413, "FILE_TOO_LARGE");

    const result = saveOfficerPhoto(session.sub, new Uint8Array(await file.arrayBuffer()));
    if (!result.ok) return jsonError(result.error, result.status, result.code);

    setOfficerPhoto(session.sub, result.photo, () => draftOnboardingRecord(session.sub, session.email));
    return jsonOk({ photo: result.photo, photoUrl: officerPhotoUrl(session.sub, result.photo) });
  } catch (error) {
    logApiError("/api/onboarding/photo", error);
    return jsonError("Unable to save your photo. Please try again.", 500, "SAVE_FAILED");
  }
}

/** Removes the signed-in loan officer's headshot. */
export async function DELETE() {
  const session = await getSession();
  if (!session) return jsonError("Authentication required.", 401, "UNAUTHORIZED");
  try {
    deleteOfficerPhoto(session.sub);
    setOfficerPhoto(session.sub, null, () => draftOnboardingRecord(session.sub, session.email));
    return jsonOk({ photo: null });
  } catch (error) {
    logApiError("/api/onboarding/photo", error);
    return jsonError("Unable to remove your photo. Please try again.", 500, "DELETE_FAILED");
  }
}
