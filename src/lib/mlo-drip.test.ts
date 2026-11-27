import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, beforeEach, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-mlo-drip-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
process.env.SESSION_SECRET = "test-secret-for-mlo-drip";

import { readDb, writeDb } from "./db";
import type { SendEmailInput } from "./email";
import {
  buildMloDripEmail,
  dueMloDripStep,
  MLO_DRIP_STEPS,
  mloDripEnabled,
  mloDripOneClickUrl,
  mloDripUnsubscribeUrl,
  processMloDrip,
  renderMloDripEmail,
  unsubscribeMloDrip,
} from "./mlo-drip";
import { getPricingTier, TRIAL_DAYS } from "./pricing";
import type { AccountRecord, MloDripEnrollmentRecord } from "./types";
import { unsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe-link";
import { DEMAND_ESTIMATE_LABEL } from "./zip-demand";

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse("2026-12-01T12:00:00.000Z");
const at = (days: number) => new Date(T0 + days * DAY);

let sent: SendEmailInput[] = [];
let failSends = false;
const send = async (input: SendEmailInput) => {
  if (failSends) return { sent: false, reason: "provider down" };
  sent.push(input);
  return { sent: true };
};
const run = (days: number) => processMloDrip({ now: at(days), send });

function account(email: string, overrides: Partial<AccountRecord> = {}) {
  writeDb((db) => {
    db.accounts.push({
      id: `acct_${email}`,
      email,
      role: "mlo",
      source: "email_signup",
      createdAt: at(0.5).toISOString(),
      lastLoginAt: at(0.5).toISOString(),
      ...overrides,
    });
  });
}
const enrollments = () => readDb().mloDrip.enrollments;
const enrollmentFor = (email: string) => enrollments().find((item) => item.email === email) as MloDripEnrollmentRecord;

describe("free-account email series for loan officers", () => {
  beforeEach(() => {
    sent = [];
    failSends = false;
    process.env.MLO_DRIP_ENABLED = "true";
    writeDb((db) => {
      db.accounts = [];
      db.mloDrip = { enrollments: [] };
      db.revenueSubscriptions = [];
      db.agentOnboarding = [];
    });
  });
  afterEach(() => {
    delete process.env.MLO_DRIP_ENABLED;
  });
  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  it("is off unless the server setting is exactly true", async () => {
    const env = (value?: string) => ({ MLO_DRIP_ENABLED: value }) as unknown as NodeJS.ProcessEnv;
    assert.equal(mloDripEnabled(env()), false);
    assert.equal(mloDripEnabled(env("1")), false);
    assert.equal(mloDripEnabled(env(" TRUE ")), true);

    delete process.env.MLO_DRIP_ENABLED;
    account("off@example.com");
    const summary = await run(5);
    assert.equal(summary.enabled, false);
    assert.equal(enrollments().length, 0);
    assert.equal(readDb().mloDrip.enabledAt, undefined);
    assert.equal(sent.length, 0);
  });

  it("never emails accounts that existed before it was switched on", async () => {
    account("old@example.com", { createdAt: at(-30).toISOString(), lastLoginAt: at(-30).toISOString() });
    await run(0);
    assert.equal(readDb().mloDrip.enabledAt, at(0).toISOString());
    await run(20);
    assert.equal(enrollments().length, 0);
    assert.equal(sent.length, 0);
  });

  it("enrolls only free accounts with a confirmed mailbox", async () => {
    await run(0);
    account("free@example.com");
    account("never-signed-in@example.com", { lastLoginAt: undefined });
    account("checkout@example.com", { source: "stripe_checkout" });
    account("boss@example.com", { role: "admin" });
    await run(1);
    assert.deepEqual(enrollments().map((item) => item.email), ["free@example.com"]);
  });

  it("sends the five emails on their days, one per run, then finishes", async () => {
    await run(0);
    account("free@example.com");
    const subjects: string[] = [];
    for (const day of [1.6, 3.6, 6.6, 10.6, 14.6]) {
      const before = sent.length;
      const summary = await run(day);
      assert.equal(summary.sent, 1, `day ${day}`);
      assert.equal(sent.length, before + 1);
      // Running again the same day sends nothing more.
      assert.equal((await run(day + 0.01)).sent, 0);
      subjects.push(sent[sent.length - 1].subject);
    }
    assert.equal(new Set(subjects).size, 5);
    assert.deepEqual(enrollmentFor("free@example.com").sent.map((item) => item.step), MLO_DRIP_STEPS.map((step) => step.id));
    await run(15);
    assert.equal(enrollmentFor("free@example.com").status, "completed");
    await run(40);
    assert.equal(sent.length, 5);
  });

  it("skips a step that is too late and never sends a burst", async () => {
    await run(0);
    account("late@example.com");
    // First run happens on day 12: days 1, 3 and 6 are stale; day 10 is still current.
    const summary = await run(12);
    assert.equal(summary.sent, 1);
    assert.equal(summary.skipped, 3);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].subject, buildMloDripEmail("day_10_plans").subject);
    assert.deepEqual(enrollmentFor("late@example.com").skipped, ["day_1_free_account", "day_3_exclusive_zip", "day_6_cerebro"]);
  });

  it("does not record a step as sent when the provider refuses it, and tries again", async () => {
    await run(0);
    account("retry@example.com");
    failSends = true;
    const failed = await run(1.6);
    assert.equal(failed.failed, 1);
    assert.deepEqual(enrollmentFor("retry@example.com").sent, []);
    assert.equal(enrollmentFor("retry@example.com").sending, undefined);
    failSends = false;
    assert.equal((await run(1.7)).sent, 1);
  });

  it("does not send a step another run has already claimed", async () => {
    await run(0);
    account("claimed@example.com");
    await run(0.6);
    writeDb((db) => {
      db.mloDrip.enrollments[0].sending = { step: "day_1_free_account", at: at(1.6).toISOString() };
    });
    assert.equal((await run(1.6 + 1 / 1440)).sent, 0);
    // An abandoned claim (the process died) is retried after the timeout.
    assert.equal((await run(1.6 + 30 / 1440)).sent, 1);
  });

  it("stops for someone who buys a plan or starts a trial", async () => {
    await run(0);
    account("buyer@example.com");
    await run(1.6);
    writeDb((db) => {
      db.revenueSubscriptions.push({
        id: "sub_1", createdAt: at(2).toISOString(), startedAt: at(2).toISOString(), tier: "growth", status: "trialing",
        source: "stripe_webhook", ownerEmail: "buyer@example.com", claimedZips: [],
      });
    });
    const summary = await run(3.6);
    assert.equal(summary.converted, 1);
    assert.equal(summary.sent, 0);
    assert.equal(enrollmentFor("buyer@example.com").status, "converted");
    await run(6.6);
    assert.equal(sent.length, 1);
  });

  it("unsubscribes with a signed link, for good, and leaves the account alone", async () => {
    await run(0);
    account("leaver@example.com");
    await run(1.6);
    const id = enrollmentFor("leaver@example.com").id;
    const token = new URL(mloDripUnsubscribeUrl(id)).searchParams.get("t") as string;

    assert.equal(unsubscribeMloDrip(id, "wrong-token"), "invalid");
    assert.equal(unsubscribeMloDrip("mdrip_unknown", token), "invalid");
    assert.equal(enrollmentFor("leaver@example.com").status, "active");

    assert.equal(unsubscribeMloDrip(id, token), "unsubscribed");
    assert.equal(enrollmentFor("leaver@example.com").status, "unsubscribed");
    await run(3.6);
    await run(6.6);
    assert.equal(sent.length, 1);
    // The same address is never enrolled a second time.
    assert.equal(enrollments().length, 1);
    assert.equal(readDb().accounts.some((item) => item.email === "leaver@example.com"), true);
  });

  it("never confirms an unsubscribe that did not reach the disk, and the same link works on a retry", async () => {
    await run(0);
    account("disk@example.com");
    await run(1.6);
    const id = enrollmentFor("disk@example.com").id;
    const token = new URL(mloDripUnsubscribeUrl(id)).searchParams.get("t") as string;
    const storePath = path.join(dataDir, "store.json");
    const onDisk = () =>
      (JSON.parse(fs.readFileSync(storePath, "utf8")) as { mloDrip: { enrollments: MloDripEnrollmentRecord[] } })
        .mloDrip.enrollments.find((item) => item.id === id)?.status;
    // A directory where the temp snapshot goes makes the disk write fail, as a full or read-only disk would.
    const blocker = `${storePath}.${process.pid}.tmp`;
    fs.mkdirSync(blocker);
    try {
      assert.equal(unsubscribeMloDrip(id, token), "not_saved");
      assert.equal(onDisk(), "active", "a restart from this file would bring the emails back, so nothing was confirmed");
    } finally {
      fs.rmSync(blocker, { recursive: true, force: true });
    }
    assert.equal(unsubscribeMloDrip(id, token), "unsubscribed");
    assert.equal(onDisk(), "unsubscribed", "the saved file is what a restart loads");
    // A bad link stays "invalid" even while the disk is failing: it never reads as "try again".
    fs.mkdirSync(blocker);
    try {
      assert.equal(unsubscribeMloDrip(id, "wrong-token"), "invalid");
      assert.equal(unsubscribeMloDrip("mdrip_unknown", token), "invalid");
    } finally {
      fs.rmSync(blocker, { recursive: true, force: true });
    }
  });

  it("keeps borrower unsubscribe links working and separate from these", () => {
    const borrowerToken = unsubscribeToken("lead_123");
    assert.equal(verifyUnsubscribeToken("lead_123", borrowerToken), true);
    // A borrower's token cannot unsubscribe a loan officer, and the other way round.
    assert.equal(unsubscribeMloDrip("lead_123", borrowerToken), "invalid");
    const officerToken = new URL(mloDripUnsubscribeUrl("mdrip_abc")).searchParams.get("t") as string;
    assert.equal(verifyUnsubscribeToken("mdrip_abc", officerToken), false);
  });

  it("puts an unsubscribe link, the one-click headers and the postal address on every email", async () => {
    await run(0);
    account("headers@example.com");
    await run(1.6);
    const id = enrollmentFor("headers@example.com").id;
    const message = sent[0];
    assert.equal(message.to, "headers@example.com");
    assert.equal(message.headers?.["List-Unsubscribe"], `<${mloDripOneClickUrl(id)}>`);
    assert.equal(message.headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
    assert.ok(message.html.includes(mloDripUnsubscribeUrl(id).replace(/&/g, "&amp;")));
    assert.match(message.html, /247 N L Street, Dinuba, CA 93618/);
    assert.match(message.html, /You are getting this because you opened a free YPN USA account/);
  });

  it("orders the steps by day and knows when nothing is due", () => {
    const enrollment: MloDripEnrollmentRecord = { id: "mdrip_x", email: "x@example.com", enrolledAt: at(0).toISOString(), sent: [], skipped: [], status: "active" };
    assert.deepEqual(dueMloDripStep(enrollment, at(0.5)), { step: null, skip: [], finished: false });
    assert.equal(dueMloDripStep(enrollment, at(1)).step, "day_1_free_account");
    assert.deepEqual(MLO_DRIP_STEPS.map((step) => step.afterDays), [1, 3, 6, 10, 14]);
  });
});

describe("the wording of the series", () => {
  const FORBIDDEN = [
    /\d+(\.\d+)?\s*%/,
    /\bguarantee/i,
    /\b(act now|hurry|last chance|limited[\s-]time|only \d+ left|running out|before it'?s gone)\b/i,
    /other (loan officers|mlos|people) (are|were) (looking|searching|viewing)/i,
    /life-event/i,
    /—/,
  ];
  const text = (step: Parameters<typeof buildMloDripEmail>[0], zip?: string) => {
    const email = buildMloDripEmail(step, { zip });
    return [email.subject, ...email.blocks.flatMap((block) => ("p" in block ? [block.p] : "list" in block ? block.list : [block.link.label]))];
  };

  it("makes no promise, no countdown and no claim about features that are not built", () => {
    for (const step of MLO_DRIP_STEPS) {
      for (const line of text(step.id, "93618")) {
        // The estimate's own disclaimer says it is "not ... a guarantee"; that sentence is required, not a promise.
        const checked = line.replace(DEMAND_ESTIMATE_LABEL, "");
        for (const pattern of FORBIDDEN) assert.doesNotMatch(checked, pattern, `${step.id}: ${line}`);
      }
    }
  });

  it("takes prices and the trial length from the pricing file", () => {
    const plans = text("day_10_plans").join("\n");
    for (const id of ["growth", "pro", "elite"] as const) {
      const tier = getPricingTier(id);
      assert.ok(plans.includes(`${tier.name}, ${tier.price} a month`), `${tier.name} missing`);
    }
    assert.ok(plans.includes(`${TRIAL_DAYS}-day trial`));
    assert.ok(text("day_3_exclusive_zip").join("\n").includes(`${TRIAL_DAYS}-day trial`));
  });

  it("says the trial does not lock the ZIP code wherever the trial is mentioned", () => {
    for (const step of MLO_DRIP_STEPS) {
      const body = text(step.id).join("\n");
      if (/trial/i.test(body)) assert.match(body, /does not lock/i, step.id);
    }
  });

  it("only talks about a ZIP code it was given, with the estimate label", () => {
    const without = text("day_3_exclusive_zip").join("\n");
    assert.doesNotMatch(without, /\b\d{5}\b/);
    const withZip = text("day_3_exclusive_zip", "93618").join("\n");
    assert.match(withZip, /When this email was sent, ZIP code 93618 was not held by anyone/);
    assert.match(withZip, /Not a lead count, a forecast or a guarantee|Illustrative market estimate/);
    assert.doesNotMatch(text("day_3_exclusive_zip", "not-a-zip").join("\n"), /not-a-zip/);
    // Five digits that are not a real ZIP code: nothing is said about it.
    assert.doesNotMatch(text("day_3_exclusive_zip", "00000").join("\n"), /00000|not held by anyone/);
  });

  it("escapes what it renders", () => {
    const html = renderMloDripEmail({ subject: "s", blocks: [{ p: "<script>alert(1)</script>" }] }, "mdrip_x");
    assert.doesNotMatch(html, /<script>/);
  });
});
