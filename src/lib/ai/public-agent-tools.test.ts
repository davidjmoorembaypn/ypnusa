import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { generateId } from "../id";
import type { ChatSessionRecord } from "../types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-public-agent-tools-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

import { appendBorrowerLead, appendCrmLead, readDb } from "../db";
import { executeMloTool } from "./cerebro-tools";
import { toolsForMode } from "./chat-agent";
import { checkMarketingCompliance } from "./marketing-compliance";
import {
  executeCreateStarterKit,
  executeRequestCallback,
  executeSaveOfficerProspect,
  MAX_KITS_PER_SESSION,
} from "./public-agent-tools";

function session(overrides: Partial<ChatSessionRecord> = {}): ChatSessionRecord {
  return {
    id: generateId("chat"),
    mode: "public_site",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    capturedFields: {},
    status: "active",
    ...overrides,
  };
}

const para = (sentence: string, times: number) => Array.from({ length: times }, () => sentence).join(" ");

function goodKitInput(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    officerName: "Maria Lopez",
    city: "Visalia",
    state: "ca",
    zip: "93291",
    facts: "Bilingual, helps first-time buyers, grew up in Tulare County.",
    bio: para("I help families in Visalia buy their first home with clear answers and steady guidance from start to finish.", 4),
    gbpDescription: para("Mortgage guidance for Visalia home buyers and homeowners, in English and Spanish.", 4),
    gbpPost: para("Thinking about buying in Visalia this spring? Book a free planning call and get a clear next step.", 2),
    blogTitle: "Buying your first home in Visalia: a step-by-step guide",
    blogPost: para("Start by looking at your monthly budget and the neighborhoods you love, then talk to a local loan officer about programs that fit.", 12),
    welcomeEmailSubject: "I'm taking new clients in Visalia",
    welcomeEmailBody: para("I wanted you to be the first to know I'm helping new buyers and homeowners in Visalia this year.", 3),
    ...extra,
  };
}

describe("checkMarketingCompliance", () => {
  it("flags rates, guarantees, invented track records and invented NMLS numbers", () => {
    const problems = checkMarketingCompliance({
      fields: { bio: "Rates as low as 5.99% APR, guaranteed approval. 20 years of experience. NMLS #123456." },
      facts: "",
    });
    assert.ok(problems.some((p) => p.includes("rate, APR or percentage")));
    assert.ok(problems.some((p) => p.includes("guarantee")));
    assert.ok(problems.some((p) => p.includes("20 years of experience")));
    assert.ok(problems.some((p) => p.includes("NMLS")));
  });

  it("accepts a track record the officer stated and a 30-year mortgage mention", () => {
    const problems = checkMarketingCompliance({
      fields: { bio: "With 12 years of experience I explain 30-year and 15 year loan options in plain words." },
      facts: "I've been a loan officer for 12 years.",
    });
    assert.deepEqual(problems, []);
  });
});

describe("create_starter_kit", () => {
  it("saves a valid kit, adds the disclosure line and returns its page", () => {
    const s = session();
    const out = JSON.parse(executeCreateStarterKit({ toolName: "create_starter_kit", input: goodKitInput({ nmlsId: "1234567" }) }, s));
    assert.equal(out.saved, true);
    assert.match(out.starterKitUrl, /\/starter-kit\/kit_/);
    assert.match(out.bio, /NMLS #1234567 \| Equal Housing Opportunity/);
    const kit = readDb().starterKits.find((item) => item.sessionId === s.id);
    assert.equal(kit?.state, "CA");
    assert.equal(kit?.zip, "93291");
  });

  it("sends problems back instead of saving non-compliant copy", () => {
    const s = session();
    const out = JSON.parse(
      executeCreateStarterKit(
        { toolName: "create_starter_kit", input: goodKitInput({ bio: `${para("Guaranteed approval for every Visalia buyer at the lowest rates.", 5)}` }) },
        s,
      ),
    );
    assert.equal(out.error, "fix_and_retry");
    assert.ok(out.problems.length > 0);
    assert.equal(readDb().starterKits.some((item) => item.sessionId === s.id), false);
  });

  it("caps kits per chat session", () => {
    const s = session();
    for (let i = 0; i < MAX_KITS_PER_SESSION; i++) {
      assert.equal(JSON.parse(executeCreateStarterKit({ toolName: "create_starter_kit", input: goodKitInput() }, s)).saved, true);
    }
    assert.equal(JSON.parse(executeCreateStarterKit({ toolName: "create_starter_kit", input: goodKitInput() }, s)).error, "kit_limit");
  });
});

describe("save_officer_prospect", () => {
  it("refuses without consent and saves one record per chat with it", () => {
    const s = session();
    assert.equal(JSON.parse(executeSaveOfficerProspect({ toolName: "save_officer_prospect", input: { name: "Sam", email: "sam@example.com", consent: false } }, s)).error, "no_consent");
    assert.equal(JSON.parse(executeSaveOfficerProspect({ toolName: "save_officer_prospect", input: { name: "Sam", email: "bad", consent: true } }, s)).error, "contact_required");
    executeSaveOfficerProspect({ toolName: "save_officer_prospect", input: { name: "Sam", email: "sam@example.com", consent: true } }, s);
    executeSaveOfficerProspect({ toolName: "save_officer_prospect", input: { name: "Sam Lee", phone: "(559) 555-0100", consent: true, zip: "93291" } }, s);
    const saved = readDb().officerProspects.filter((item) => item.sessionId === s.id);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].name, "Sam Lee");
    assert.equal(saved[0].phone, "5595550100");
    assert.equal(saved[0].zip, "93291");
  });
});

describe("request_callback", () => {
  function linkedLead(loId: string) {
    const leadId = generateId("lead");
    appendBorrowerLead({
      id: leadId,
      createdAt: new Date().toISOString(),
      assignedLoId: loId,
      qualification: { programScores: {}, leadQuality: "strong", urgency: "high", recommendedNextStep: "Call", rationale: [] },
      crmLeadId: "crm_x",
      answers: { loanProgram: "CONVENTIONAL", name: "Ana Ruiz", phone: "5595550101", contactConsent: true },
    });
    appendCrmLead({
      id: generateId("crm"),
      createdAt: new Date().toISOString(),
      borrowerLeadId: leadId,
      assignedLoId: loId,
      status: "new_ai_routed",
      notes: [],
      qualificationSnapshot: { programScores: {}, leadQuality: "strong", urgency: "high", recommendedNextStep: "Call", rationale: [] },
    });
    return leadId;
  }

  it("needs a linked, consenting lead", () => {
    assert.equal(JSON.parse(executeRequestCallback({ toolName: "request_callback", input: { channel: "phone" } }, session())).error, "not_yet_qualified");
  });

  it("queues one callback and one draft for the officer, never sending", () => {
    const officer = readDb().loanOfficers[0];
    const leadId = linkedLead(officer.id);
    const s = session({
      borrowerLeadId: leadId,
      capturedFields: { name: "Ana Ruiz", phone: "5595550101", consent: true, leadType: "buyer" },
    });
    const first = JSON.parse(executeRequestCallback({ toolName: "request_callback", input: { channel: "text", preferredWindow: "weekday evenings" } }, s));
    assert.equal(first.queued, true);
    executeRequestCallback({ toolName: "request_callback", input: { channel: "text", preferredWindow: "Saturday morning" } }, s);
    const queued = readDb().cerebroActions.filter((action) => action.borrowerLeadId === leadId);
    assert.equal(queued.length, 2);
    assert.ok(queued.every((action) => action.status === "awaiting_approval"));
    const draft = queued.find((action) => action.kind === "follow_up_draft");
    assert.match(draft?.body ?? "", /Saturday morning/);
    assert.match(draft?.body ?? "", /Reply STOP to opt out/);
    assert.equal(readDb().followUps.some((job) => job.borrowerLeadId === leadId), false);
    assert.equal(JSON.parse(executeRequestCallback({ toolName: "request_callback", input: { channel: "email" } }, s)).error, "email_missing");
  });
});

describe("officer queue tools", () => {
  it("lists and approves only the officer's own queued items", async () => {
    const officer = readDb().loanOfficers[0];
    const ctx = { userEmail: officer.email };
    const list = JSON.parse(await executeMloTool({ toolName: "list_queued_actions", input: {} }, ctx));
    assert.ok(list.waitingForYou >= 2);
    const draft = list.items.find((item: { kind: string }) => item.kind === "follow_up_draft");
    const approved = JSON.parse(
      await executeMloTool({ toolName: "decide_queued_action", input: { actionId: draft.id, decision: "approve", editedBody: "Hi Ana, call you Saturday?" } }, ctx),
    );
    assert.equal(approved.ok, true);
    assert.equal(approved.finalText, "Hi Ana, call you Saturday?");
    const again = JSON.parse(await executeMloTool({ toolName: "decide_queued_action", input: { actionId: draft.id, decision: "dismiss" } }, ctx));
    assert.equal(again.error, "already_decided");
    const stranger = JSON.parse(await executeMloTool({ toolName: "list_queued_actions", input: {} }, { userEmail: "nobody@example.com" }));
    assert.equal(stranger.error, "no_officer_profile");
  });
});

describe("toolsForMode", () => {
  it("gives the public site the starter kit, prospect and callback tools, and the officer the queue tools", () => {
    const pub = toolsForMode("public_site").map((tool) => tool.name);
    assert.ok(pub.includes("create_starter_kit") && pub.includes("save_officer_prospect") && pub.includes("request_callback"));
    const lq = toolsForMode("lead_qualification").map((tool) => tool.name);
    assert.ok(lq.includes("request_callback") && !lq.includes("create_starter_kit"));
    const mlo = toolsForMode("mlo_dashboard").map((tool) => tool.name);
    assert.ok(mlo.includes("list_queued_actions") && mlo.includes("decide_queued_action") && !mlo.includes("create_starter_kit"));
  });
});

describe("borrower ZIP routing", () => {
  it("routes a qualified chat lead with the ZIP code it captured", async () => {
    const { linkQualifiedLead } = await import("./chat-agent");
    const { routeLead } = await import("../crm");
    const s = session({
      mode: "lead_qualification",
      status: "qualified",
      capturedFields: { name: "Lee Park", email: "lee@example.com", consent: true, leadType: "buyer", zip: "85004" },
    });
    linkQualifiedLead(s);
    const lead = readDb().borrowerLeads.find((item) => item.id === s.borrowerLeadId);
    assert.equal(lead?.answers.zip, "85004");
    assert.equal(lead?.assignedLoId, routeLead({ program: "CONVENTIONAL", zip: "85004" }).officer.id);
  });
});
