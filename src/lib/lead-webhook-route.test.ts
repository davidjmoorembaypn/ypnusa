import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

process.env.LOANPILOT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-lead-webhook-"));
process.env.ADMIN_TOKEN = "test-admin-token";

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/webhooks/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("inbound lead webhook", async () => {
  const { POST } = await import("../app/api/webhooks/leads/route");
  const { readDb } = await import("./db");

  it("rejects callers without the configured secret", async () => {
    const response = await POST(request("null"));

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: "Unauthorized.",
      code: "UNAUTHORIZED",
    });
  });

  it("rejects non-object JSON with a structured client error", async () => {
    const response = await POST(
      request("null", { authorization: "Bearer test-admin-token" }),
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: "Request body must be a JSON object.",
      code: "INVALID_BODY",
    });
  });

  it("does not create a second lead when the same lead is delivered twice", async () => {
    const body = JSON.stringify({
      name: "Dee Duplicate",
      email: "dee.dup@example.com",
      phone: "559-555-0142",
      loanProgram: "FHA",
      timeline: "1_3_months",
      estimatedCreditBand: "670-739",
      contactConsent: true,
    });
    const auth = { authorization: "Bearer test-admin-token" };
    const first = await POST(request(body, auth));
    assert.equal(first.status, 201);
    const created = (await first.json()) as { data?: { borrowerLeadId?: string }; borrowerLeadId?: string };
    const firstId = created.data?.borrowerLeadId ?? created.borrowerLeadId;

    const second = await POST(request(body, auth));
    assert.equal(second.status, 200);
    const duplicate = (await second.json()) as { data?: { duplicate?: boolean; borrowerLeadId?: string }; duplicate?: boolean; borrowerLeadId?: string };
    assert.equal(duplicate.data?.duplicate ?? duplicate.duplicate, true);
    assert.equal(duplicate.data?.borrowerLeadId ?? duplicate.borrowerLeadId, firstId);

    const leads = readDb().borrowerLeads.filter((lead) => lead.answers.email === "dee.dup@example.com");
    assert.equal(leads.length, 1);
  });

  it("treats the same Idempotency-Key as one lead even if details differ", async () => {
    const auth = { authorization: "Bearer test-admin-token", "idempotency-key": "zap-123" };
    const make = (email: string) =>
      JSON.stringify({ name: "Kai Key", email, phone: "559-555-0143", loanProgram: "VA", timeline: "asap", estimatedCreditBand: "740+" });
    assert.equal((await POST(request(make("kai1@example.com"), auth))).status, 201);
    assert.equal((await POST(request(make("kai2@example.com"), auth))).status, 200);
  });
});
