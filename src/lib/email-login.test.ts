import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { consumeLoginToken, issueLoginToken, safeNextPath, LOGIN_TOKENS_PER_HOUR, LOGIN_TOKEN_TTL_MS } from "./email-login";
import { readDb } from "./db";
import { describe, it, before } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypnus-email-login-"));
process.env.LOANPILOT_DATA_DIR = dataDir;


describe("email sign-in links", () => {
  before(() => {
    assert.equal(readDb().loginTokens.length, 0);
  });

  it("issues a token, stores only its hash, and consumes it exactly once", () => {
    const issued = issueLoginToken("  Jordan@Example.com ", "/portal/nurture");
    assert.ok(issued.ok);
    if (!issued.ok) return;
    assert.equal(issued.email, "jordan@example.com");
    const stored = readDb().loginTokens.at(-1);
    assert.ok(stored);
    assert.notEqual(stored?.tokenHash, issued.token);
    assert.ok(!JSON.stringify(readDb().loginTokens).includes(issued.token), "raw token must never be stored");

    const first = consumeLoginToken(issued.token);
    assert.deepEqual(first, { ok: true, email: "jordan@example.com", next: "/portal/nurture" });
    assert.deepEqual(consumeLoginToken(issued.token), { ok: false, code: "USED_TOKEN" });
  });

  it("rejects expired and unknown tokens", () => {
    const issued = issueLoginToken("late@example.com", undefined);
    assert.ok(issued.ok);
    if (!issued.ok) return;
    assert.deepEqual(consumeLoginToken(issued.token, Date.now() + LOGIN_TOKEN_TTL_MS + 1), { ok: false, code: "EXPIRED_TOKEN" });
    assert.deepEqual(consumeLoginToken("x".repeat(43)), { ok: false, code: "INVALID_TOKEN" });
    assert.deepEqual(consumeLoginToken(undefined), { ok: false, code: "INVALID_TOKEN" });
  });

  it("rate-limits links per email per hour", () => {
    for (let i = 0; i < LOGIN_TOKENS_PER_HOUR; i += 1) {
      assert.ok(issueLoginToken("busy@example.com", "/dashboard").ok);
    }
    assert.deepEqual(issueLoginToken("busy@example.com", "/dashboard"), { ok: false, code: "RATE_LIMITED" });
  });

  it("rejects malformed emails", () => {
    assert.deepEqual(issueLoginToken("not-an-email", "/dashboard"), { ok: false, code: "INVALID_EMAIL" });
  });

  it("only allows same-site app paths after sign-in", () => {
    assert.equal(safeNextPath("/dashboard/leads"), "/dashboard/leads");
    assert.equal(safeNextPath("//evil.example"), "/dashboard");
    assert.equal(safeNextPath("https://evil.example"), "/dashboard");
    assert.equal(safeNextPath("/\\evil.example"), "/dashboard");
    assert.equal(safeNextPath("/pricing"), "/dashboard");
  });
});
