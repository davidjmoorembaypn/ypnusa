import { escapeHtml, sendEmail } from "@/lib/email";
import { issueLoginToken } from "@/lib/email-login";
import { isRecord, jsonError, jsonOk, logApiError, parseJsonBody } from "@/lib/http";
import { getSiteOrigin } from "@/lib/request-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { email, next? } — emails a one-time sign-in link. Works for new and existing
 * emails alike (a first sign-in creates a free account), and answers the same way either
 * way so the form can't be used to find out who has an account.
 */
export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code);
    const body = isRecord(parsed.data) ? parsed.data : {};

    const issued = issueLoginToken(body.email, body.next);
    if (!issued.ok) {
      if (issued.code === "INVALID_EMAIL") return jsonError("Enter a valid email address.", 400, issued.code);
      return jsonError("Too many sign-in links for this email. Try again in an hour.", 429, issued.code);
    }

    const origin = await getSiteOrigin();
    const link = `${origin}/login/verify?token=${encodeURIComponent(issued.token)}`;
    const sent = await sendEmail({
      to: issued.email,
      subject: "Your YPN USA sign-in link",
      html: `<p>Here is your sign-in link for YPN USA. It works once and expires in 15 minutes.</p>
<p><a href="${escapeHtml(link)}">Sign in to YPN USA</a></p>
<p>If you didn't ask for this, you can ignore this email.</p>`,
    });

    if (!sent.sent) {
      if (process.env.NODE_ENV !== "production") {
        // Local development without an email provider: hand the link back so it can be tested.
        return jsonOk({ sent: false, devLink: link });
      }
      logApiError("/api/auth/email-link", new Error(sent.reason ?? "Email not sent."));
      return jsonError("We couldn't send the sign-in email right now. Please try again shortly.", 503, "EMAIL_UNAVAILABLE");
    }
    return jsonOk({ sent: true });
  } catch (error) {
    logApiError("/api/auth/email-link", error);
    return jsonError("Sign-in link could not be created.", 500, "EMAIL_LINK_FAILED");
  }
}
