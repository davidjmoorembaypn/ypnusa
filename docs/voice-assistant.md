# Voice assistant (Twilio)

Lets the same AI assistant that powers the web chat widget answer real
phone calls — checking ZIP territory, explaining how the platform works,
and scheduling meetings with a loan officer, all by voice.

## Architecture

```
Caller dials the YPN USA number
  → Twilio POSTs to https://app.ypnus.com/api/voice/incoming
  → static greeting + <Gather input="speech"> (Twilio does the speech-to-text)
  → caller speaks
  → Twilio POSTs the transcript to https://app.ypnus.com/api/voice/respond?sid=<session>
  → runAssistantTurn() — the SAME chat-agent.ts brain the web widget uses,
    mode "lead_qualification" (territory check, lead capture, scheduling,
    explainer-video lookup all available)
  → reply is spoken back (Twilio's own TTS), then <Gather> again
  → loop continues until the caller hangs up or stops responding
```

No new AI logic was written for this — `/api/voice/respond` calls
`runAssistantTurn` exactly like `/api/assistant/chat` does. The only new
code is the Twilio-specific transport: TwiML generation, speech/text
conversion, and webhook signature verification
(`src/lib/voice/twilio.ts`).

**Session continuity**: a phone call has no cookies, so the session id
chat-agent mints on the first turn is round-tripped as a `?sid=` query
param on the `<Gather>` action URL for every subsequent turn, rather than
relying on a cookie like the web widget does.

**Security**: every request is verified against Twilio's `X-Twilio-Signature`
header (`validateTwilioSignature`, HMAC-SHA1 over the full URL + sorted POST
params, per [Twilio's docs](https://www.twilio.com/docs/usage/security#validating-requests)).
Both routes fail closed — return a bare `<Reject/>` — if `TWILIO_AUTH_TOKEN`
is unset or the signature doesn't match. This is the same secret Twilio
gives you for validating requests, not a bearer token you invent.

## Setup (User Action Card)

This needs a Twilio account and a real phone number — that's the one part
that can't be done from code.

1. **Create a Twilio account** (or use an existing one) at
   [twilio.com](https://www.twilio.com/) — pay-as-you-go, no fixed minimum.
2. **Buy a phone number** with Voice capability: Console → Phone Numbers →
   Buy a Number.
3. **Copy the Auth Token**: Console → Account → API keys & tokens → Auth
   Token. Set it as `TWILIO_AUTH_TOKEN` in the app's environment (Hostinger
   hPanel → Node.js app → Environment variables) — **never commit it or
   paste it into chat**.
4. **Point the number at this app**: on the phone number's configuration
   page, under "Voice Configuration" → "A call comes in", set:
   - Webhook: `https://app.ypnus.com/api/voice/incoming`
   - HTTP method: `POST`
5. Call the number. First turn is a static greeting; every turn after that
   is the real AI assistant.

## Limitations / follow-ups not built here

- **English only** — Twilio's speech recognition defaults to `en-US`; a
  Spanish-speaking caller base would need `language` set on `<Gather>` and
  a matching `<Say>` voice.
- **No mid-call handoff to a human.** A caller who wants a real person has
  no `<Dial>`-to-a-real-number escape hatch yet — the assistant will offer
  to schedule a callback instead, since that's what `schedule_meeting`
  already does.
- **No call-status webhook** (missed/failed/completed call analytics) —
  only the live Gather/Say loop is wired up. Would need a separate
  `statusCallback` endpoint on the Twilio number.
- **`start_signup` isn't available in this mode** — phone calls run in
  `lead_qualification` mode (consumer borrowers), and `start_signup` is
  scoped to `public_site` mode (loan officers). A caller who's actually an
  LO wanting to sign up will currently get scheduling/territory tools, not
  a signup link — worth revisiting if LOs turn out to call in too.
