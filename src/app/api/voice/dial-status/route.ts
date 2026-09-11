import { NextResponse } from "next/server";
import { logApiError } from "@/lib/http";
import { APP_SITE_URL } from "@/lib/site";
import { dialStatusTwiml, REJECT_TWIML, validateTwilioSignature } from "@/lib/voice/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TWIML_HEADERS = { "Content-Type": "text/xml" };

/**
 * The <Dial action> callback for a human-handoff call (see dialTwiml in
 * src/lib/voice/twilio.ts) — Twilio POSTs here with DialCallStatus once the
 * dial to the MLO's phone ends, instead of falling through to whatever verb
 * follows <Dial> in the original response (which would fire on every
 * outcome, completed calls included).
 */
export async function POST(request: Request) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const formData = await request.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") params[key] = value;
    }

    const incoming = new URL(request.url);
    const fullUrl = `${APP_SITE_URL}${incoming.pathname}${incoming.search}`;
    const signature = request.headers.get("x-twilio-signature");

    if (!validateTwilioSignature(fullUrl, params, signature, authToken)) {
      return new NextResponse(REJECT_TWIML, { status: authToken ? 403 : 503, headers: TWIML_HEADERS });
    }

    return new NextResponse(dialStatusTwiml(params.DialCallStatus ?? ""), { headers: TWIML_HEADERS });
  } catch (error) {
    logApiError("/api/voice/dial-status", error);
    return new NextResponse(REJECT_TWIML, { status: 500, headers: TWIML_HEADERS });
  }
}
