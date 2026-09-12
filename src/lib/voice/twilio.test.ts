import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import {
  dialStatusTwiml,
  dialTwiml,
  gatherSpeechTwiml,
  REJECT_TWIML,
  sayAndHangupTwiml,
  toSpeakableText,
  validateTwilioSignature,
} from "./twilio";

/**
 * Independent re-implementation of Twilio's documented signing algorithm
 * (https://www.twilio.com/docs/usage/security#validating-requests): HMAC-SHA1
 * over the full URL with each POST param's key+value appended in sorted
 * order, base64-encoded. Kept deliberately separate from twilio.ts's own
 * implementation so these tests catch a real algorithm bug rather than just
 * echoing whatever the source file happens to do.
 */
function referenceTwilioSignature(url: string, params: Record<string, string>, authToken: string): string {
  let data = url;
  for (const key of Object.keys(params).sort()) {
    data += key + params[key];
  }
  return crypto.createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

describe("validateTwilioSignature", () => {
  const url = "https://app.ypnus.com/api/voice/incoming";
  const params = { CallSid: "CA1234567890abcdef", From: "+15551234567", To: "+15557654321" };
  const authToken = "test_auth_token_12345";

  it("accepts a correctly computed signature", () => {
    const signature = referenceTwilioSignature(url, params, authToken);
    assert.equal(validateTwilioSignature(url, params, signature, authToken), true);
  });

  it("rejects a tampered signature", () => {
    const signature = referenceTwilioSignature(url, params, authToken);
    const tampered = signature.slice(0, -1) + (signature.at(-1) === "A" ? "B" : "A");
    assert.equal(validateTwilioSignature(url, params, tampered, authToken), false);
  });

  it("rejects when params were tampered with after signing", () => {
    const signature = referenceTwilioSignature(url, params, authToken);
    const tamperedParams = { ...params, From: "+19995550000" };
    assert.equal(validateTwilioSignature(url, tamperedParams, signature, authToken), false);
  });

  it("rejects when the URL doesn't match what was signed", () => {
    const signature = referenceTwilioSignature(url, params, authToken);
    assert.equal(validateTwilioSignature(`${url}?sid=other`, params, signature, authToken), false);
  });

  it("fails closed with no auth token configured, even with a well-formed signature", () => {
    const signature = referenceTwilioSignature(url, params, authToken);
    assert.equal(validateTwilioSignature(url, params, signature, undefined), false);
  });

  it("fails closed with no signature header present", () => {
    assert.equal(validateTwilioSignature(url, params, null, authToken), false);
  });
});

describe("toSpeakableText", () => {
  it("replaces markdown links with just their label", () => {
    assert.equal(
      toSpeakableText("See [how it works](https://ypnus.com/features/) for details."),
      "See how it works for details.",
    );
  });

  it("replaces bare URLs with a speakable placeholder", () => {
    assert.equal(toSpeakableText("Visit https://ypnus.com/pricing-plans/ now"), "Visit our website now");
  });

  it("strips markdown bold and list-bullet markers", () => {
    assert.equal(toSpeakableText("**Great news** — here's what's next:\n- Step one\n- Step two"), "Great news — here's what's next: Step one Step two");
  });
});

describe("TwiML builders", () => {
  it("gatherSpeechTwiml embeds the message, escapes XML, and points at actionUrl", () => {
    const xml = gatherSpeechTwiml("Is 90210 & 90211 available?", "https://app.ypnus.com/api/voice/respond?sid=abc");
    assert.match(xml, /<Gather /);
    assert.match(xml, /action="https:\/\/app\.ypnus\.com\/api\/voice\/respond\?sid=abc"/);
    assert.match(xml, /90210 &amp; 90211/);
    assert.doesNotMatch(xml, /90210 & 90211/);
  });

  it("sayAndHangupTwiml ends with Hangup and no Gather", () => {
    const xml = sayAndHangupTwiml("Goodbye!");
    assert.match(xml, /<Hangup\/>/);
    assert.doesNotMatch(xml, /<Gather/);
  });

  it("REJECT_TWIML is a bare Reject response", () => {
    assert.match(REJECT_TWIML, /<Reject\/>/);
  });

  it("dialTwiml says the text, dials a normalized number with an action callback, and has no trailing fallback", () => {
    const xml = dialTwiml("Connecting you now.", "+1-559-512-0372", "https://app.ypnus.com/api/voice/dial-status");
    assert.match(xml, /<Say voice="Polly\.Joanna">Connecting you now\.<\/Say><Dial/);
    assert.match(
      xml,
      /<Dial timeout="20" action="https:\/\/app\.ypnus\.com\/api\/voice\/dial-status">\+15595120372<\/Dial>/,
    );
    // No bare trailing Say/Hangup — Twilio would run it after ANY dial outcome
    // (including a normal completed call) without an action callback.
    assert.doesNotMatch(xml, /<\/Dial><Say/);
  });

  it("dialTwiml strips non-digit characters but keeps a leading +", () => {
    const xml = dialTwiml("Hold on.", "(559) 512-0372", "https://app.ypnus.com/api/voice/dial-status");
    assert.match(xml, /<Dial timeout="20" action="[^"]+">5595120372<\/Dial>/);
  });

  it("dialTwiml escapes XML in the spoken text and the action URL", () => {
    const xml = dialTwiml("Team A & B", "+15595120372", "https://app.ypnus.com/api/voice/dial-status?x=1&y=2");
    assert.match(xml, /Team A &amp; B/);
    assert.match(xml, /action="https:\/\/app\.ypnus\.com\/api\/voice\/dial-status\?x=1&amp;y=2"/);
  });

  it("dialStatusTwiml hangs up silently for a completed call", () => {
    const xml = dialStatusTwiml("completed");
    assert.match(xml, /<Response><Hangup\/><\/Response>/);
    assert.doesNotMatch(xml, /<Say/);
  });

  it("dialStatusTwiml apologizes and hangs up for busy/no-answer/failed", () => {
    for (const status of ["busy", "no-answer", "failed", "canceled"]) {
      const xml = dialStatusTwiml(status);
      assert.match(xml, /No one&apos;s available/);
      assert.match(xml, /<Hangup\/>/);
    }
  });
});
