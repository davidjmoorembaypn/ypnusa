import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import type { BorrowerAnswers, BorrowerLeadRecord, FollowUpPlan, LoanOfficerRecord, ScheduledFollowUpRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-compliance-messaging-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
delete process.env.INTAKE_EXTERNAL_WEBHOOK_URL;
delete process.env.OUTREACH_WEBHOOK_URL;
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.SENDGRID_API_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.MLO_CALENDAR_CONFIG_JSON;

const qualification = { programScores: {}, leadQuality: "strong" as const, urgency: "high" as const, recommendedNextStep: "Call", rationale: [] };
const EMAIL_PLANS: FollowUpPlan[] = [
  "immediate_confirmation_email",
  "day_1_educational_email",
  "day_3_book_call_email",
  "day_5_urgency_email",
  "day_30_check_in",
  "day_60_check_in",
  "day_90_check_in",
];

/**
 * The messaging rules a borrower is owed, as tests: a record of what they agreed to, a way out of
 * every email, STOP honoured, the officer's NMLS ID on every message, and no "book a call" nudge
 * after they have booked one.
 */
describe("borrower messaging compliance", async () => {
  const { processDueFollowUps, scheduleBorrowerJourney } = await import("./automation");
  const { bookAppointment, listAvailableSlots } = await import("./calendar");
  const { dispatchCerebroMessages, emailHtml } = await import("./cerebro-dispatch");
  const { canContact, latestConsent, partnerConsentTime, recordOptOutAllChannels } = await import("./consent");
  const { PII_FIELDS } = await import("./crypto/pii-snapshot");
  const { logCrmActivity } = await import("./crm");
  const { appendAppointment, appendBorrowerLead, persistFollowUpsBatch, readDb, saveCerebroAction, writeDb } = await import("./db");
  const { generateId } = await import("./id");
  const { intakeTick } = await import("./intake-engine");
  const { OutreachBlockedError, prepareOutreach } = await import("./outreach");
  const { handleInboundSms, phoneKey, SMS_HELP_REPLY } = await import("./sms-inbound");
  const { unsubscribeBorrower } = await import("./unsubscribe");
  const { unsubscribeToken, verifyUnsubscribeToken } = await import("./unsubscribe-link");

  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  function addOfficer(overrides: Partial<LoanOfficerRecord> = {}): LoanOfficerRecord {
    const officer: LoanOfficerRecord = {
      ...readDb().loanOfficers[0],
      id: generateId("lo"),
      name: "Dana Reyes",
      email: `dana-${Math.random().toString(36).slice(2)}@lender.test`,
      nmlsId: "123456",
      company: "Valley Home Loans",
      companyNmlsId: "654321",
      licenses: [{ state: "CA", type: "mlo" }],
      entitlementTier: "growth",
      entitlementStatus: "active",
      ...overrides,
    };
    writeDb((db) => {
      db.loanOfficers.push(officer);
    });
    return officer;
  }

  function addLead(loId: string, answers: Partial<BorrowerAnswers> = {}): BorrowerLeadRecord {
    const lead: BorrowerLeadRecord = {
      id: generateId("lead"),
      createdAt: new Date().toISOString(),
      assignedLoId: loId,
      qualification,
      crmLeadId: "",
      answers: { loanProgram: "CONVENTIONAL", name: "Sam Buyer", email: "sam@borrowermail.com", phone: "+15595550123", zip: "93618", contactConsent: true, ...answers },
    };
    appendBorrowerLead(lead);
    return lead;
  }

  function job(lead: BorrowerLeadRecord, plan: FollowUpPlan, overrides: Partial<ScheduledFollowUpRecord> = {}): ScheduledFollowUpRecord {
    const sms = plan === "immediate_sms_ack";
    return {
      id: generateId("fu"),
      borrowerLeadId: lead.id,
      plan,
      channel: sms ? "sms" : "email",
      recipient: sms ? (lead.answers.phone as string) : (lead.answers.email as string),
      scheduledAt: new Date(Date.now() - 60_000).toISOString(),
      status: "pending",
      bodySummary: plan,
      createdAt: new Date(Date.now() - 3_600_000).toISOString(),
      ...overrides,
    };
  }
  const followUpsOf = (leadId: string) => readDb().followUps.filter((item) => item.borrowerLeadId === leadId);
  const consentsOf = (leadId: string) => readDb().consents.filter((item) => item.borrowerLeadId === leadId);

  // ------------------------------------------------------------------ consent ledger

  describe("consent ledger", () => {
    it("the intake form records when the borrower agreed and the exact question they answered", async () => {
      const replies: Partial<Record<keyof BorrowerAnswers, string>> = {
        purchaseRefiIntent: "refinance",
        zip: "93720",
        targetLoanAmountUsd: "500000",
        estimatedCreditBand: "670-739",
        timeline: "1_3_months",
        name: "Taylor Borrower",
        email: "taylor@borrowermail.com",
        phone: "+15595550188",
        contactConsent: "true",
      };
      const before = Date.now();
      let response = await intakeTick({ loanProgram: "REFI", funnelSource: "unit_test" });
      for (let step = 0; step < 30 && response.ok && response.phase === "collecting"; step += 1) {
        const active = response.activeStep;
        assert.ok(active);
        const rawValue = replies[active.field];
        assert.ok(rawValue !== undefined, `no canned reply for ${String(active.field)}`);
        response = await intakeTick({ loanProgram: "REFI", sessionId: response.sessionId, incoming: { field: active.field, rawValue } });
      }
      assert.equal(response.phase, "crm_synced");
      const leadId = response.crmArtifacts?.borrowerLeadId as string;
      const entries = consentsOf(leadId);
      assert.deepEqual(entries.map((entry) => entry.channel).sort(), ["email", "sms"]);
      for (const entry of entries) {
        assert.equal(entry.granted, true);
        assert.equal(entry.source, "intake_form");
        assert.match(entry.textShown ?? "", /^May YPN USA and your assigned loan officer contact you by text and email about this request\?/);
        assert.match(entry.textShown ?? "", /reply STOP to opt out/);
        assert.ok(Date.parse(entry.at) >= before - 1000 && Date.parse(entry.at) <= Date.now());
      }
      // The question names text and email only, so a "yes" to it is not consent to a phone call.
      assert.equal(latestConsent(readDb(), leadId, "call"), undefined);
    });

    it("a borrower who said no gets no ledger entry and no follow-up", () => {
      const officer = addOfficer();
      const result = logCrmActivity(
        { loanProgram: "FHA", name: "No Thanks", email: "no@borrowermail.com", phone: "+15595550111", contactConsent: false },
        qualification,
        officer.id,
        "unit_test",
      );
      assert.deepEqual(consentsOf(result.borrowerLeadId), []);
      assert.deepEqual(scheduleBorrowerJourney(result.borrowerLeadId, { loanProgram: "FHA", contactConsent: false }), []);
      assert.deepEqual(canContact({ db: readDb(), borrowerLeadId: result.borrowerLeadId, channel: "email", legacyConsent: false }), {
        allowed: false,
        reason: "no_consent",
      });
    });

    it("a lead from a partner keeps the proof of consent the partner sent", () => {
      const officer = addOfficer();
      const result = logCrmActivity(
        { loanProgram: "VA", name: "Pat Partner", email: "pat@borrowermail.com", phone: "+15595550122", contactConsent: true },
        qualification,
        officer.id,
        "lead_webhook",
        undefined,
        {
          source: "lead_webhook:partner-landing-page",
          textShown: "I agree to be contacted by email and text about my mortgage request.",
          at: "2026-11-20T18:30:00-08:00",
          channels: ["email", "sms"],
        },
      );
      const entries = consentsOf(result.borrowerLeadId);
      assert.equal(entries.length, 2);
      assert.equal(entries[0].source, "lead_webhook:partner-landing-page");
      assert.equal(entries[0].textShown, "I agree to be contacted by email and text about my mortgage request.");
      assert.equal(entries[0].at, "2026-11-21T02:30:00.000Z");
    });

    it("a partner whose clock runs fast cannot date consent after the borrower's later opt-out", () => {
      const officer = addOfficer();
      const ahead = new Date(Date.now() + 10 * 60_000).toISOString();
      const result = logCrmActivity(
        { loanProgram: "VA", name: "Fast Clock", email: "fast@borrowermail.com", phone: "+15595550133", contactConsent: true },
        qualification,
        officer.id,
        "lead_webhook",
        undefined,
        { source: "lead_webhook:fast-clock", at: ahead, channels: ["email", "sms"] },
      );
      const leadId = result.borrowerLeadId;
      assert.equal(consentsOf(leadId).length, 2);
      assert.equal(consentsOf(leadId).every((entry) => Date.parse(entry.at) <= Date.now()), true, "filed no later than now");

      assert.equal(handleInboundSms({ from: "+15595550133", body: "STOP", messageSid: "SM_fast_clock" }).action, "opted_out");
      const noon = new Date("2026-11-20T20:00:00Z");
      for (const channel of ["email", "sms"] as const) {
        assert.equal(canContact({ db: readDb(), borrowerLeadId: leadId, channel, legacyConsent: true, now: noon }).allowed, false, channel);
      }
    });

    it("an opt-out wins over an entry already in the ledger with a later time, and START still works after it", () => {
      const officer = addOfficer();
      const lead = addLead(officer.id, { phone: "+15595550134", email: "skew@borrowermail.com" });
      const ahead = new Date(Date.now() + 3 * 86400_000).toISOString();
      writeDb((db) => {
        for (const channel of ["email", "sms"] as const) {
          db.consents.push({ id: generateId("consent"), borrowerLeadId: lead.id, channel, granted: true, source: "restored_backup", at: ahead });
        }
      });
      const noon = new Date("2026-11-20T20:00:00Z");
      const allowed = (channel: "email" | "sms") => canContact({ db: readDb(), borrowerLeadId: lead.id, channel, legacyConsent: true, now: noon }).allowed;

      assert.equal(unsubscribeBorrower(lead.id, unsubscribeToken(lead.id), "email_one_click_unsubscribe"), true);
      assert.equal(allowed("email"), false);
      assert.equal(allowed("sms"), false);

      assert.equal(handleInboundSms({ from: "+15595550134", body: "START", messageSid: "SM_skew_start" }).action, "opted_in");
      assert.equal(allowed("sms"), true);
      assert.equal(allowed("email"), false);
      assert.equal(handleInboundSms({ from: "+15595550134", body: "STOP", messageSid: "SM_skew_stop" }).action, "opted_out");
      assert.equal(allowed("sms"), false);
    });

    it("the session's copy of the consent wording is encrypted at rest like the ledger's", () => {
      assert.ok(PII_FIELDS.sessions.includes("consentCapture"));
      assert.ok(PII_FIELDS.consents.includes("textShown"));
    });

    it("only channels the borrower gave an address for are recorded, and a lead created with no details still gets an entry", () => {
      const officer = addOfficer();
      const emailOnly = logCrmActivity({ loanProgram: "FHA", name: "Email Only", email: "only@borrowermail.com", contactConsent: true }, qualification, officer.id, "chat");
      assert.deepEqual(consentsOf(emailOnly.borrowerLeadId).map((entry) => [entry.channel, entry.source]), [["email", "unspecified:chat"]]);

      const chat = logCrmActivity(
        { loanProgram: "FHA", name: "Chat Lead", email: "chat@borrowermail.com", phone: "+15595550133", contactConsent: true },
        qualification,
        officer.id,
        "public_chat",
        "chat_abc",
        { source: "chat_assistant:chat_abc", channels: ["email", "sms", "call"] },
      );
      assert.deepEqual(consentsOf(chat.borrowerLeadId).map((entry) => entry.channel).sort(), ["call", "email", "sms"]);
      // AI voice always needs its own explicit grant.
      assert.equal(canContact({ db: readDb(), borrowerLeadId: chat.borrowerLeadId, channel: "ai_voice", legacyConsent: true }).allowed, false);
    });
  });

  // ------------------------------------------------------------------ journey messages

  describe("follow-up journey messages", () => {
    it("every journey email carries the NMLS IDs, Equal Housing, an unsubscribe link and the postal address", () => {
      const officer = addOfficer();
      const lead = addLead(officer.id);
      for (const plan of EMAIL_PLANS) {
        const message = prepareOutreach(job(lead, plan), { lead, officer });
        for (const text of [message.text, message.html ?? ""]) {
          assert.match(text, /Dana Reyes, NMLS #123456/, plan);
          assert.match(text, /Valley Home Loans, NMLS #654321/, plan);
          assert.match(text, /Equal Housing Opportunity/, plan);
          assert.match(text, /YPN USA, 247 N L St, Dinuba, CA 93618/, plan);
          assert.match(text, /virtual assistant/i, plan);
        }
        const link = new URL(message.unsubscribeUrl as string);
        assert.equal(link.pathname, "/unsubscribe");
        assert.equal(link.searchParams.get("l"), lead.id);
        assert.equal(verifyUnsubscribeToken(lead.id, link.searchParams.get("t") as string), true);
        assert.ok(message.text.includes(message.unsubscribeUrl as string), plan);
        assert.ok((message.html as string).includes("Unsubscribe</a>"), plan);
        assert.match(message.headers?.["List-Unsubscribe"] ?? "", /^<https:\/\/[^>]+\/api\/unsubscribe\?l=/);
        assert.equal(message.headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
        assert.equal(message.replyTo, officer.email);
        assert.equal(message.fromName, "Dana Reyes via YPN USA");
      }
    });

    it("the text message shows the NMLS ID and ends with the STOP line", () => {
      const officer = addOfficer();
      const lead = addLead(officer.id);
      const message = prepareOutreach(job(lead, "immediate_sms_ack"), { lead, officer });
      assert.match(message.text, /Dana Reyes, NMLS #123456/);
      assert.match(message.text, /Reply STOP to opt out\.$/);
      assert.equal(message.html, undefined);
      assert.equal(message.unsubscribeUrl, undefined);
    });

    it("a message is refused when the NMLS ID is missing, the state is not licensed, or the wording quotes a rate", () => {
      const lead = addLead("lo_none");
      const noNmls = addOfficer({ nmlsId: undefined });
      assert.throws(() => prepareOutreach(job(lead, "day_1_educational_email"), { lead, officer: noNmls }), (error: unknown) => {
        assert.ok(error instanceof OutreachBlockedError);
        assert.match(error.reason, /NMLS ID/);
        return true;
      });

      const californiaOnly = addOfficer();
      const texan = addLead(californiaOnly.id, { zip: "75001" });
      assert.throws(() => prepareOutreach(job(texan, "day_1_educational_email"), { lead: texan, officer: californiaOnly }), (error: unknown) => {
        assert.ok(error instanceof OutreachBlockedError);
        assert.match(error.reason, /license in TX/);
        return true;
      });

      // An officer who has listed no licenses is not assumed to be licensed in the borrower's state.
      for (const licenses of [[], undefined]) {
        const noneListed = addOfficer({ licenses });
        assert.throws(() => prepareOutreach(job(lead, "day_1_educational_email"), { lead, officer: noneListed }), (error: unknown) => {
          assert.ok(error instanceof OutreachBlockedError);
          assert.match(error.reason, /license in CA/);
          return true;
        });
        // With no ZIP code the state is unknown, and the message still goes.
        const noZip = addLead(noneListed.id, { zip: undefined });
        assert.match(prepareOutreach(job(noZip, "day_1_educational_email"), { lead: noZip, officer: noneListed }).text, /NMLS #123456/);
      }

      const personalization = {
        zipDemandSummary: "",
        lifeEventSummary: "",
        remodelRoiTeaser: "",
        rentalDemandTeaser: "",
        whyThisMattersForYou: "Rates in your area are near 6.5% APR this week.",
      };
      assert.throws(
        () => prepareOutreach(job(lead, "day_1_educational_email"), { lead, officer: californiaOnly, personalization }),
        (error: unknown) => error instanceof OutreachBlockedError && /rate, APR or percentage/.test(error.reason),
      );
    });

    it("nothing is queued for a channel the borrower gave no address for", () => {
      const both = scheduleBorrowerJourney("lead_both", { loanProgram: "FHA", email: "a@borrowermail.com", phone: "+15595550001", contactConsent: true });
      assert.equal(both.length, 8);
      const emailOnly = scheduleBorrowerJourney("lead_email_only", { loanProgram: "FHA", email: "a@borrowermail.com", contactConsent: true });
      assert.equal(emailOnly.length, 7);
      assert.equal(emailOnly.every((item) => item.channel === "email" && item.recipient === "a@borrowermail.com"), true);
      const phoneOnly = scheduleBorrowerJourney("lead_phone_only", { loanProgram: "FHA", phone: "+15595550001", contactConsent: true });
      assert.deepEqual(phoneOnly.map((item) => [item.plan, item.recipient]), [["immediate_sms_ack", "+15595550001"]]);
      assert.deepEqual(scheduleBorrowerJourney("lead_neither", { loanProgram: "FHA", contactConsent: true }), []);
    });

    it("a refused message is cancelled with the reason, not sent and not retried", async () => {
      const officer = addOfficer({ nmlsId: undefined });
      const lead = addLead(officer.id);
      const blocked = job(lead, "day_1_educational_email");
      persistFollowUpsBatch([blocked]);
      const summary = await processDueFollowUps({ borrowerLeadId: lead.id });
      assert.equal(summary.processed, 0);
      assert.equal(summary.failed, 0);
      assert.deepEqual(summary.events, ["day_1_educational_email:email:blocked"]);
      const stored = followUpsOf(lead.id)[0];
      assert.equal(stored.status, "cancelled");
      assert.match(stored.lastError ?? "", /^Not sent: Add your NMLS ID/);
      assert.equal((await processDueFollowUps({ borrowerLeadId: lead.id })).processed, 0);
    });
  });

  // ------------------------------------------------------------------ unsubscribe

  describe("unsubscribe", () => {
    it("one click stops every channel and cancels what was still queued", async () => {
      const officer = addOfficer();
      const lead = addLead(officer.id);
      persistFollowUpsBatch([job(lead, "day_1_educational_email"), job(lead, "day_30_check_in", { scheduledAt: new Date(Date.now() + 30 * 86400_000).toISOString() })]);

      assert.equal(unsubscribeBorrower(lead.id, "wrong-token", "email_unsubscribe_page"), false);
      assert.equal(followUpsOf(lead.id).every((item) => item.status === "pending"), true);

      assert.equal(unsubscribeBorrower(lead.id, unsubscribeToken(lead.id), "email_one_click_unsubscribe"), true);
      assert.equal(followUpsOf(lead.id).every((item) => item.status === "cancelled"), true);
      for (const channel of ["email", "sms", "call", "ai_voice"] as const) {
        assert.deepEqual(canContact({ db: readDb(), borrowerLeadId: lead.id, channel, legacyConsent: true, now: new Date("2026-11-20T20:00:00Z") }), {
          allowed: false,
          reason: "opted_out",
        });
      }
      assert.equal((await processDueFollowUps({ borrowerLeadId: lead.id })).processed, 0);
    });
  });

  // ------------------------------------------------------------------ STOP

  describe("STOP replies", () => {
    it("STOP opts out every lead with that phone number, however it was typed, and cancels their queue", () => {
      const officer = addOfficer();
      const first = addLead(officer.id, { phone: "(559) 555-0147" });
      const second = addLead(officer.id, { phone: "+1 559-555-0147", email: "second@borrowermail.com" });
      const other = addLead(officer.id, { phone: "+15595550999", email: "other@borrowermail.com" });
      persistFollowUpsBatch([job(first, "day_3_book_call_email"), job(second, "immediate_sms_ack"), job(other, "day_3_book_call_email")]);

      const result = handleInboundSms({ from: "+15595550147", body: "  Stop. ", messageSid: "SM_stop_1" });
      assert.deepEqual(result, { action: "opted_out", leads: 2 });
      for (const lead of [first, second]) {
        assert.equal(latestConsent(readDb(), lead.id, "sms")?.granted, false);
        assert.equal(latestConsent(readDb(), lead.id, "sms")?.source, "sms_stop");
        assert.equal(canContact({ db: readDb(), borrowerLeadId: lead.id, channel: "email", legacyConsent: true }).allowed, false);
        assert.equal(followUpsOf(lead.id).every((item) => item.status === "cancelled"), true);
      }
      assert.equal(latestConsent(readDb(), other.id, "sms"), undefined);
      assert.equal(followUpsOf(other.id)[0].status, "pending");

      // Twilio retries a webhook it did not get an answer to: the same message changes nothing more.
      const entries = readDb().consents.length;
      assert.deepEqual(handleInboundSms({ from: "+15595550147", body: "STOP", messageSid: "SM_stop_1" }), { action: "duplicate", leads: 2 });
      assert.equal(readDb().consents.length, entries);
    });

    it("a STOP that fails part-way is done in full when the carrier sends it again", () => {
      const officer = addOfficer();
      const lead = addLead(officer.id, { phone: "+15595550148", email: "retry@borrowermail.com" });
      persistFollowUpsBatch([job(lead, "day_3_book_call_email")]);

      // The store refuses the ledger entries once (as a full disk or a crash would).
      writeDb((db) => {
        Object.freeze(db.consents);
      });
      assert.throws(() => handleInboundSms({ from: "+15595550148", body: "STOP", messageSid: "SM_retry_1" }));
      writeDb((db) => {
        db.consents = [...db.consents];
      });
      assert.equal(latestConsent(readDb(), lead.id, "sms"), undefined);

      // The retry is not waved through as a duplicate: the opt-out and the cancellation happen.
      assert.deepEqual(handleInboundSms({ from: "+15595550148", body: "STOP", messageSid: "SM_retry_1" }), { action: "opted_out", leads: 1 });
      assert.equal(latestConsent(readDb(), lead.id, "sms")?.granted, false);
      assert.equal(followUpsOf(lead.id)[0].status, "cancelled");
      assert.equal(handleInboundSms({ from: "+15595550148", body: "STOP", messageSid: "SM_retry_1" }).action, "duplicate");
    });

    it("a number from another country that ends in the same ten digits is not the same borrower", () => {
      const officer = addOfficer();
      const american = addLead(officer.id, { phone: "(207) 946-0958", email: "maine@borrowermail.com" });
      assert.equal(phoneKey("(207) 946-0958"), "2079460958");
      assert.equal(phoneKey("+1 207 946 0958"), "2079460958");
      assert.equal(phoneKey("+44 20 7946 0958"), "442079460958");

      assert.deepEqual(handleInboundSms({ from: "+442079460958", body: "STOP", messageSid: "SM_gb_stop" }), { action: "opted_out", leads: 0 });
      assert.equal(latestConsent(readDb(), american.id, "sms"), undefined);

      // And it cannot switch texts back on for a borrower who opted out.
      handleInboundSms({ from: "+12079460958", body: "STOP", messageSid: "SM_us_stop" });
      assert.deepEqual(handleInboundSms({ from: "+442079460958", body: "START", messageSid: "SM_gb_start" }), { action: "opted_in", leads: 0 });
      assert.equal(latestConsent(readDb(), american.id, "sms")?.granted, false);
    });

    it("a STOP that arrives while a message is being prepared stops that message", async () => {
      const officer = addOfficer();
      // No ZIP code, so preparing the message makes no outside lookup: the wait is still there.
      const lead = addLead(officer.id, { phone: "+15595550149", email: "midflight@borrowermail.com", zip: undefined });
      persistFollowUpsBatch([job(lead, "day_1_educational_email")]);

      const run = processDueFollowUps({ borrowerLeadId: lead.id });
      // The worker has picked the message up and checked consent; the STOP lands before it sends.
      assert.equal(followUpsOf(lead.id)[0].status, "sending");
      assert.equal(handleInboundSms({ from: "+15595550149", body: "STOP", messageSid: "SM_midflight" }).action, "opted_out");
      const summary = await run;
      assert.equal(summary.processed, 0);
      assert.equal(followUpsOf(lead.id)[0].status, "cancelled");
      assert.equal(followUpsOf(lead.id)[0].sentAt, undefined);

      // The same when only the ledger changed and nothing cancelled the message.
      const second = addLead(officer.id, { phone: "+15595550150", email: "midflight2@borrowermail.com", zip: undefined });
      persistFollowUpsBatch([job(second, "day_1_educational_email")]);
      const again = processDueFollowUps({ borrowerLeadId: second.id });
      recordOptOutAllChannels(second.id, "test");
      assert.deepEqual((await again).events, ["day_1_educational_email:email:opted_out"]);
      assert.equal(followUpsOf(second.id)[0].status, "cancelled");
    });

    it("every carrier opt-out word counts, and ordinary replies do not", () => {
      const officer = addOfficer();
      for (const [index, word] of ["STOP", "stopall", "Unsubscribe", "CANCEL", "End", "QUIT", "opt out"].entries()) {
        const phone = `+1559555${String(2000 + index)}`;
        const lead = addLead(officer.id, { phone, email: `w${index}@borrowermail.com` });
        assert.equal(handleInboundSms({ from: phone, body: word, messageSid: `SM_word_${index}` }).action, "opted_out", word);
        assert.equal(latestConsent(readDb(), lead.id, "sms")?.granted, false, word);
      }
      const lead = addLead(officer.id, { phone: "+15595553000", email: "talk@borrowermail.com" });
      assert.deepEqual(handleInboundSms({ from: "+15595553000", body: "Please stop by on Tuesday", messageSid: "SM_talk" }), { action: "none", leads: 1 });
      assert.equal(latestConsent(readDb(), lead.id, "sms"), undefined);
      assert.deepEqual(handleInboundSms({ from: "+15595559999", body: "STOP", messageSid: "SM_unknown" }), { action: "opted_out", leads: 0 });
      assert.equal(phoneKey("555-0147"), "");
    });

    it("two international numbers sharing their last ten digits are different senders", () => {
      assert.equal(phoneKey("+1 (559) 555-0147"), phoneKey("559-555-0147"));
      assert.notEqual(phoneKey("+44 5595550147"), phoneKey("+52 5595550147"));
      assert.notEqual(phoneKey("+44 5595550147"), phoneKey("+1 5595550147"));
      const officer = addOfficer();
      const uk = addLead(officer.id, { phone: "+44 5595556100", email: "uk@borrowermail.com" });
      const mx = addLead(officer.id, { phone: "+52 5595556100", email: "mx@borrowermail.com" });
      assert.deepEqual(handleInboundSms({ from: "+445595556100", body: "STOP", messageSid: "SM_uk_stop" }), { action: "opted_out", leads: 1 });
      assert.equal(latestConsent(readDb(), uk.id, "sms")?.granted, false);
      assert.equal(latestConsent(readDb(), mx.id, "sms"), undefined, "the other borrower's consent is untouched");
      handleInboundSms({ from: "+525595556100", body: "STOP", messageSid: "SM_mx_stop" });
      assert.deepEqual(handleInboundSms({ from: "+445595556100", body: "START", messageSid: "SM_uk_start" }), { action: "opted_in", leads: 1 });
      assert.equal(latestConsent(readDb(), mx.id, "sms")?.granted, false, "a START from one number never re-allows another");
    });

    it("a partner's consent time in the future is not used, so a later STOP still wins", () => {
      const now = new Date("2026-11-22T12:00:00Z");
      assert.equal(partnerConsentTime("2026-11-22T12:10:00Z", now), now.toISOString());
      assert.equal(partnerConsentTime("2026-11-22T11:00:00Z", now), "2026-11-22T11:00:00.000Z");
      assert.equal(partnerConsentTime("not a date", now), now.toISOString());
      assert.equal(partnerConsentTime(undefined, now), now.toISOString());
    });

    it("START allows texts again and nothing else; HELP gets a reply", () => {
      const officer = addOfficer();
      const lead = addLead(officer.id, { phone: "+15595554000", email: "back@borrowermail.com" });
      handleInboundSms({ from: "+15595554000", body: "STOP", messageSid: "SM_a" });
      assert.deepEqual(handleInboundSms({ from: "+15595554000", body: "start", messageSid: "SM_b" }), { action: "opted_in", leads: 1 });
      const noon = new Date("2026-11-20T20:00:00Z");
      assert.equal(canContact({ db: readDb(), borrowerLeadId: lead.id, channel: "sms", legacyConsent: true, now: noon }).allowed, true);
      assert.equal(canContact({ db: readDb(), borrowerLeadId: lead.id, channel: "email", legacyConsent: true, now: noon }).allowed, false);
      assert.equal(canContact({ db: readDb(), borrowerLeadId: lead.id, channel: "call", legacyConsent: true, now: noon }).allowed, false);

      const help = handleInboundSms({ from: "+15595554000", body: "HELP" });
      assert.equal(help.action, "help");
      assert.equal(help.reply, SMS_HELP_REPLY);
      assert.match(SMS_HELP_REPLY, /Reply STOP to opt out/);
      assert.ok(SMS_HELP_REPLY.length <= 160, "fits one text message");
    });

    it("the webhook acts only on requests signed by Twilio", async () => {
      const { POST } = await import("@/app/api/webhooks/sms/route");
      const officer = addOfficer();
      const lead = addLead(officer.id, { phone: "+15595555000", email: "hook@borrowermail.com" });
      const params = { From: "+15595555000", Body: "STOP", MessageSid: "SM_hook_1", To: "+15595120372" };
      const url = "https://ypnus.com/api/webhooks/sms";
      const sign = (token: string) =>
        crypto
          .createHmac("sha1", token)
          .update(url + Object.keys(params).sort().map((key) => key + params[key as keyof typeof params]).join(""), "utf8")
          .digest("base64");
      const send = (signature: string | null) =>
        POST(
          new Request(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", ...(signature ? { "x-twilio-signature": signature } : {}) },
            body: new URLSearchParams(params).toString(),
          }),
        );

      delete process.env.TWILIO_AUTH_TOKEN;
      assert.equal((await send(sign("anything"))).status, 503);

      process.env.TWILIO_AUTH_TOKEN = "test_auth_token";
      assert.equal((await send(null)).status, 403);
      assert.equal((await send(sign("someone_elses_token"))).status, 403);
      assert.equal(latestConsent(readDb(), lead.id, "sms"), undefined);

      const ok = await send(sign("test_auth_token"));
      assert.equal(ok.status, 200);
      assert.match(ok.headers.get("content-type") ?? "", /text\/xml/);
      assert.match(await ok.text(), /<Response\/>/);
      assert.equal(latestConsent(readDb(), lead.id, "sms")?.granted, false);
      delete process.env.TWILIO_AUTH_TOKEN;
    });
  });

  // ------------------------------------------------------------------ cancel on booking

  describe("after a borrower books a call", () => {
    it("the follow-ups still queued for them are cancelled", async () => {
      const officer = addOfficer();
      const lead = addLead(officer.id);
      const other = addLead(officer.id, { email: "notbooked@borrowermail.com", phone: "+15595556000" });
      const later = new Date(Date.now() + 3 * 86400_000).toISOString();
      persistFollowUpsBatch([
        job(lead, "immediate_confirmation_email", { status: "sent", sentAt: new Date().toISOString() }),
        job(lead, "day_3_book_call_email", { scheduledAt: later }),
        job(lead, "day_30_check_in", { scheduledAt: later }),
        job(other, "day_3_book_call_email", { scheduledAt: later }),
      ]);

      const slot = listAvailableSlots(officer.id, 5)[0];
      assert.ok(slot, "the officer has an open slot");
      await bookAppointment({ borrowerLeadId: lead.id, loId: officer.id, startIso: slot.start });

      assert.deepEqual(followUpsOf(lead.id).map((item) => item.status).sort(), ["cancelled", "cancelled", "sent"]);
      assert.equal(followUpsOf(other.id)[0].status, "pending");
    });

    it("a call already on the books stops a queued message when it comes due, and a cancelled call does not", async () => {
      const officer = addOfficer();
      const lead = addLead(officer.id, { email: "earlier@borrowermail.com", phone: "+15595556001" });
      const cancelledCall = addLead(officer.id, { email: "calledoff@borrowermail.com", phone: "+15595556002" });
      const queued = new Date(Date.now() - 3 * 86400_000).toISOString();
      const booked = new Date(Date.now() - 2 * 86400_000).toISOString();
      // Queued and booked before this rule existed: nothing cancelled the message at the time.
      persistFollowUpsBatch([
        job(lead, "day_3_book_call_email", { createdAt: queued }),
        job(cancelledCall, "day_3_book_call_email", { createdAt: queued }),
      ]);
      for (const [target, status] of [[lead, "booked"], [cancelledCall, "cancelled"]] as const) {
        appendAppointment({
          id: generateId("appt"),
          borrowerLeadId: target.id,
          loId: officer.id,
          createdAt: booked,
          start: new Date(Date.now() + 86400_000).toISOString(),
          end: new Date(Date.now() + 86400_000 + 1_800_000).toISOString(),
          status,
        });
      }
      const summary = await processDueFollowUps({ borrowerLeadId: lead.id });
      assert.deepEqual(summary.events, ["day_3_book_call_email:email:booked"]);
      assert.equal(followUpsOf(lead.id)[0].status, "cancelled");
      assert.match(followUpsOf(lead.id)[0].lastError ?? "", /booked a call/);

      assert.equal((await processDueFollowUps({ borrowerLeadId: cancelledCall.id })).processed, 1);
    });

    it("Cerebro looks at the ledger again after each send, so an opt-out during one send holds the next", async () => {
      const noon = new Date("2026-11-18T20:00:00Z");
      const officer = addOfficer();
      const first = addLead(officer.id, { zip: "93291", email: "one@borrowermail.com", phone: "+15595556003" });
      const second = addLead(officer.id, { zip: "93291", email: "two@borrowermail.com", phone: "+15595556004" });
      const base = {
        createdAt: noon.toISOString(),
        updatedAt: noon.toISOString(),
        loId: officer.id,
        status: "awaiting_approval" as const,
        channel: "email" as const,
        kind: "rate_alert_draft" as const,
        body: "Hi Sam,\n\nA quick update on your request.\n\nDana",
        source: "public_chat" as const,
      };
      const one = { ...base, id: generateId("act"), borrowerLeadId: first.id, subject: "Update one" };
      const two = { ...base, id: generateId("act"), borrowerLeadId: second.id, subject: "Update two" };
      saveCerebroAction(one);
      saveCerebroAction(two);

      const sent: string[] = [];
      await dispatchCerebroMessages(new Date(noon.getTime() + 120_000), async (input) => {
        sent.push(input.subject);
        // While the first email is on its way out, the second borrower unsubscribes.
        if (input.subject === "Update one") recordOptOutAllChannels(second.id, "test");
        return { sent: true };
      });
      assert.equal(sent.includes("Update one"), true);
      assert.equal(sent.includes("Update two"), false);
      assert.match(readDb().cerebroActions.find((item) => item.id === two.id)?.holdReason ?? "", /opted out/);
    });

    it("Cerebro does not send a nudge written before the booking, but still sends a rate alert", async () => {
      const noon = new Date("2026-11-18T20:00:00Z");
      const officer = addOfficer();
      const lead = addLead(officer.id, { zip: "93291", email: "booked@borrowermail.com" });
      const base = {
        createdAt: noon.toISOString(),
        updatedAt: noon.toISOString(),
        loId: officer.id,
        borrowerLeadId: lead.id,
        status: "awaiting_approval" as const,
        channel: "email" as const,
        subject: "Following up",
        body: "Hi Sam,\n\nWhat's a good time for a quick call?\n\nDana",
        source: "public_chat" as const,
      };
      const nudge = { ...base, id: generateId("act"), kind: "nudge_draft" as const };
      const alert = { ...base, id: generateId("act"), kind: "rate_alert_draft" as const, subject: "An update for you", body: "Hi Sam,\n\nA quick update on your request.\n\nDana" };
      saveCerebroAction(nudge);
      saveCerebroAction(alert);
      appendAppointment({
        id: generateId("appt"),
        borrowerLeadId: lead.id,
        loId: officer.id,
        createdAt: new Date(noon.getTime() + 60_000).toISOString(),
        start: new Date(noon.getTime() + 86400_000).toISOString(),
        end: new Date(noon.getTime() + 86400_000 + 1_800_000).toISOString(),
        status: "booked",
      });

      const sent: string[] = [];
      await dispatchCerebroMessages(new Date(noon.getTime() + 120_000), async (input) => {
        sent.push(input.subject);
        return { sent: true };
      });
      assert.deepEqual(sent, ["An update for you"]);
      const stored = readDb().cerebroActions.find((item) => item.id === nudge.id);
      assert.equal(stored?.status, "awaiting_approval");
      assert.match(stored?.holdReason ?? "", /booked a call/);
    });

    it("Cerebro emails also carry the sender's postal address", () => {
      const officer = addOfficer();
      const html = emailHtml("Hello", officer, "lead_x", true);
      assert.match(html, /YPN USA, 247 N L St, Dinuba, CA 93618/);
      assert.match(html, /Unsubscribe<\/a>/);
    });
  });
});
