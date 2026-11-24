import { isRecord, jsonError, jsonOk, logApiError, parseJsonBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { MARKETING_SITE_URL } from "@/lib/site";
import { formatOptInPhone, validateSmsOptIn } from "@/lib/sms-opt-in";
import { readDb } from "@/lib/db";
import { LO_SMS_OPT_IN_SOURCE, recordSmsOptIn, smsOptInState } from "@/lib/sms-opt-in-store";
import { LO_SMS_CONSENT_TEXT, LO_SMS_OPT_IN_PATH, SMS_BRAND } from "@/lib/sms-program";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The loan officer text opt-in form on ypnus.com/sms-opt-in. Public, no sign-in. Saves one
 * entry to the text opt-in ledger with the exact wording shown, and only when the consent box
 * was ticked: the server checks the number and the box again, whatever the browser sent.
 *
 * Saving the opt-in sends no text. Texts to loan officers go out only through the registered
 * YPN USA campaign, and a STOP reply to the YPN USA number records an opt-out here that only a
 * START reply from that phone can undo. The entry is confirmed only once it is on disk.
 */
export async function POST(request: Request) {
  try {
    const limited = enforceRateLimit(request, {
      scope: "sms-opt-in",
      limit: 5,
      message: "Too many requests. Please wait a minute and try again.",
    });
    if (limited) return limited;

    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code);
    if (!isRecord(parsed.data)) return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");

    const result = validateSmsOptIn(parsed.data);
    if (!result.ok) {
      const code = result.errors.consent ? "CONSENT_REQUIRED" : result.errors.phone ? "INVALID_PHONE" : "INVALID_NAME";
      const message = result.errors.consent ?? result.errors.phone ?? result.errors.name ?? "Check the form and try again.";
      return jsonError(message, 400, code);
    }

    const record = recordSmsOptIn({
      phone: result.value.phone,
      granted: true,
      source: LO_SMS_OPT_IN_SOURCE,
      ...(result.value.name ? { name: result.value.name } : {}),
      textShown: LO_SMS_CONSENT_TEXT,
      pageUrl: `${MARKETING_SITE_URL}${LO_SMS_OPT_IN_PATH}`,
    });

    // A STOP reply can only be undone from the phone itself (anyone can type a number here).
    if (smsOptInState(readDb(), record.phone).stoppedByText) {
      return jsonOk({
        id: record.id,
        message: `Saved. This number opted out of ${SMS_BRAND} texts by replying STOP, so texts stay off until you reply START from that phone.`,
      });
    }

    return jsonOk({
      id: record.id,
      message: `You're opted in to text messages from ${SMS_BRAND} at ${formatOptInPhone(record.phone)}. Reply STOP to any message to opt out, or HELP for support.`,
    });
  } catch (error) {
    logApiError("/api/sms-opt-in", error);
    return jsonError("Your opt-in could not be saved right now. Please try again in a few minutes.", 503, "SMS_OPT_IN_FAILED");
  }
}
