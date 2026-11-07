import { getSession } from "@/lib/auth";
import {
  findOnboardingByShortId,
  photoContentType,
  publicOfficerPageFor,
  readOfficerPhoto,
  shortIdFromSlug,
} from "@/lib/officer-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

/**
 * A loan officer's headshot, addressed by their short id (or full page slug). Public while
 * their /lo/[slug] page is live; otherwise only the officer themselves can load it (for the
 * onboarding preview).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shortId = shortIdFromSlug(id);
  if (!shortId) return notFound();
  const record = findOnboardingByShortId(shortId);
  if (!record?.officerPhoto) return notFound();

  const isPublic = publicOfficerPageFor(record) !== null;
  if (!isPublic) {
    const session = await getSession();
    if (session?.sub !== record.userId) return notFound();
  }

  const bytes = readOfficerPhoto(record.userId, record.officerPhoto);
  if (!bytes) return notFound();
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": photoContentType(record.officerPhoto.ext),
      "Content-Length": String(bytes.length),
      // URLs carry ?v=<upload time>, so a new upload is a new URL. Public copies can be
      // cached briefly; a private preview never is.
      "Cache-Control": isPublic ? "public, max-age=3600, stale-while-revalidate=86400" : "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    },
  });
}
