import { Resend } from "resend";
import { BUSINESS_EMAIL } from "@/lib/author";
import { logApiError } from "@/lib/http";

/**
 * Replaces WordPress's WP Mail SMTP (docs/AWS_MIGRATION.md item 5): this app
 * had no outbound-email capability at all before this — notifyAssignedOfficer()
 * in src/lib/notifications.ts only wrote an in-app alert record, nothing ever
 * emailed anyone. Resend is the provider (owner's choice, 2026-10-21).
 *
 * Degrades gracefully, matching this codebase's other optional-integration
 * pattern (src/lib/ai/provider.ts): with no RESEND_API_KEY configured, every
 * send is a logged no-op rather than a thrown error, so a route that sends a
 * notification email never fails the user-facing request over a missing key,
 * a bad key, or Resend being down. Required env vars:
 *   - RESEND_API_KEY     the Resend API key (re_...)
 *   - RESEND_FROM_EMAIL  optional, defaults to BUSINESS_EMAIL (support@ypnus.com) —
 *                        only deliverable once that domain is verified in Resend.
 */

let client: Resend | null | undefined;

function getClient(): Resend | null {
  if (client !== undefined) return client;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  client = apiKey ? new Resend(apiKey) : null;
  return client;
}

/** Escapes user-provided text before interpolating it into an HTML email body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SendEmailResult {
  sent: boolean;
  reason?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getClient();
  if (!resend) {
    // Not configured — don't fail the caller, just don't send. Common in dev/test
    // and on any deploy before RESEND_API_KEY is set in /etc/ypnusa/app.env.
    return { sent: false, reason: "RESEND_API_KEY is not configured." };
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() || BUSINESS_EMAIL;

  try {
    const { error } = await resend.emails.send({
      from: `YPN USA <${from}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
    });
    if (error) {
      logApiError("email.send", new Error(error.message));
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    logApiError("email.send", error);
    return { sent: false, reason: error instanceof Error ? error.message : "Unknown error." };
  }
}

/** Notifies the business inbox (BUSINESS_EMAIL) of a new lead/demo request. */
export async function notifyOwnerOfLead(input: {
  kind: "demo_request" | "lo_alert";
  summaryHtml: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const subject =
    input.kind === "demo_request" ? "New demo request — YPN USA" : "New borrower lead assigned";
  return sendEmail({
    to: BUSINESS_EMAIL,
    subject,
    html: input.summaryHtml,
    replyTo: input.replyTo,
  });
}
