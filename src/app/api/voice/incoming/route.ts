import { NextResponse } from "next/server";
import { logApiError } from "@/lib/http";
import { APP_SITE_URL } from "@/lib/site";
import { gatherSpeechTwiml, REJECT_TWIML, validateTwilioSignature } from "@/lib/voice/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GREETING =
  "Thanks for calling Y P N U S A. I'm the AI assistant — I can check if your ZIP code territory is available, explain how the platform works, or help schedule time with a loan officer. What can I help with?";

const TWIML_HEADERS = { "Content-Type": "text/xml" };

/**
 * Twilio's Voice webhook for an inbound call — configure this exact URL
 * (https://app.ypnus.com/api/voice/incoming) as the phone number's "A call
 * comes in" webhook in the Twilio console. See docs/voice-assistant.md.
 *
 * This route never calls the AI provider itself — it just plays a static
 * greeting and starts the Gather loop; /api/voice/respond is where the
 * caller's actual speech reaches the same chat-agent brain the web widget
 * uses. Keeping the very first prompt static avoids a model call (and its
 * latency) before the caller has said anything.
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
      // Fails closed whether the cause is a bad signature or TWILIO_AUTH_TOKEN
      // simply not being configured yet — never run the greeting/Gather loop
      // for a request that isn't verified as genuinely from Twilio.
      return new NextResponse(REJECT_TWIML, { status: authToken ? 403 : 503, headers: TWIML_HEADERS });
    }

    const actionUrl = `${APP_SITE_URL}/api/voice/respond`;
    return new NextResponse(gatherSpeechTwiml(GREETING, actionUrl), { headers: TWIML_HEADERS });
  } catch (error) {
    logApiError("/api/voice/incoming", error);
    return new NextResponse(REJECT_TWIML, { status: 500, headers: TWIML_HEADERS });
  }
}
