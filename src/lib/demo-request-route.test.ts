import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, describe, it, mock } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-inquiry-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

describe("territory inquiry capture", async () => {
  const { POST, PATCH } = await import("../app/api/demo-request/route");
  const { readDb, writeDb, addDemoRequestDetails, DEMO_REQUEST_DETAILS_WINDOW_MS } = await import("./db");
  const { LEAD_MESSAGE_MAX_LENGTH } = await import("./lead-sources");
  afterEach(() => mock.restoreAll());
  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  function request() {
    return new Request("https://app.ypnus.com/api/demo-request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Officer", company: "Test", workEmail: "test@example.com", zip: "92672", consent: true }),
    });
  }

  it("uses live availability even for a ZIP marked claimed in demo seeds", async () => {
    mock.method(globalThis, "fetch", async () => Response.json({ available: true }));
    const response = await POST(request());
    const body = await response.json();
    assert.equal(body.territory.available, true);
    assert.match(body.message, /does not reserve a ZIP/);
    assert.equal(readDb().demoRequests.length, 1);
  });

  it("saves interest during an outage without claiming availability or activation", async () => {
    mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status: 503 }));
    const response = await POST(request());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.territory, null);
    assert.match(body.message, /does not reserve a ZIP/);
    assert.equal(readDb().demoRequests.length, 2);
  });

  function post(body: Record<string, unknown>, ip = "203.0.113.10") {
    return POST(new Request("https://app.ypnus.com/api/demo-request", {
      method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }));
  }
  function patch(body: Record<string, unknown>, ip = "203.0.113.20") {
    return PATCH(new Request("https://app.ypnus.com/api/demo-request", {
      method: "PATCH", headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }));
  }

  it("accepts the short form: name, email and consent, no company", async () => {
    mock.method(globalThis, "fetch", async () => Response.json({ available: true }));
    const response = await post({ name: "Short Form", workEmail: "short@example.com", zip: "93720", consent: true });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(typeof body.id, "string");
    const saved = readDb().demoRequests.find((item) => item.id === body.id);
    assert.equal(saved?.company, undefined);
    assert.equal(saved?.consent, true);
  });

  it("saves a long contact message whole, with nothing cut off", async () => {
    const message = `${"Line of a long note from a loan officer. ".repeat(100)}THE END`; // ~4,100 characters
    assert.ok(message.length > 4000 && message.length <= LEAD_MESSAGE_MAX_LENGTH);
    const response = await post({ name: "Long Note", workEmail: "long@example.com", message, source: "contact_page" }, "203.0.113.30");
    const body = await response.json();
    assert.equal(response.status, 200);
    const saved = readDb().demoRequests.find((item) => item.id === body.id);
    assert.equal(saved?.message, message);
  });

  it("refuses a message over the limit with a clear error instead of cutting it", async () => {
    const before = readDb().demoRequests.length;
    const response = await post(
      { name: "Too Long", workEmail: "toolong@example.com", message: "x".repeat(LEAD_MESSAGE_MAX_LENGTH + 1), source: "contact_page" },
      "203.0.113.31",
    );
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.code, "MESSAGE_TOO_LONG");
    assert.match(body.error, /shorten your message to 5,000 characters/);
    assert.equal(readDb().demoRequests.length, before);
  });

  it("still requires name and a valid email", async () => {
    const missing = await post({ workEmail: "x@example.com" }, "203.0.113.11");
    assert.equal(missing.status, 400);
    const badEmail = await post({ name: "A", workEmail: "not-an-email" }, "203.0.113.12");
    assert.equal(badEmail.status, 400);
  });

  it("adds optional step-2 details to a fresh inquiry without overwriting", async () => {
    mock.method(globalThis, "fetch", async () => Response.json({ available: true }));
    const created = await (await post({ name: "Step Two", workEmail: "step2@example.com", consent: true }, "203.0.113.13")).json();
    const ok = await patch({ id: created.id, company: "Acme Mortgage", monthlyLeadVolume: "2–5 loan officers" });
    assert.equal(ok.status, 200);
    const again = await patch({ id: created.id, company: "Other Co" }, "203.0.113.21");
    assert.equal(again.status, 200);
    const saved = readDb().demoRequests.find((item) => item.id === created.id);
    assert.equal(saved?.company, "Acme Mortgage");
    assert.equal(saved?.monthlyLeadVolume, "2–5 loan officers");
  });

  it("ignores unknown team sizes and rejects empty or unknown updates", async () => {
    const empty = await patch({ id: "demo_missing", monthlyLeadVolume: "500 people" }, "203.0.113.22");
    assert.equal(empty.status, 400);
    const unknown = await patch({ id: "demo_missing", company: "X" }, "203.0.113.23");
    assert.equal(unknown.status, 404);
  });

  it("refuses details for an inquiry older than the window", () => {
    writeDb((db) => {
      db.demoRequests.push({
        id: "demo_old", createdAt: new Date(Date.now() - DEMO_REQUEST_DETAILS_WINDOW_MS - 60_000).toISOString(),
        name: "Old", workEmail: "old@example.com", status: "new",
      });
    });
    assert.equal(addDemoRequestDetails("demo_old", { company: "Late Co" }), null);
  });

  it("reports whether step 2 filled anything in", () => {
    writeDb((db) => {
      db.demoRequests.push({ id: "demo_fresh", createdAt: new Date().toISOString(), name: "Fresh", workEmail: "fresh@example.com", status: "new" });
    });
    assert.equal(addDemoRequestDetails("demo_fresh", { company: "First Co" })?.changed, true);
    assert.equal(addDemoRequestDetails("demo_fresh", { company: "Second Co" })?.changed, false);
    assert.equal(readDb().demoRequests.find((item) => item.id === "demo_fresh")?.company, "First Co");
    assert.equal(readDb().demoRequests.find((item) => item.id === "demo_old")?.company, undefined);
  });
});
