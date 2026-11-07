import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-visibility-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

describe("Local Visibility Score", async () => {
  const { computeVisibilityScore } = await import("./visibility-score");
  const { writeDb } = await import("./db");
  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  it("starts at 0% and never scores coming-soon steps", () => {
    const score = computeVisibilityScore({ userId: "acct_new", email: "new@example.com" });
    assert.equal(score.percent, 0);
    assert.ok(score.steps.some((step) => step.comingSoon));
    assert.equal(score.totalCount, score.steps.filter((step) => !step.comingSoon).length);
  });

  it("counts a paid ZIP code lock and a Cerebro-drafted Google Business Profile", () => {
    writeDb((db) => {
      db.revenueSubscriptions.push({
        id: "sub_1",
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        tier: "growth",
        status: "active",
        source: "stripe_webhook",
        ownerEmail: "lo@example.com",
        claimedZips: ["93720"],
      });
    });
    const before = computeVisibilityScore({ userId: "acct_lo", email: "lo@example.com" });
    assert.equal(before.steps.find((step) => step.id === "zip")?.done, true);
    const gbpPrompt = before.steps.find((step) => step.id === "gbp-draft")!.cerebroPrompt!;
    writeDb((db) => {
      db.chatSessions.push({
        id: "chat_1",
        mode: "mlo_dashboard",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: "acct_lo",
        messages: [{ id: "m1", role: "user", content: gbpPrompt, createdAt: new Date().toISOString() }],
        capturedFields: {},
        status: "active",
      });
    });
    const afterAsk = computeVisibilityScore({ userId: "acct_lo", email: "lo@example.com" });
    assert.equal(afterAsk.steps.find((step) => step.id === "gbp-draft")?.done, true);
    assert.equal(afterAsk.steps.find((step) => step.id === "cerebro")?.done, true);
    assert.ok(afterAsk.percent > before.percent);
  });
});
