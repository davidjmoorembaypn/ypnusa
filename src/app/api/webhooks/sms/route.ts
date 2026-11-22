import { NextResponse } from "next/server";
import { logApiError } from "@/lib/http";
import { APP_SITE_URL, MARKETING_SITE_URL } from "@/lib/site";
import { handleInboundSms } from "@/lib/sms-inbound";
import { validateTwilioSignature } from "@/lib/voice/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const XML = { "Content-Type": "text/xml" };
const EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/**
 * Twilio's messaging webhook: every text a borrower sends to our number arrives here. Set this
 * address (https://ypnus.com/api/webhooks/sms) as the phone number's "A message comes in" webhook
 * in the Twilio console. This is what makes a STOP reply actually stop our messages
 * (src/lib/sms-inbound.ts).
 *
 * Only requests signed by Twilio are processed. Anything else is refused.
 */
export async function POST(request: Request) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const form = await request.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") params[key] = value;
    }

    // Twilio signs the address it was given, so accept either of this site's two host names.
    const incoming = new URL(request.url);
    const signature = request.headers.get("x-twilio-signature");
    const signed = [MARKETING_SITE_URL, APP_SITE_URL].some((base) =>
      validateTwilioSignature(`${base}${incoming.pathname}${incoming.search}`, params, signature, authToken),
    );
    if (!signed) return new NextResponse(EMPTY, { status: authToken ? 403 : 503, headers: XML });

    const result = handleInboundSms({ from: params.From ?? "", body: params.Body ?? "", messageSid: params.MessageSid });
    if (result.action === "opted_out" || result.action === "opted_in") {
      // The sender's number is never logged, only what happened.
      console.log(`[sms] ${result.action} for ${result.leads} lead(s)`);
    }
    const body = result.reply ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(result.reply)}</Message></Response>` : EMPTY;
    return new NextResponse(body, { headers: XML });
  } catch (error) {
    logApiError("/api/webhooks/sms", error);
    // A 500 makes Twilio retry, so a STOP is not lost to a passing fault.
    return new NextResponse(EMPTY, { status: 500, headers: XML });
  }
}
