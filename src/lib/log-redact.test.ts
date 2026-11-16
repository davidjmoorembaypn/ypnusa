import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { installConsoleRedaction, redact, redactLogArg } from "./log-redact";

describe("log redaction", () => {
  it("masks emails, phones, SSNs and long account numbers", () => {
    const line = redact(
      "lead jane.doe+1@example.com called (559) 555-0100 / 559.555.0101, ssn 123-45-6789, acct 4111 1111 1111 1111",
    );
    assert.ok(!line.includes("jane.doe"));
    assert.ok(!line.includes("555-0100") && !line.includes("555.0101"));
    assert.ok(!line.includes("123-45-6789"));
    assert.ok(!line.includes("4111"));
    assert.ok(line.includes("[email]") && line.includes("[phone]") && line.includes("[ssn]"));
  });

  it("masks tokens and keys", () => {
    const line = redact('Authorization: Bearer abcdefghijklmnop token=supersecretvalue {"api_key":"k_123456789"} sk_live_abcdefgh12345');
    assert.ok(!line.includes("abcdefghijklmnop"));
    assert.ok(!line.includes("supersecretvalue"));
    assert.ok(!line.includes("k_123456789"));
    assert.ok(!line.includes("sk_live_abcdefgh12345"));
  });

  it("keeps ordinary log text readable", () => {
    assert.equal(redact("[db] wrote snapshot in 12ms for lead_abc123 on 2026-11-16"), "[db] wrote snapshot in 12ms for lead_abc123 on 2026-11-16");
  });

  it("redacts Error messages and stacks, and objects", () => {
    const fromError = String(redactLogArg(new Error("Twilio rejected +15595550100")));
    assert.ok(fromError.includes("Error") && !fromError.includes("5595550100"));
    const fromObject = String(redactLogArg({ body: { email: "a@b.co" } }));
    assert.ok(!fromObject.includes("a@b.co"));
  });

  it("wraps console methods so every argument is redacted", () => {
    const lines: unknown[][] = [];
    const fake = {
      log: (...args: unknown[]) => lines.push(args),
      info: (...args: unknown[]) => lines.push(args),
      warn: (...args: unknown[]) => lines.push(args),
      error: (...args: unknown[]) => lines.push(args),
      debug: (...args: unknown[]) => lines.push(args),
    };
    installConsoleRedaction(fake);
    fake.error("[api] failed for", "x@y.com", 42);
    assert.deepEqual(lines[0], ["[api] failed for", "[email]", 42]);
  });
});
