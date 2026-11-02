import { cookies } from "next/headers";
import { createSession } from "@/lib/auth";
import { consumeLoginChallenge, LOGIN_BROWSER_COOKIE } from "@/lib/native-auth";
import { nativeAuthOrigin, nativePlatformEnabled } from "@/lib/native-platform";
import { isRecord, jsonError, jsonOk, parseJsonBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!nativePlatformEnabled() || !nativeAuthOrigin() || !process.env.SESSION_SECRET) return jsonError("Email sign-in is unavailable.", 503);
  if (request.headers.get("origin") !== nativeAuthOrigin()) return jsonError("Invalid request origin.", 403);
  const limited = enforceRateLimit(request, { scope: "verify-email-login", limit: 10, message: "Please wait and try again." });
  if (limited) return limited;
  const body = await parseJsonBody(request);
  if (!body.ok || !isRecord(body.data) || typeof body.data.token !== "string") return jsonError("Invalid sign-in link.", 400);
  try {
    const cookieStore = await cookies();
    const claim = consumeLoginChallenge(body.data.token, cookieStore.get(LOGIN_BROWSER_COOKIE)?.value ?? "");
    if (!claim) return jsonError("This link expired, was already used, or belongs to another browser. Request a new link.", 401);
    await createSession({ sub: claim.sub, email: claim.email, role: "mlo" });
    const response = jsonOk({ next: claim.next }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(LOGIN_BROWSER_COOKIE, "", { path: "/api/auth/email", maxAge: 0 });
    return response;
  } catch {
    return jsonError("Sign-in could not be completed. Please request a new link.", 503);
  }
}
