import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.RESEND_API_KEY = "re_test_key";

import { sendEmail } from "./email";

describe("email attachments", () => {
  it("send plain-text attachments to Resend as Base64", async () => {
    const original = globalThis.fetch;
    let body: { attachments?: Array<{ content: string; filename: string; content_type?: string }> } = {};
    globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
      body = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    try {
      const ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n";
      const result = await sendEmail({
        to: "someone@borrowermail.com",
        subject: "Booked",
        html: "<p>Hi</p>",
        attachments: [{ filename: "invite.ics", content: ics, contentType: "text/calendar" }],
      });
      assert.equal(result.sent, true);
      const sent = body.attachments?.[0];
      assert.equal(sent?.filename, "invite.ics");
      assert.equal(sent?.content_type, "text/calendar");
      assert.equal(Buffer.from(sent!.content, "base64").toString("utf8"), ics);
    } finally {
      globalThis.fetch = original;
    }
  });
});
