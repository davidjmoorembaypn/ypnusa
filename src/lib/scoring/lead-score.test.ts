import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BorrowerAnswers, ChatMessageRecord } from "../types";
import { bandForScore, scoreLead, type LeadScoreInput } from "./lead-score";

const NOW = new Date("2026-11-16T12:00:00Z");

function lead(answers: Partial<BorrowerAnswers>, extra: Partial<LeadScoreInput["lead"]> = {}): LeadScoreInput["lead"] {
  return {
    createdAt: "2026-11-16T08:00:00Z",
    answers: { loanProgram: "FHA", ...answers } as BorrowerAnswers,
    ...extra,
  };
}

function chat(userMessages: number): { messages: ChatMessageRecord[] } {
  const messages: ChatMessageRecord[] = [];
  for (let i = 0; i < userMessages; i += 1) {
    messages.push({ id: `u${i}`, role: "user", content: "hi", createdAt: NOW.toISOString() });
    messages.push({ id: `a${i}`, role: "assistant", content: "hello", createdAt: NOW.toISOString() });
  }
  return { messages };
}

describe("scoreLead", () => {
  it("scores a ready, reachable, engaged borrower as hot with reasons largest first", () => {
    const result = scoreLead({
      lead: lead(
        {
          timeline: "lt_30",
          phone: "5595550100",
          email: "sam@example.com",
          contactConsent: true,
          estimatedCreditBand: "740-850",
          estimatedDownPaymentUsd: 20000,
          purchaseRefiIntent: "purchase",
        },
        { prequalRequest: { requestedAt: NOW.toISOString(), docsReady: ["paystubs"] } },
      ),
      chat: chat(7),
      hasAppointment: true,
      now: NOW,
    });
    assert.equal(result.score, 100);
    assert.equal(result.band, "hot");
    assert.equal(result.reasons[0].label, "Wants to move in under 30 days");
    for (let i = 1; i < result.reasons.length; i += 1) {
      assert.ok(result.reasons[i - 1].points >= result.reasons[i].points);
    }
  });

  it("scores a cold, old lead low", () => {
    const result = scoreLead({
      lead: lead({ timeline: "6_plus" }, { createdAt: "2026-08-01T00:00:00Z" }),
      now: NOW,
    });
    assert.equal(result.score, 3);
    assert.equal(result.band, "nurture");
  });

  it("is deterministic", () => {
    const input: LeadScoreInput = { lead: lead({ timeline: "1_3_months", email: "a@b.co", contactConsent: true }), chat: chat(3), now: NOW };
    assert.deepEqual(scoreLead(input), scoreLead(input));
  });

  it("gives little for contact details without consent", () => {
    const withConsent = scoreLead({ lead: lead({ phone: "5595550100", contactConsent: true }), now: NOW });
    const without = scoreLead({ lead: lead({ phone: "5595550100" }), now: NOW });
    assert.ok(withConsent.score > without.score);
    assert.ok(without.reasons.some((reason) => reason.label.includes("no consent")));
  });

  it("ignores ZIP code, name, veteran status and income", () => {
    const base = scoreLead({ lead: lead({ timeline: "1_3_months" }), now: NOW });
    const other = scoreLead({
      lead: lead({ timeline: "1_3_months", zip: "93277", name: "Sam Lee", veteranStatus: "yes", annualIncomeUsd: 250000 }),
      now: NOW,
    });
    assert.deepEqual(other, base);
  });

  it("caps engagement at 20 points", () => {
    const result = scoreLead({
      lead: lead({}, {
        prequalRequest: { requestedAt: NOW.toISOString() },
        rateAlerts: { channel: "email", optedInAt: NOW.toISOString() },
      }),
      chat: chat(10),
      now: NOW,
    });
    const engagement = result.reasons
      .filter((r) => /chat|prequal|rate alerts/i.test(r.label))
      .reduce((total, r) => total + r.points, 0);
    assert.equal(engagement, 20);
  });

  it("does not credit a down payment on a refinance", () => {
    const result = scoreLead({ lead: lead({ purchaseRefiIntent: "refinance", estimatedDownPaymentUsd: 5000 }), now: NOW });
    assert.ok(!result.reasons.some((reason) => reason.label.includes("down payment")));
  });

  it("bands at 70 and 45", () => {
    assert.equal(bandForScore(70), "hot");
    assert.equal(bandForScore(69), "warm");
    assert.equal(bandForScore(45), "warm");
    assert.equal(bandForScore(44), "nurture");
  });
  it("counts a down payment only when the borrower names an amount above zero", async () => {
    const { statesDownPayment } = await import("./lead-score");
    for (const text of ["5%, from savings", "$20k", "about 40,000"]) assert.equal(statesDownPayment(text), true, text);
    for (const text of ["not sure", "0", "$0", "none yet", "gift from parents", "", undefined]) {
      assert.equal(statesDownPayment(text), false, String(text));
    }
  });
});
