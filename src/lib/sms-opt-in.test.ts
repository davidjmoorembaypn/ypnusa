import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it, mock } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-sms-opt-in-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

describe("loan officer text opt-in", async () => {
  const { normalizeOptInPhone, validateSmsOptIn, SMS_OPT_IN_ERRORS } = await import("./sms-opt-in");
  const { LO_SMS_CONSENT_STATEMENT, LO_SMS_CONSENT_DISCLOSURE, LO_SMS_CONSENT_TEXT } = await import("./sms-program");
  const { hasLoanOfficerSmsOptIn, LO_SMS_OPT_IN_SOURCE } = await import("./sms-opt-in-store");
  const { handleInboundSms } = await import("./sms-inbound");
  const { readDb } = await import("./db");
  const { POST } = await import("../app/api/sms-opt-in/route");
  const { SmsOptInForm } = await import("../components/sms-opt-in-form");
  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  let ip = 0;
  function post(body: unknown) {
    ip += 1;
    return POST(
      new Request("https://ypnus.com/api/sms-opt-in", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": `198.51.100.${ip}` },
        body: JSON.stringify(body),
      }),
    );
  }

  describe("phone number check", () => {
    it("accepts the usual US formats and returns 10 digits", () => {
      for (const typed of ["(559) 512-0372", "559-512-0372", "559.512.0372", "5595120372", "+1 559 512 0372", "1-559-512-0372"]) {
        assert.equal(normalizeOptInPhone(typed), "5595120372", typed);
      }
    });

    it("refuses numbers that are too short, too long, not US, or contain letters", () => {
      for (const typed of ["", "512-0372", "559512037", "55951203721", "+44 20 7946 0958", "+47 923 45 678", "+559 512 0372", "559+512+0372", "559-512-03ab", "(059) 512-0372", "(559) 112-0372", 5595120372, undefined]) {
        assert.equal(normalizeOptInPhone(typed), null, String(typed));
      }
    });
  });

  describe("form rules", () => {
    it("needs the consent box ticked: only true counts", () => {
      for (const consent of [false, undefined, "true", "on", 1, null]) {
        const result = validateSmsOptIn({ phone: "(559) 512-0372", consent });
        assert.equal(result.ok, false, String(consent));
        if (!result.ok) assert.equal(result.errors.consent, SMS_OPT_IN_ERRORS.consent);
      }
    });

    it("needs a valid phone number even when the box is ticked", () => {
      const result = validateSmsOptIn({ phone: "555-1234", consent: true });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.errors.phone, SMS_OPT_IN_ERRORS.phone);
        assert.equal(result.errors.consent, undefined);
      }
    });

    it("passes with a valid number and the box ticked; the name is optional and tidied", () => {
      assert.deepEqual(validateSmsOptIn({ phone: "559 512 0372", consent: true }), { ok: true, value: { phone: "5595120372" } });
      assert.deepEqual(validateSmsOptIn({ name: "  Lee   Home Loans ", phone: "559 512 0372", consent: true }), {
        ok: true,
        value: { phone: "5595120372", name: "Lee Home Loans" },
      });
    });

    it("refuses an overly long name", () => {
      const result = validateSmsOptIn({ name: "x".repeat(121), phone: "5595120372", consent: true });
      assert.equal(result.ok, false);
    });
  });

  describe("the page's form", () => {
    const html = renderToStaticMarkup(createElement(SmsOptInForm));

    it("posts its fields in the request body, never in the page address", () => {
      assert.match(html, /<form[^>]*method="post"/);
    });

    it("renders the consent box unchecked", () => {
      const checkbox = html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0];
      assert.ok(checkbox, "consent checkbox is on the form");
      assert.doesNotMatch(checkbox, /\bchecked\b/);
    });

    it("shows both disclosure sentences word for word, beside the box", () => {
      assert.equal(
        LO_SMS_CONSENT_STATEMENT,
        "By checking this box and submitting this form, I agree to receive SMS text messages from YPN USA regarding account notifications, borrower lead alerts, ZIP code territory lock updates, subscription alerts, and Cerebro AI assistant messages.",
      );
      assert.equal(
        LO_SMS_CONSENT_DISCLOSURE,
        "Consent is not a condition of purchase or registration. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for support at any time.",
      );
      assert.ok(html.includes(LO_SMS_CONSENT_STATEMENT));
      assert.ok(html.includes(LO_SMS_CONSENT_DISCLOSURE));
    });

    it("links the Privacy Policy and Terms of Service next to the consent box", () => {
      const fieldset = html.match(/<fieldset[\s\S]*?<\/fieldset>/)?.[0] ?? "";
      assert.match(fieldset, /<a[^>]*href="\/privacy-policy"[^>]*>Privacy Policy<\/a>/);
      assert.match(fieldset, /<a[^>]*href="\/terms-of-service"[^>]*>Terms of Service<\/a>/);
    });

    it("never says Young Professionals Network", () => {
      assert.doesNotMatch(html, /young professional/i);
    });
  });

  describe("saving an opt-in", () => {
    it("refuses a submit without the box ticked and saves nothing", async () => {
      const response = await post({ name: "Jordan Lee", phone: "(559) 512-0372", consent: false });
      assert.equal(response.status, 400);
      const body = await response.json();
      assert.equal(body.code, "CONSENT_REQUIRED");
      assert.equal(readDb().smsOptIns.length, 0);
    });

    it("refuses a bad phone number and saves nothing", async () => {
      const response = await post({ phone: "12345", consent: true });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, "INVALID_PHONE");
      assert.equal(readDb().smsOptIns.length, 0);
    });

    it("saves the number, time and exact wording shown when the box is ticked", async () => {
      const response = await post({ name: "Jordan Lee", phone: "(559) 512-0372", consent: true });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.ok, true);
      assert.match(body.message, /\(559\) 512-0372/);
      const [record] = readDb().smsOptIns;
      assert.equal(record.phone, "5595120372");
      assert.equal(record.name, "Jordan Lee");
      assert.equal(record.granted, true);
      assert.equal(record.source, LO_SMS_OPT_IN_SOURCE);
      assert.equal(record.textShown, LO_SMS_CONSENT_TEXT);
      assert.ok(!Number.isNaN(Date.parse(record.at)));
      assert.equal(hasLoanOfficerSmsOptIn(readDb(), "5595120372"), true);
    });

    it("a STOP reply from that number turns the opt-in off, and START turns it back on", () => {
      handleInboundSms({ from: "+15595120372", body: "STOP", messageSid: "SM_stop_1" });
      assert.equal(hasLoanOfficerSmsOptIn(readDb(), "5595120372"), false);
      handleInboundSms({ from: "+15595120372", body: "START", messageSid: "SM_start_1" });
      assert.equal(hasLoanOfficerSmsOptIn(readDb(), "5595120372"), true);
    });

    it("a web submission after a STOP does not turn texts back on; only START from the phone does", async () => {
      handleInboundSms({ from: "+15595120372", body: "STOP", messageSid: "SM_stop_3" });
      assert.equal(hasLoanOfficerSmsOptIn(readDb(), "5595120372"), false);
      const response = await post({ phone: "(559) 512-0372", consent: true });
      assert.equal(response.status, 200);
      assert.match((await response.json()).message, /reply START from that phone/);
      assert.equal(hasLoanOfficerSmsOptIn(readDb(), "5595120372"), false);
      handleInboundSms({ from: "+15595120372", body: "START", messageSid: "SM_start_3" });
      assert.equal(hasLoanOfficerSmsOptIn(readDb(), "5595120372"), true);
    });

    it("tells the visitor it failed, and keeps nothing, when the data file can't be written", async () => {
      const before = readDb().smsOptIns.length;
      // The next write of the data file fails once (a full disk, say); later writes work again.
      const failing = mock.method(fs, "renameSync", () => {
        throw new Error("ENOSPC: no space left on device");
      }, { times: 1 });
      try {
        const response = await post({ phone: "(559) 555-0100", consent: true });
        assert.equal(response.status, 503);
        assert.equal((await response.json()).code, "SMS_OPT_IN_FAILED");
        assert.equal(readDb().smsOptIns.length, before);
      } finally {
        failing.mock.restore();
      }
      const retry = await post({ phone: "(559) 555-0100", consent: true });
      assert.equal(retry.status, 200);
      assert.equal(readDb().smsOptIns.length, before + 1);
    });

    it("a STOP from a number that never opted in here adds nothing", () => {
      const before = readDb().smsOptIns.length;
      handleInboundSms({ from: "+15592220000", body: "STOP", messageSid: "SM_stop_2" });
      assert.equal(readDb().smsOptIns.length, before);
    });
  });
});
