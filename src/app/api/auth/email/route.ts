import { NextResponse } from "next/server";
import { issueLoginChallenge, LOGIN_BROWSER_COOKIE, revokeLoginChallenge } from "@/lib/native-auth";
import { nativeAuthOrigin, nativePlatformEnabled } from "@/lib/native-platform";
import { sendEmail, escapeHtml } from "@/lib/email";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isRecord, jsonError, jsonOk, parseJsonBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = nativeAuthOrigin();
  if (!nativePlatformEnabled() || !origin || !process.env.RESEND_API_KEY || !process.env.SESSION_SECRET) return jsonError("Email sign-in is not available yet. Please contact support@ypnus.com.", 503);
  if (request.headers.get("origin") !== origin) return jsonError("Invalid request origin.", 403);
  const limited = enforceRateLimit(request, { scope: "email-login", limit: 5, windowMs: 15 * 60_000, message: "Please wait before requesting another email." });
  if (limited) return limited;
  const body = await parseJsonBody(request);
  if (!body.ok || !isRecord(body.data) || typeof body.data.email !== "string") return jsonError("Enter a valid email address.", 400);
  let challenge;
  try {
    challenge = issueLoginChallenge(body.data.email, body.data.next);
  } catch {
    return jsonError("Unable to request a link. Check your email address or try again later.", 400);
  }
  // Fragment tokens are not sent in HTTP URLs, proxy access logs or Referer headers.
  const link = `${origin}/login/verify#token=${challenge.token}`;
  const sent = await sendEmail({ to: challenge.email, subject: "Your YPN USA sign-in link", html: `<p>Use this link in the same browser where you requested it. It expires in 15 minutes.</p><p><a href="${escapeHtml(link)}">Continue to YPN USA</a></p><p>If you did not request this email, you can ignore it.</p>` });
  if (!sent.sent) {
    revokeLoginChallenge(challenge.token);
    return jsonError("We could not send your sign-in email. Please try again later.", 503);
  }
  const response: NextResponse = jsonOk({ message: "Check your email. Open the link in this browser to continue." }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(LOGIN_BROWSER_COOKIE, challenge.browser, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/email", maxAge: 900 });
  return response;
}
