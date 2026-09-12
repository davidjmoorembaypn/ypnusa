import { NextResponse } from "next/server";
import { runAssistantTurn } from "@/lib/ai/chat-agent";
import { logApiError } from "@/lib/http";
import { APP_SITE_URL } from "@/lib/site";
import { dialTwiml, gatherSpeechTwiml, REJECT_TWIML, validateTwilioSignature } from "@/lib/voice/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TWIML_HEADERS = { "Content-Type": "text/xml" };
const NO_SPEECH_REPROMPT = "Sorry, I didn't quite catch that — go ahead whenever you're ready.";

/**
 * Twilio posts here after each <Gather> in the loop this route itself
 * keeps going (see gatherSpeechTwiml's action URL). The caller's turn
 * (SpeechResult, Twilio's own speech-to-text) is run through the exact same
 * chat-agent brain the web widget and /assistant preview use — lead
 * qualification, scheduling, territory checks, and all — so phone callers
 * get the same agent, not a separate, thinner one.
 *
 * Session continuity across turns of one call is carried in the action
 * URL's `sid` query param (the real session id chat-agent minted on the
 * first turn) rather than a cookie, which a phone call has none of. See
 * docs/voice-assistant.md for the full call flow and Twilio setup.
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

    const sessionId = incoming.searchParams.get("sid") || undefined;
    const speech = (params.SpeechResult ?? "").trim();

    if (!speech) {
      // Gather captured *something* (enough to reach this action URL at
      // all) but Twilio's own speech-to-text came back empty — re-prompt on
      // the same session rather than treating it as a real (blank) message.
      const actionUrl = sessionId
        ? `${APP_SITE_URL}/api/voice/respond?sid=${encodeURIComponent(sessionId)}`
        : `${APP_SITE_URL}/api/voice/respond`;
      return new NextResponse(gatherSpeechTwiml(NO_SPEECH_REPROMPT, actionUrl), { headers: TWIML_HEADERS });
    }

    const result = await runAssistantTurn({
      mode: "lead_qualification",
      sessionId,
      userMessage: speech,
      funnelSource: "phone_call",
    });

    if (result.handoffRequested && result.handoffPhone) {
      const dialActionUrl = `${APP_SITE_URL}/api/voice/dial-status`;
      return new NextResponse(dialTwiml(result.reply, result.handoffPhone, dialActionUrl), { headers: TWIML_HEADERS });
    }

    const actionUrl = `${APP_SITE_URL}/api/voice/respond?sid=${encodeURIComponent(result.sessionId)}`;
    return new NextResponse(gatherSpeechTwiml(result.reply, actionUrl), { headers: TWIML_HEADERS });
  } catch (error) {
    logApiError("/api/voice/respond", error);
    return new NextResponse(REJECT_TWIML, { status: 500, headers: TWIML_HEADERS });
  }
}
