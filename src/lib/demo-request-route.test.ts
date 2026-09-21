import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, describe, it, mock } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-inquiry-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

describe("territory inquiry capture", async () => {
  const { POST } = await import("../app/api/demo-request/route");
  const { readDb } = await import("./db");
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
});
