import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import type { BorrowerAnswers, LoanOfficerRecord, QualificationSummary, RevenueSubscriptionRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-crm-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

const officers: LoanOfficerRecord[] = [
  { id: "lo_fha_a", name: "FHA A", email: "fha-a@example.com", specialties: ["FHA"], weeklyWindows: [] },
  { id: "lo_fha_b", name: "FHA B", email: "fha-b@example.com", specialties: ["FHA"], weeklyWindows: [] },
  { id: "lo_jumbo", name: "Jumbo", email: "jumbo@example.com", specialties: ["JUMBO"], weeklyWindows: [] },
];

const answers: BorrowerAnswers = {
  loanProgram: "FHA",
  name: "Taylor Borrower",
  email: "taylor@example.com",
  phone: "+15555550123",
  timeline: "1_3_months",
  estimatedCreditBand: "670-739",
};

const qualification: QualificationSummary = {
  programScores: { overallScore: 81.4 },
  leadQuality: "strong",
  urgency: "high",
  recommendedNextStep: "Fast LOS build.",
  rationale: ["one", "two", "three", "four", "five"],
};

describe("crm routing and activity log", async () => {
  const { readDb, writeDb } = await import("./db");
  const {
    borrowerFacingOfficer,
    HOUSE_OFFICER_ID,
    isDemoOfficer,
    logCrmActivity,
    routeLead,
    routeLoanOfficer,
    syncOfficerProfile,
  } = await import("./crm");
  const { findAccountByEmail, upsertAccount } = await import("./accounts");
  const { draftOnboardingRecord } = await import("./agent-onboarding");
  const { officerSlug } = await import("./officer-profile");
  const { buildNurtureDashboard } = await import("./nurture-dashboard");

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    writeDb((db) => {
      db.loanOfficers = officers.map((officer) => ({ ...officer }));
      db.revenueSubscriptions = [];
      db.agentOnboarding = [];
      db.borrowerLeads = [];
      db.crmLeads = [];
    });
  });

  function paidSub(overrides: Partial<RevenueSubscriptionRecord>): RevenueSubscriptionRecord {
    const now = new Date().toISOString();
    return {
      id: `sub_${Math.random().toString(36).slice(2)}`,
      createdAt: now,
      startedAt: now,
      tier: "growth",
      status: "active",
      source: "stripe_webhook",
      claimedZips: ["93720"],
      ...overrides,
    };
  }

  it("sends a lead with no ZIP code to the house account, never to a roster or demo officer", () => {
    const route = routeLead({ program: "JUMBO" });
    assert.equal(route.reason, "house");
    assert.equal(route.officer.id, HOUSE_OFFICER_ID);
    assert.equal(route.officer.name, "David J. Moore");
    assert.equal(route.officer.email, "support@ypnus.com");
    assert.ok(readDb().loanOfficers.some((officer) => officer.id === HOUSE_OFFICER_ID), "house officer is stored");
    assert.equal(routeLoanOfficer("FHA").id, HOUSE_OFFICER_ID);
  });

  it("routes a lead in a paid subscriber's ZIP code to that subscriber's account", () => {
    writeDb((db) => {
      db.revenueSubscriptions = [paidSub({ ownerEmail: "Real.MLO@example.com", status: "trialing" })];
    });
    const route = routeLead({ program: "FHA", zip: "93720-1234" });
    const account = findAccountByEmail("real.mlo@example.com");
    assert.ok(account, "an account exists for the paying MLO");
    assert.equal(route.reason, "zip_owner");
    assert.equal(route.officer.id, account.id, "officer id is the account id (the session sub)");
    assert.equal(route.officer.email, "real.mlo@example.com");
    assert.equal(route.officer.entitlementTier, "growth");

    // The MLO sees the lead on their own dashboard.
    const crm = logCrmActivity({ ...answers, zip: "93720" }, qualification, route.officer.id);
    const dashboard = buildNurtureDashboard(account.id);
    assert.ok(dashboard.rows.some((row) => row.leadId === crm.borrowerLeadId));
  });

  it("ignores seeded demo, cancelled and demo-request claims and falls back to the house account", () => {
    writeDb((db) => {
      db.revenueSubscriptions = [
        paidSub({ source: "seed", ownerLoId: "lo_jordan_lee", ownerEmail: "jordan.lee@loanapilot.ai" }),
        paidSub({ status: "cancelled", ownerEmail: "gone@example.com" }),
        paidSub({ source: "demo_request", ownerEmail: "demo@example.com" }),
      ];
    });
    assert.equal(routeLead({ program: "FHA", zip: "93720" }).reason, "house");
  });

  it("never routes to a demo officer even when a paid record points at one", () => {
    writeDb((db) => {
      db.loanOfficers = [
        ...officers,
        { id: "lo_jordan_lee", name: "Jordan Lee", email: "jordan.lee@loanapilot.ai", specialties: ["FHA"], weeklyWindows: [] },
      ];
      db.revenueSubscriptions = [paidSub({ ownerLoId: "lo_jordan_lee", ownerEmail: "owner2@example.com" })];
    });
    const route = routeLead({ program: "FHA", zip: "93720" });
    assert.equal(route.reason, "zip_owner");
    assert.notEqual(route.officer.id, "lo_jordan_lee");
    assert.equal(route.officer.email, "owner2@example.com");
  });

  it("no longer routes a ZIP code held by a prepaid plan past its expiry date", () => {
    writeDb((db) => {
      db.revenueSubscriptions = [
        paidSub({ ownerEmail: "lapsed@example.com", expiresAt: new Date(Date.now() - 60_000).toISOString() }),
      ];
    });
    assert.equal(routeLead({ program: "FHA", zip: "93720" }).reason, "house");
  });

  describe("officer pages (?lo=)", () => {
    function seedOfficer(email: string, fullName: string, zips: string[], status: RevenueSubscriptionRecord["status"] = "active") {
      const account = upsertAccount({ email, source: "stripe_checkout" });
      const now = new Date().toISOString();
      writeDb((db) => {
        db.revenueSubscriptions.push(paidSub({ ownerEmail: email, claimedZips: zips, status }));
        db.agentOnboarding = db.agentOnboarding.filter((record) => record.userId !== account.id);
        db.agentOnboarding.push({
          ...draftOnboardingRecord(account.id, email, now),
          officerProfile: {
            fullName,
            nmlsId: "1234567",
            phone: "5595550100",
            company: "Valley Home Loans",
            slug: officerSlug(fullName, account.id),
            updatedAt: now,
          },
        });
      });
      return { account, slug: officerSlug(fullName, account.id) };
    }

    it("routes a lead from a live officer page to that officer, even for another officer's ZIP code", () => {
      seedOfficer("zip.holder@example.com", "Zed Holder", ["93720"]);
      const { account, slug } = seedOfficer("page.owner@example.com", "Paula Page", ["93611"]);
      const route = routeLead({ program: "FHA", zip: "93720", officerSlug: slug });
      assert.equal(route.reason, "officer_page");
      assert.equal(route.officer.id, account.id);
      assert.equal(route.officer.name, "Paula Page", "the profile name reaches the officer record");
      assert.equal(route.officer.nmlsId, "1234567");
      assert.equal(route.officer.publicSlug, slug);
    });

    it("moves a page chat's lead when the borrower later names a state the officer isn't licensed in", async () => {
      const { account, slug } = seedOfficer("ca.only@example.com", "Carla Coast", ["93611"]);
      writeDb((db) => {
        const record = db.agentOnboarding.find((item) => item.userId === account.id);
        if (record?.officerProfile) record.officerProfile.licenses = [{ state: "CA", type: "mlo", number: "1234567" }];
        db.chatSessions = db.chatSessions.filter((item) => item.id !== "chat_late_location");
      });
      const { setAiProviderForTests } = await import("./ai/provider");
      const { runAssistantTurn } = await import("./ai/chat-agent");
      const turns = [
        { name: "Sam Lee", email: "sam@example.com", consent: true, leadType: "buyer" },
        { name: "Sam Lee", email: "sam@example.com", consent: true, leadType: "buyer", zip: "85004" },
      ];
      // Each borrower turn: the model records the fields once, then answers in text.
      let turn = 0;
      let answerNext = false;
      setAiProviderForTests({
        name: "test",
        async generate() {
          if (answerNext || turn >= turns.length) {
            answerNext = false;
            return { text: "Thanks!", toolCalls: [], stopReason: "end_turn" };
          }
          answerNext = true;
          const input = turns[turn];
          turn += 1;
          return { text: "", toolCalls: [{ toolName: "capture_lead_qualification", input }], stopReason: "tool_use" };
        },
      });
      try {
        const first = await runAssistantTurn({ mode: "lead_qualification", userMessage: "I want to buy", officerSlug: slug });
        const leadId = first.borrowerLeadId;
        assert.ok(leadId, "the lead links once qualified");
        assert.equal(readDb().borrowerLeads.find((lead) => lead.id === leadId)?.assignedLoId, account.id);
        await runAssistantTurn({ mode: "lead_qualification", sessionId: first.sessionId, userMessage: "It's in Phoenix, 85004", officerSlug: slug });
        const moved = readDb().borrowerLeads.find((lead) => lead.id === leadId);
        assert.notEqual(moved?.assignedLoId, account.id, "an unlicensed officer keeps no out-of-state lead");
        assert.equal(readDb().crmLeads.find((crm) => crm.borrowerLeadId === leadId)?.assignedLoId, moved?.assignedLoId);
      } finally {
        setAiProviderForTests(undefined);
      }
    });

    it("sends a lead to the new officer's CRM when a later ZIP code moves it off the house book", async () => {
      const { account } = seedOfficer("zip.owner@example.com", "Paula Pine", ["93277"]);
      const safety = await import("./integrations/crm/url-safety");
      const link = await import("./integrations/crm/link");
      const sent: string[] = [];
      safety.setDnsLookupForTests(async () => [{ address: "52.1.2.3" }]);
      link.setCrmRetryTimersForTests(false);
      link.setCrmFetchForTests(async (_url, init) => {
        sent.push(JSON.parse(init.body).lead.id);
        return { status: 200 };
      });
      writeDb((db) => {
        db.crmConnections = [];
        db.crmDeliveries = [];
        db.chatSessions = [];
      });
      const connected = await link.connectCrm(account.id, "https://hooks.zapier.com/hooks/catch/1/x/");
      assert.equal(connected.ok, true);
      const { setAiProviderForTests } = await import("./ai/provider");
      const { runAssistantTurn } = await import("./ai/chat-agent");
      const turns = [
        { name: "Sam Lee", email: "sam@example.com", consent: true, leadType: "buyer" },
        { name: "Sam Lee", email: "sam@example.com", consent: true, leadType: "buyer", zip: "93277" },
      ];
      let turn = 0;
      let answerNext = false;
      setAiProviderForTests({
        name: "test",
        async generate() {
          if (answerNext || turn >= turns.length) {
            answerNext = false;
            return { text: "Thanks!", toolCalls: [], stopReason: "end_turn" };
          }
          answerNext = true;
          const input = turns[turn];
          turn += 1;
          return { text: "", toolCalls: [{ toolName: "capture_lead_qualification", input }], stopReason: "tool_use" };
        },
      });
      try {
        const first = await runAssistantTurn({ mode: "lead_qualification", userMessage: "I want to buy" });
        const leadId = first.borrowerLeadId;
        assert.ok(leadId);
        assert.equal(readDb().borrowerLeads.find((lead) => lead.id === leadId)?.assignedLoId, HOUSE_OFFICER_ID);
        await runAssistantTurn({ mode: "lead_qualification", sessionId: first.sessionId, userMessage: "It's 93277" });
        assert.equal(readDb().borrowerLeads.find((lead) => lead.id === leadId)?.assignedLoId, account.id);
        await new Promise((resolve) => setTimeout(resolve, 20));
        assert.deepEqual(sent, [leadId], "the ZIP code owner's CRM gets the lead once");
      } finally {
        setAiProviderForTests(undefined);
        safety.setDnsLookupForTests(null);
        link.setCrmFetchForTests(null);
        link.setCrmRetryTimersForTests(true);
      }
    });

    it("falls back to ZIP code routing when the officer page isn't live", () => {
      const { slug } = seedOfficer("cancelled.lo@example.com", "Cass Cancel", ["93611"], "cancelled");
      seedOfficer("zip.holder2@example.com", "Zoe Holder", ["93720"]);
      const route = routeLead({ program: "FHA", zip: "93720", officerSlug: slug });
      assert.equal(route.reason, "zip_owner");
      assert.equal(route.officer.email, "zip.holder2@example.com");
      assert.equal(routeLead({ program: "FHA", zip: "00000", officerSlug: "not-a-real-officer-ffffffff" }).reason, "house");
    });

    it("mirrors licensing details (company NMLS, licenses, lender wording) onto the officer record", () => {
      const { account } = seedOfficer("licensed.lo@example.com", "Lia Licensed", ["93612"]);
      writeDb((db) => {
        const record = db.agentOnboarding.find((item) => item.userId === account.id);
        if (record?.officerProfile) {
          record.officerProfile.companyNmlsId = "7890";
          record.officerProfile.licenses = [{ state: "CA", type: "ca_dre", number: "01234567" }];
          record.officerProfile.equalHousing = "lender";
        }
      });
      const officer = syncOfficerProfile(account.id);
      assert.equal(officer?.companyNmlsId, "7890");
      assert.deepEqual(officer?.licenses, [{ state: "CA", type: "ca_dre", number: "01234567" }]);
      assert.equal(officer?.equalHousing, "lender");
    });

    it("mirrors a saved profile onto the officer record only for an officer with a live plan", () => {
      const { account } = seedOfficer("mirror.lo@example.com", "Mia Mirror", ["93611"]);
      const officer = syncOfficerProfile(account.id);
      assert.equal(officer?.name, "Mia Mirror");
      assert.equal(officer?.phone, "5595550100");
      assert.equal(officer?.company, "Valley Home Loans");

      const free = upsertAccount({ email: "free.lo@example.com", source: "email_signup" });
      writeDb((db) => {
        db.agentOnboarding.push({
          ...draftOnboardingRecord(free.id, free.email),
          officerProfile: { fullName: "Fran Free", nmlsId: "7654321", phone: "5595550101", slug: officerSlug("Fran Free", free.id), updatedAt: new Date().toISOString() },
        });
      });
      assert.equal(syncOfficerProfile(free.id), null, "no officer record is created for a free account");
      assert.equal(readDb().loanOfficers.some((entry) => entry.id === free.id), false);
    });
  });

  it("hides demo officer names from borrowers in production", () => {
    const demo: LoanOfficerRecord = {
      id: "lo_mateo_rosales",
      name: "Mateo Rosales",
      email: "mateo.r@loanapilot.ai",
      specialties: ["FHA"],
      weeklyWindows: [],
    };
    assert.equal(isDemoOfficer(demo), true);
    assert.equal(isDemoOfficer(officers[0]), false);
    const env = process.env as Record<string, string | undefined>;
    const saved = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      assert.equal(borrowerFacingOfficer(demo).name, "David J. Moore");
      assert.equal(borrowerFacingOfficer(officers[0]).name, "FHA A");
    } finally {
      env.NODE_ENV = saved;
    }
  });

  it("persists a linked borrower lead and CRM record with mirrored notes", () => {
    const result = logCrmActivity(answers, qualification, "lo_fha_a", "paid_search", "sess_123");
    const db = readDb();
    const lead = db.borrowerLeads.find((entry) => entry.id === result.borrowerLeadId);
    const crm = db.crmLeads.find((entry) => entry.id === result.crmLeadId);

    assert.match(result.borrowerLeadId, /^lead_/);
    assert.match(result.crmLeadId, /^crm_/);
    assert.equal(lead?.crmLeadId, result.crmLeadId);
    assert.equal(lead?.sessionId, "sess_123");
    assert.equal(lead?.funnelSource, "paid_search");
    assert.equal(lead?.assignedLoId, "lo_fha_a");
    assert.equal(crm?.borrowerLeadId, result.borrowerLeadId);
    assert.equal(crm?.status, "new_ai_routed");
    assert.deepEqual(crm?.qualificationSnapshot, qualification);
    assert.deepEqual(result.notes.slice(0, 4), [
      "Funnel cohort: paid_search",
      "LOS composite 81 / quality strong",
      "AI coaching: Fast LOS build.",
      "Session lineage: sess_123",
    ]);
    assert.equal(result.notes.length, 8, "at most four model notes are mirrored");
    assert.ok(result.notes.every((note) => typeof note === "string" && note.length > 0));
  });

  it("labels an anonymous funnel and falls back to the lead id for session lineage", () => {
    const result = logCrmActivity(answers, qualification, "lo_fha_a");

    assert.equal(result.notes[0], "Funnel cohort: unspecified_ai_channel");
    assert.equal(result.notes[3], `Session lineage: ${result.borrowerLeadId}`);
  });
});
