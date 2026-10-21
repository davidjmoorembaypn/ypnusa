import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeHtml } from "./email";

describe("email.ts — escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    assert.equal(
      escapeHtml(`<script>alert('x')</script> & "quoted"`),
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; &quot;quoted&quot;",
    );
  });

  it("leaves plain text untouched", () => {
    assert.equal(escapeHtml("David J. Moore, MBA"), "David J. Moore, MBA");
  });
});

describe("email.ts — sendEmail without RESEND_API_KEY configured", () => {
  it("degrades to a no-op instead of throwing", async () => {
    const original = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      // Re-import isn't needed: getClient() re-reads process.env lazily only
      // the first time it's called per module instance, but in this fresh
      // test-runner process no prior call has primed it yet.
      const { sendEmail } = await import("./email");
      const result = await sendEmail({ to: "test@example.com", subject: "Test", html: "<p>hi</p>" });
      assert.equal(result.sent, false);
      assert.match(result.reason ?? "", /RESEND_API_KEY/);
    } finally {
      if (original !== undefined) process.env.RESEND_API_KEY = original;
    }
  });
});
