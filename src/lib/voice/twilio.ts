import crypto from "node:crypto";

/**
 * Verifies Twilio's X-Twilio-Signature header for an incoming webhook POST,
 * per https://www.twilio.com/docs/usage/security#validating-requests.
 * Fails closed: a missing auth token, missing signature header, or any
 * mismatch returns false. Callers must reject the request (never fall back
 * to processing it) when this returns false — see `/api/voice/*` routes.
 */
export function validateTwilioSignature(
  fullUrl: string,
  params: Record<string, string>,
  signatureHeader: string | null,
  authToken: string | undefined,
): boolean {
  if (!authToken || !signatureHeader) return false;

  let data = fullUrl;
  for (const key of Object.keys(params).sort()) {
    data += key + params[key];
  }

  const expected = crypto.createHmac("sha1", authToken).update(data, "utf8").digest("base64");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Strips markdown and raw URLs from an assistant reply before it's spoken —
 * a TTS voice reading "bracket see how YPN USA works parenthesis h-t-t-p-s
 * colon slash slash..." aloud is worse than just not saying the link at all.
 */
export function toSpeakableText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(https?:\/\/[^\s)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "our website")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[*_#]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const TWIML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const VOICE = "Polly.Joanna";
const NO_INPUT_MESSAGE = "I didn't catch that. Feel free to call back anytime — goodbye for now.";
const NO_ANSWER_MESSAGE =
  "No one's available to take your call right now. Please try again shortly — goodbye for now.";

/** Keeps a leading "+" (if present) and digits only — Twilio's <Number> wants E.164, not "+1-559-512-0372". */
function normalizePhoneForDial(phone: string): string {
  const trimmed = phone.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}

/**
 * Speaks `text`, then gathers speech and posts the transcript to
 * `actionUrl`. If Gather times out with no speech at all, execution falls
 * through to the trailing <Say>/<Hangup> (Twilio never calls `actionUrl` in
 * that case) — a caller who says nothing gets a graceful goodbye instead of
 * dead air or an infinite loop.
 */
export function gatherSpeechTwiml(text: string, actionUrl: string): string {
  return (
    `${TWIML_HEADER}<Response>` +
    `<Gather input="speech" action="${escapeXml(actionUrl)}" method="POST" speechTimeout="auto" speechModel="phone_call">` +
    `<Say voice="${VOICE}">${escapeXml(toSpeakableText(text))}</Say>` +
    `</Gather>` +
    `<Say voice="${VOICE}">${escapeXml(NO_INPUT_MESSAGE)}</Say>` +
    `</Response>`
  );
}

/** Speaks `text`, then ends the call — used for a graceful, explicit goodbye. */
export function sayAndHangupTwiml(text: string): string {
  return (
    `${TWIML_HEADER}<Response><Say voice="${VOICE}">${escapeXml(toSpeakableText(text))}</Say><Hangup/></Response>`
  );
}

/**
 * Speaks `text` (the assistant's own "connecting you" line), then dials a
 * real person. Twilio only advances past <Dial> to the trailing
 * <Say>/<Hangup> if the call goes unanswered, is busy, or fails — a picked-up
 * call just continues as a normal two-party call and never reaches them.
 */
export function dialTwiml(text: string, phoneNumber: string): string {
  return (
    `${TWIML_HEADER}<Response>` +
    `<Say voice="${VOICE}">${escapeXml(toSpeakableText(text))}</Say>` +
    `<Dial timeout="20">${escapeXml(normalizePhoneForDial(phoneNumber))}</Dial>` +
    `<Say voice="${VOICE}">${escapeXml(NO_ANSWER_MESSAGE)}</Say>` +
    `<Hangup/>` +
    `</Response>`
  );
}

/** A fixed rejection response for requests that don't verify as genuinely from Twilio. */
export const REJECT_TWIML = `${TWIML_HEADER}<Response><Reject/></Response>`;
