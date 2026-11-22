# Messaging compliance: where the app contacts people, and what protects them

This is the code side of TCPA, CAN-SPAM and mortgage advertising rules. It is not legal advice. Items marked
"counsel" need a lawyer's decision before they change.

---

## 1. Every place the app sends a message

### To borrowers

| What | When | Channel | Code | Checks before it goes out |
| --- | --- | --- | --- | --- |
| Follow-up journey: confirmation, day 1, 3, 5, 30, 60, 90 | After a borrower finishes the intake form or arrives from a partner, with consent | Email | `src/lib/automation.ts`, `src/lib/outreach.ts` | Consent ledger and opt-out, advertising check, NMLS and license-state check, unsubscribe link, postal address |
| Follow-up journey: instant acknowledgement | Same | Text | Same | Same, plus quiet hours (8am to 9pm) and the STOP line |
| Cerebro follow-ups, nudges and rate alerts | Queued by Cerebro; sent on their own in "live" mode, or after the officer approves | Email | `src/lib/cerebro-dispatch.ts` | Consent ledger and opt-out, advertising check, NMLS and license-state check, unsubscribe link, postal address, not after a booking |
| Appointment confirmation, reminder, cancellation | When a call is booked, the day before, when cancelled | Email | `src/lib/appointments.ts` | Opt-out, officer NMLS line. Transactional: about a meeting the borrower asked for |
| Voice assistant | When a borrower phones in | Voice (inbound only) | `src/app/api/voice/*` | Twilio signature. The app places no outbound calls |
| Replies to HELP | When a borrower texts HELP | Text | `src/lib/sms-inbound.ts` | Twilio signature |

### To loan officers and the business

| What | Channel | Code |
| --- | --- | --- |
| Sign-in link | Email | `src/app/api/auth/email-link/route.ts` |
| New lead alert | Email, in-app, phone alert | `src/lib/notifications.ts`, `src/lib/push.ts` |
| Appointment notice | Email | `src/lib/appointments.ts` |
| Demo request and lead notices to the business inbox | Email | `src/lib/email.ts` |

### Handed to another system

| What | Code | Note |
| --- | --- | --- |
| Journey messages, when `OUTREACH_WEBHOOK_URL` is set | `src/lib/outreach.ts` | The whole message is handed over, with the disclosures, unsubscribe link and postal address already in it. Whatever sends it must send it whole, and must pass STOP replies back (section 4). |
| Completed intake, when `INTAKE_EXTERNAL_WEBHOOK_URL` is set | `src/lib/external-webhook.ts` | Lead data only. Nothing is sent to the borrower from here. |
| Review requests | `src/app/api/reviews/request/route.ts` | Handed to a webhook; nothing is sent by this app. |

### Records only (nothing is sent)

ZIP code "neighbor lock" alerts (`src/lib/zip-scarcity.ts`) are saved for a person to use. Nothing goes out.

---

## 2. What was fixed (the P0 findings)

| Finding | Before | Now |
| --- | --- | --- |
| **STOP was ignored** | No route received a borrower's text. A STOP reply changed nothing. | `/api/webhooks/sms` receives every text. STOP (and the other carrier opt-out words) opts out every lead with that number on every channel and cancels what was queued. START allows texts again. HELP gets a reply. Only requests signed by Twilio are accepted. The opt-out, the cancelled messages and the "already handled" mark are saved together, so a retry after a failure is done in full. A number from another country that ends in the same ten digits as a borrower's is not treated as that borrower. |
| **Consent was a bare yes/no** | No time, wording or source. The consent ledger existed but nothing wrote to it. | Every lead that agrees gets a ledger entry per channel: when, where, and the exact question they answered. It is written where leads are created, so no capture point can skip it. A time supplied by a partner is never filed later than now, and every opt-out is filed after everything already recorded, so a fast clock cannot make an old "yes" outlast a later "no". |
| **Journey emails had no way out** | No unsubscribe link and no postal address. | Every journey email has an unsubscribe link, one-click unsubscribe headers for Gmail and Yahoo, and the sender's postal address. Unsubscribing also cancels what was queued. Cerebro's emails gained the postal address too. |
| **Journey messages had no NMLS line** | The officer's NMLS ID did not appear. | Every journey message goes through the same compliance engine as Cerebro's: officer NMLS ID, company NMLS ID, state lines, Equal Housing. A message is not sent when the NMLS ID is missing or the borrower is in a state the officer has not listed a license for (an officer who has listed no licenses included). |
| **Nothing stopped after a booking** | A borrower who booked a call still got "would you like to book a call?" | Booking cancels the borrower's queued journey messages, and each message is checked again when it comes due, which also covers calls booked before this was installed. Cerebro does not send, on its own, a follow-up or nudge written before the booking. |

Also fixed: a journey message is no longer queued to a placeholder address when the borrower gave no phone or no email.

**The last look before sending.** Consent, the booking rule and whether the message was cancelled are checked a
second time immediately before a journey message is handed to the email or text provider, and Cerebro reads the
ledger again after each email it sends. An opt-out or a booking that lands while a message is being prepared
stops that message.

Tests: `src/lib/compliance-messaging.test.ts`.

---

## 3. What changes for officers (read before installing)

- **An officer with no NMLS ID in their profile sends no journey messages.** Each one is cancelled with the reason
  "Add your NMLS ID to your profile first". Check that every paying officer has one.
- **A borrower in a state the officer has not listed a license for gets no journey messages from that officer.**
  The house account lists California only, so house leads with a ZIP code in another state now get none,
  including the confirmation email. **An officer who has listed no licenses at all sends none to any borrower
  whose ZIP code is known**, the same rule Cerebro already applies to emails it sends on its own. Leads with no
  ZIP code are unaffected. Check that every paying officer has listed their state licenses.
- **A borrower who books a call stops getting the journey.** The 30, 60 and 90-day check-ins are cancelled too.
- **STOP by text also stops email.** It is the cautious choice; say if it should stop texts and calls only.

---

## 4. Setup needed once (Twilio)

STOP handling only works after this is done. Until then, nothing changes for texts.

1. In the Twilio console, open the phone number the app sends from.
2. Under "Messaging", set "A message comes in" to a webhook, method POST:

```
https://ypnus.com/api/webhooks/sms
```

3. Text STOP to the number from a phone that belongs to a test lead. In the server log you should see:

```
[sms] opted_out for 1 lead(s)
```

```bash
sudo journalctl -u ypnusa --since "10 minutes ago" | grep "\[sms\]"
```

`TWILIO_AUTH_TOKEN` must be set in the server settings (it already is if the voice line works). Without it the
route answers 503 and processes nothing.

If texts are sent by another system through `OUTREACH_WEBHOOK_URL`, that system receives the STOP replies, not
this app. It must stop sending by itself and should forward opt-outs.

---

## 5. Still open, in priority order

| # | Item | Why | Who |
| --- | --- | --- | --- |
| 1 | Partner leads are trusted as consented | `/api/webhooks/leads` now stores any proof of consent the partner sends (`consentText`, `consentCapturedAt`, `consentSource`), but does not require it. Require it once partners send it. | Owner, then code |
| 2 | In chat and on calls, the AI decides whether consent was given | The ledger entry points at the chat transcript, but there is no button the borrower presses. Add an explicit yes. | Code |
| 3 | The first text within 10 minutes of a lead is exempt from quiet hours | Confirm the exemption. | Counsel |
| 4 | Journey emails use ZIP and county data in their wording | The personalization line comes from the second scorer (life-event rates by area). It is inactive until four data feeds are set. Remove it from borrower messages before any feed is switched on. | Code |
| 5 | Cerebro sends without review by default | Make "approve first" the default, or fix the dashboard wording that says nothing is sent on the officer's behalf. | Owner |
| 6 | Journey messages to a known state need a license the officer has listed for it; an unknown state is allowed | Cerebro's unreviewed emails also require the state to be known. Decide whether the journey should too (it would stop the journey for any lead without a ZIP code). | Counsel |
| 7 | The voice greeting does not say the call is transcribed and processed by an AI provider | Two-party consent states. | Counsel, then code |
| 8 | No retention limit or delete-on-request for leads, chats and consent records | The privacy policy promises deletion. | Code |
| 9 | STOP from a number with no lead on file is not remembered | A later lead with that number starts with fresh consent, which is correct, but there is no number-level block list. | Code, low |
| 11 | A save that cannot reach the disk is kept in memory and reported as done | True of the whole data file, not only messaging (`flushToDisk` in `src/lib/db.ts`): an opt-out accepted while the disk is unwritable is lost if the server restarts before the disk recovers. Goes away for the records moved to PostgreSQL; consent is not one of them yet. | Code |
| 10 | California state disclosure wording is marked unreviewed | `src/lib/compliance/rules.ts`. | Counsel |
