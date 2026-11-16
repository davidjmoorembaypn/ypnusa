import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import type { BorrowerLeadRecord, CrmLeadRecord } from "../../types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-crm-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
for (const key of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "AI_PROVIDER", "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) {
  delete process.env[key];
}

const OFFICER = "acct_crm_officer";
const OTHER = "acct_crm_other";
const HOOK = "https://hooks.zapier.com/hooks/catch/123/abc/";

function lead(id: string, assignedLoId = OFFICER): BorrowerLeadRecord {
  return {
    id,
    createdAt: new Date().toISOString(),
    answers: {
      loanProgram: "FHA",
      name: "Sam Rivera",
      email: "sam.rivera@example.com",
      phone: "5595550199",
      zip: "93277",
      contactConsent: true,
      timeline: "lt_30",
      estimatedCreditBand: "660-699",
      annualIncomeUsd: 88_000,
    },
    qualification: {
      programScores: { overallScore: 80 },
      leadQuality: "strong",
      urgency: "critical",
      recommendedNextStep: "Call today.",
      rationale: [],
    },
    assignedLoId,
    crmLeadId: `crm_${id}`,
  } as BorrowerLeadRecord;
}

function crmRow(id: string, assignedLoId = OFFICER): CrmLeadRecord {
  return {
    id: `crm_${id}`,
    createdAt: new Date().toISOString(),
    borrowerLeadId: id,
    assignedLoId,
    status: "new_ai_routed",
    notes: [],
    qualificationSnapshot: lead(id).qualification,
  };
}

describe("CRM link (upgrade 2)", async () => {
  const { writeDb, readDb } = await import("../../db");
  const safety = await import("./url-safety");
  const link = await import("./link");
  const inbound = await import("./inbound");
  const { notifyAssignedOfficer } = await import("../../notifications");
  const { PII_FIELDS } = await import("../../crypto/pii-snapshot");

  type Call = { url: string; headers: Record<string, string>; body: string; redirect?: string };
  const calls: Call[] = [];
  let respondWith: number | (() => never) = 200;
  let resolvesTo = "52.1.2.3";

  beforeEach(() => {
    calls.length = 0;
    respondWith = 200;
    resolvesTo = "52.1.2.3";
    safety.setDnsLookupForTests(async () => [{ address: resolvesTo }]);
    link.setCrmRetryTimersForTests(false);
    link.setCrmFetchForTests(async (url, init) => {
      calls.push({ url, headers: init.headers as Record<string, string>, body: String(init.body), redirect: init.redirect });
      if (typeof respondWith === "function") respondWith();
      return { status: respondWith as number };
    });
    writeDb((db) => {
      db.crmConnections = [];
      db.crmDeliveries = [];
      db.borrowerLeads = [lead("lead_a"), lead("lead_b"), lead("lead_other", OTHER)];
      db.crmLeads = [crmRow("lead_a"), crmRow("lead_b"), crmRow("lead_other", OTHER)];
      db.loAlerts = [];
      db.processedKeys = [];
    });
  });

  after(() => {
    safety.setDnsLookupForTests(null);
    link.setCrmFetchForTests(null);
    link.setCrmRetryTimersForTests(true);
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  async function connect() {
    const result = await link.connectCrm(OFFICER, HOOK);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error("connect failed");
    return result;
  }

  describe("address safety", () => {
    it("accepts a public https address", () => {
      assert.equal(safety.checkOutboundUrl(HOOK).ok, true);
    });

    it("rejects http, credentials, odd ports, localhost and private addresses", () => {
      for (const bad of [
        "http://hooks.zapier.com/x",
        "https://user:pass@hooks.zapier.com/x",
        "https://hooks.zapier.com:8443/x",
        "https://localhost/x",
        "https://127.0.0.1/x",
        "https://169.254.169.254/latest/meta-data",
        "https://10.0.0.5/x",
        "https://[::1]/x",
        "https://[::ffff:192.168.1.1]/x",
        "https://metadata.internal/x",
        "https://intranet/x",
        "not a url",
        42,
      ]) {
        assert.equal(safety.checkOutboundUrl(bad).ok, false, String(bad));
      }
    });

    it("refuses a public name that resolves to a private address", async () => {
      resolvesTo = "10.1.2.3";
      const result = await link.connectCrm(OFFICER, HOOK);
      assert.equal(result.ok, false);
      assert.equal(readDb().crmConnections.length, 0);
    });

    it("classifies addresses", () => {
      assert.equal(safety.isPrivateAddress("172.20.1.1"), true);
      assert.equal(safety.isPrivateAddress("172.32.1.1"), false);
      assert.equal(safety.isPrivateAddress("100.64.0.1"), true);
      assert.equal(safety.isPrivateAddress("fd00::1"), true);
      assert.equal(safety.isPrivateAddress("2606:4700::1111"), false);
      assert.equal(safety.isPrivateAddress("8.8.8.8"), false);
    });
  });

  describe("connecting", () => {
    it("keeps the address and signing secret in encrypted fields and only a hash of the token", async () => {
      const result = await connect();
      assert.deepEqual([...PII_FIELDS.crmConnections], ["outboundUrl", "signingSecret"]);
      const stored = readDb().crmConnections[0];
      assert.equal(stored.inboundTokenHash, link.hashInboundToken(result.inboundToken));
      assert.equal(JSON.stringify(stored).includes(result.inboundToken), false);
      const view = link.crmConnectionView(OFFICER);
      assert.equal(view.outboundHost, "hooks.zapier.com");
      assert.equal(JSON.stringify(view).includes("catch/123"), false);
      assert.equal(JSON.stringify(view).includes(result.signingSecret), false);
    });

    it("replacing the link retires the old token", async () => {
      const first = await connect();
      await connect();
      assert.equal(readDb().crmConnections.length, 1);
      assert.equal(inbound.authenticateInbound(first.connectionId, first.inboundToken), null);
    });

    it("disconnecting stops new leads going out", async () => {
      await connect();
      link.disconnectCrm(OFFICER);
      assert.equal(link.queueCrmEvent(OFFICER, "lead.created", "lead_a"), null);
      assert.equal(link.crmConnectionView(OFFICER).connected, false);
    });
  });

  describe("sending leads out", () => {
    it("sends a signed lead.created event once when a new lead is routed", async () => {
      const { signingSecret } = await connect();
      const payload = { loId: OFFICER, borrowerLeadId: "lead_a", loanProgram: "FHA" as const, answers: lead("lead_a").answers, qualification: lead("lead_a").qualification };
      notifyAssignedOfficer(payload);
      notifyAssignedOfficer(payload);
      await settle();
      assert.equal(calls.length, 1);
      const call = calls[0];
      assert.equal(call.url, HOOK);
      assert.equal(call.redirect, "manual");
      const event = JSON.parse(call.body);
      assert.equal(event.event, "lead.created");
      assert.equal(event.lead.id, "lead_a");
      assert.equal(event.lead.email, "sam.rivera@example.com");
      assert.equal(event.lead.contactConsent, true);
      assert.equal(typeof event.lead.leadScore, "number");
      assert.equal("annualIncomeUsd" in event.lead, false);
      assert.equal(call.headers["X-YPN-Event-Id"], event.eventId);

      const signature = call.headers[link.CRM_SIGNATURE_HEADER];
      const match = signature.match(/^t=(\d+),v1=([0-9a-f]{64})$/);
      assert.ok(match);
      const expected = crypto.createHmac("sha256", signingSecret).update(`${match[1]}.${call.body}`).digest("hex");
      assert.equal(match[2], expected);
      assert.equal(readDb().crmDeliveries[0].status, "sent");
    });

    it("does nothing for an officer with no CRM link", async () => {
      notifyAssignedOfficer({ loId: OFFICER, borrowerLeadId: "lead_a", loanProgram: "FHA", answers: lead("lead_a").answers, qualification: lead("lead_a").qualification });
      await settle();
      assert.equal(calls.length, 0);
      assert.equal(readDb().crmDeliveries.length, 0);
    });

    it("stores no borrower details in the delivery record", async () => {
      await connect();
      link.queueCrmEvent(OFFICER, "lead.created", "lead_a");
      await settle();
      const stored = JSON.stringify(readDb().crmDeliveries);
      assert.equal(stored.includes("sam.rivera"), false);
      assert.equal(stored.includes("5595550199"), false);
    });

    it("retries a failed send with the same event id, then gives up after four tries", async () => {
      await connect();
      respondWith = 503;
      const queued = link.queueCrmEvent(OFFICER, "lead.created", "lead_a", { sendNow: false });
      assert.ok(queued);
      let now = Date.now();
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        await link.processDueCrmDeliveries(new Date(now));
        now += 11 * 60_000;
      }
      const row = readDb().crmDeliveries[0];
      assert.equal(row.status, "failed");
      assert.equal(row.attempts, 4);
      assert.equal(row.lastHttpStatus, 503);
      assert.equal(new Set(calls.map((call) => call.headers["X-YPN-Event-Id"])).size, 1);
      await link.processDueCrmDeliveries(new Date(now));
      assert.equal(calls.length, 4);
    });

    it("waits before retrying", async () => {
      await connect();
      respondWith = 500;
      link.queueCrmEvent(OFFICER, "lead.created", "lead_a", { sendNow: false });
      const start = Date.now();
      await link.processDueCrmDeliveries(new Date(start));
      await link.processDueCrmDeliveries(new Date(start + 5_000));
      assert.equal(calls.length, 1);
      respondWith = 200;
      await link.processDueCrmDeliveries(new Date(start + 31_000));
      assert.equal(calls.length, 2);
      assert.equal(readDb().crmDeliveries[0].status, "sent");
    });

    it("treats a redirect or a 4xx as a failure and doesn't retry a 4xx", async () => {
      await connect();
      respondWith = 404;
      const queued = link.queueCrmEvent(OFFICER, "lead.created", "lead_a", { sendNow: false });
      const result = await link.deliverCrmEvent(queued!.id);
      assert.equal(result?.status, "failed");
      respondWith = 302;
      const again = link.queueCrmEvent(OFFICER, "lead.created", "lead_b", { sendNow: false });
      const redirected = await link.deliverCrmEvent(again!.id);
      assert.equal(redirected?.status, "pending");
      assert.equal(redirected?.lastError, "redirect");
    });

    it("never sends when the address now resolves to a private network", async () => {
      await connect();
      resolvesTo = "169.254.169.254";
      const queued = link.queueCrmEvent(OFFICER, "lead.created", "lead_a", { sendNow: false });
      const result = await link.deliverCrmEvent(queued!.id);
      assert.equal(result?.status, "failed");
      assert.equal(result?.lastError, "address_blocked");
      assert.equal(calls.length, 0);
    });

    it("never sends another officer's lead", async () => {
      await connect();
      const queued = link.queueCrmEvent(OFFICER, "lead.created", "lead_other", { sendNow: false });
      const result = await link.deliverCrmEvent(queued!.id);
      assert.equal(result?.status, "failed");
      assert.equal(calls.length, 0);
    });

    it("sends a made-up test lead", async () => {
      await connect();
      const queued = link.queueCrmEvent(OFFICER, "test", undefined, { sendNow: false });
      await link.deliverCrmEvent(queued!.id);
      const event = JSON.parse(calls[0].body);
      assert.equal(event.event, "test");
      assert.match(event.lead.email, /@example\.com$/);
    });

    it("logs no address when a send fails", async () => {
      await connect();
      respondWith = () => {
        throw new Error(`connect ECONNREFUSED ${HOOK}`);
      };
      const warnings: string[] = [];
      const original = console.warn;
      console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
      try {
        const queued = link.queueCrmEvent(OFFICER, "lead.created", "lead_a", { sendNow: false });
        await link.deliverCrmEvent(queued!.id);
      } finally {
        console.warn = original;
      }
      assert.ok(warnings.length > 0);
      assert.equal(warnings.some((line) => line.includes("zapier") || line.includes("sam.rivera")), false);
    });
  });

  describe("updates coming back", () => {
    it("rejects a wrong or missing token", async () => {
      const { connectionId } = await connect();
      assert.equal(inbound.applyCrmUpdate(connectionId, "nope", { leadId: "lead_a", status: "Contacted" }).ok, false);
      assert.equal(inbound.applyCrmUpdate(connectionId, null, { leadId: "lead_a", status: "Contacted" }).ok, false);
      assert.equal(inbound.applyCrmUpdate("crmc_missing", "x", { leadId: "lead_a", status: "Contacted" }).ok, false);
    });

    it("changes the status and adds a note", async () => {
      const { connectionId, inboundToken } = await connect();
      const result = inbound.applyCrmUpdate(connectionId, inboundToken, { leadId: "lead_a", status: "Application", note: "Sent the 1003\u0007" });
      assert.deepEqual(result, { ok: true, leadId: "lead_a", applied: ["status", "note"] });
      const row = readDb().crmLeads.find((item) => item.id === "crm_lead_a")!;
      assert.equal(row.status, "Application");
      assert.deepEqual(row.notes, ["From your CRM ▸ Sent the 1003"]);
      assert.ok(readDb().crmConnections[0].lastInboundAt);
    });

    it("applies the same event once", async () => {
      const { connectionId, inboundToken } = await connect();
      const body = { eventId: "evt_1", leadId: "lead_a", note: "Called" };
      inbound.applyCrmUpdate(connectionId, inboundToken, body);
      const again = inbound.applyCrmUpdate(connectionId, inboundToken, body);
      assert.equal(again.ok && again.duplicate, true);
      // Same body without an event id is also a duplicate.
      inbound.applyCrmUpdate(connectionId, inboundToken, { leadId: "lead_a", note: "Left voicemail" });
      inbound.applyCrmUpdate(connectionId, inboundToken, { note: "Left voicemail", leadId: "lead_a" });
      assert.equal(readDb().crmLeads.find((item) => item.id === "crm_lead_a")!.notes.length, 2);
    });

    it("never creates a lead and never touches another officer's lead", async () => {
      const { connectionId, inboundToken } = await connect();
      const before = readDb().crmLeads.length;
      const unknown = inbound.applyCrmUpdate(connectionId, inboundToken, { leadId: "lead_new", status: "New" });
      assert.equal(unknown.ok, false);
      if (!unknown.ok) assert.equal(unknown.status, 404);
      const other = inbound.applyCrmUpdate(connectionId, inboundToken, { leadId: "lead_other", status: "Closed" });
      assert.equal(other.ok, false);
      assert.equal(readDb().crmLeads.length, before);
      assert.equal(readDb().crmLeads.find((item) => item.id === "crm_lead_other")!.status, "new_ai_routed");
      assert.equal(readDb().borrowerLeads.length, 3);
    });

    it("links the CRM's own id, then accepts updates by it", async () => {
      const { connectionId, inboundToken } = await connect();
      const linked = inbound.applyCrmUpdate(connectionId, inboundToken, { leadId: "lead_a", externalId: "hs-991" });
      assert.deepEqual(linked, { ok: true, leadId: "lead_a", applied: ["linked"] });
      const byExternal = inbound.applyCrmUpdate(connectionId, inboundToken, { externalId: "hs-991", status: "Processing" });
      assert.equal(byExternal.ok && byExternal.leadId, "lead_a");
      const conflict = inbound.applyCrmUpdate(connectionId, inboundToken, { leadId: "lead_b", externalId: "hs-991" });
      assert.equal(conflict.ok, false);
      if (!conflict.ok) assert.equal(conflict.status, 409);
    });

    it("ignores an update older than the last one", async () => {
      const { connectionId, inboundToken } = await connect();
      inbound.applyCrmUpdate(connectionId, inboundToken, { leadId: "lead_a", status: "Processing", updatedAt: "2026-11-16T15:00:00Z" });
      const stale = inbound.applyCrmUpdate(connectionId, inboundToken, { leadId: "lead_a", status: "Contacted", updatedAt: "2026-11-16T14:00:00Z" });
      assert.equal(stale.ok && stale.stale, true);
      assert.equal(readDb().crmLeads.find((item) => item.id === "crm_lead_a")!.status, "Processing");
    });

    it("lets a corrected retry through after a rejected one", async () => {
      const { connectionId, inboundToken } = await connect();
      const body = { eventId: "evt_retry", leadId: "lead_a", updatedAt: "not a date", status: "Won" };
      assert.equal(inbound.applyCrmUpdate(connectionId, inboundToken, body).ok, false);
      const fixed = inbound.applyCrmUpdate(connectionId, inboundToken, { ...body, updatedAt: "2026-11-16T15:30:00Z" });
      assert.equal(fixed.ok && fixed.applied.includes("status"), true);
    });
  });
});
