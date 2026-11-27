import { isBeingSent } from "@/lib/cerebro-dispatch";
import { borrowerFacingOfficer, houseOfficerRecord, HOUSE_OFFICER_ID } from "@/lib/crm";
import { appendCrmNote, readDb, saveCerebroAction, saveStarterKit, upsertOfficerProspect } from "@/lib/db";
import { generateId } from "@/lib/id";
import { marketingUrl } from "@/lib/site";
import { isValidZip, normalizeZip } from "@/lib/territory";
import type { CerebroQueuedActionRecord, ChatSessionRecord, LoanOfficerRecord, StarterKitRecord } from "@/lib/types";
import { checkMarketingCompliance, cleanNmlsId } from "./marketing-compliance";
import type { AiToolCall, AiToolDefinition } from "./provider";

/**
 * Cerebro's action tools for the public site: things it DOES for a visitor mid-conversation,
 * not just answers. Each executor validates its input on the server and returns JSON for the
 * model. Nothing here sends an email or text, publishes anything, or charges anyone:
 * - create_starter_kit drafts a loan officer's first-week marketing kit and saves it as a draft page.
 * - save_officer_prospect records a visiting loan officer who asked YPN USA to follow up.
 * - request_callback queues a borrower's callback request, plus a drafted first message, for
 *   their loan officer to approve.
 */

export const PUBLIC_ACTION_TOOL_NAMES = new Set(["create_starter_kit", "save_officer_prospect", "request_callback"]);

/**
 * The free starter kit is a preview: Cerebro writes the bio in full and the opening of one
 * local blog post. The Google Business Profile description and post, the rest of the blog
 * post and the welcome email are named on the kit page and written only on a paid plan,
 * so the free kit costs one short model call.
 */
const LIMITS = {
  bio: { min: 250, max: 1300 },
  blogTitle: { min: 15, max: 90 },
  blogOpening: { min: 200, max: 1200 },
} as const;

type KitField = keyof typeof LIMITS;
const KIT_FIELDS = Object.keys(LIMITS) as KitField[];

/** The pieces a paid plan adds, named (never written) on the free kit page and in the chat. */
export const LOCKED_KIT_PIECES = [
  "Google Business Profile description",
  "First Google Business Profile post",
  "The rest of the blog post",
  "Welcome email to past clients and referral partners",
] as const;

/** Cost guard on the free model tier: kits per chat session and per day across the site. */
export const MAX_KITS_PER_SESSION = 2;
export const MAX_KITS_PER_DAY = 300;

export const CREATE_STARTER_KIT_TOOL: AiToolDefinition = {
  name: "create_starter_kit",
  description:
    "Build a loan officer's free starter kit preview right now and save it as a private draft page they can open: a professional bio written in full, plus the title and opening paragraph of a first local blog post. Paid plans add the Google Business Profile description and first post, the rest of the blog post and a welcome email; do not write those. Call it once you know their name, city and state (ask for those in one short question if missing). Write only from facts they gave you: never invent years in business, loan counts, reviews, awards or an NMLS number, and never include rates, APRs, percentages, payment amounts, guarantees or approval timelines. If it returns problems, fix exactly those and call it again.",
  inputSchema: {
    type: "object",
    properties: {
      officerName: { type: "string", description: "The loan officer's name as they gave it." },
      city: { type: "string" },
      state: { type: "string", description: "Two-letter state code." },
      zip: { type: "string", description: "Their main ZIP code, if they gave one." },
      nmlsId: { type: "string", description: "Only if they typed their NMLS ID. Never guess." },
      company: { type: "string", description: "Their company or brokerage, if they gave it." },
      facts: {
        type: "string",
        description: "Everything they told you about themselves (experience, specialties, languages, community ties), in their words. Empty if nothing.",
      },
      bio: { type: "string", description: "First-person professional bio, 80-200 words, warm and specific to their city." },
      blogTitle: { type: "string", description: "Local blog post title aimed at a search their borrowers make, e.g. 'Buying your first home in Visalia: a step-by-step guide'." },
      blogOpening: {
        type: "string",
        description: "The blog post's opening paragraph only, 40-150 words, plain helpful guidance for their city that makes the reader want the rest. No rates.",
      },
    },
    required: ["officerName", "city", "state", ...KIT_FIELDS],
    additionalProperties: false,
  },
};

export const SAVE_OFFICER_PROSPECT_TOOL: AiToolDefinition = {
  name: "save_officer_prospect",
  description:
    "Save a visiting loan officer's contact details so the YPN USA team can follow up with them. Call only after they gave a name plus an email or phone AND clearly said YPN USA may contact them. Never call it for a homebuyer or homeowner (use capture_lead_qualification for those).",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      zip: { type: "string" },
      city: { type: "string" },
      state: { type: "string" },
      planInterest: { type: "string", enum: ["free", "pro", "growth", "exclusive", "undecided"] },
      consent: { type: "boolean", description: "True only if they clearly said YPN USA may contact them." },
      notes: { type: "string", description: "One or two sentences on what they want." },
    },
    required: ["name", "consent"],
    additionalProperties: false,
  },
};

export const REQUEST_CALLBACK_TOOL: AiToolDefinition = {
  name: "request_callback",
  description:
    "Queue a callback for a qualified borrower with their loan officer: records how and when they want to be reached and drafts the officer's first message for the officer to approve. Use it when they want a loan officer to reach out but schedule_meeting has no open times or they would rather not pick a slot. Only works after name, contact and consent are captured. Never promise a specific call time; the loan officer reaches out.",
  inputSchema: {
    type: "object",
    properties: {
      channel: { type: "string", enum: ["phone", "text", "email"], description: "How they want to be contacted." },
      preferredWindow: { type: "string", description: "When they prefer, in their words, e.g. 'weekday evenings after 6'." },
      topic: { type: "string", description: "What they want to talk about, in a few words." },
    },
    required: ["channel"],
    additionalProperties: false,
  },
};

export const PUBLIC_ACTION_TOOLS: AiToolDefinition[] = [CREATE_STARTER_KIT_TOOL, SAVE_OFFICER_PROSPECT_TOOL];

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanPhone(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return ten.length === 10 ? ten : undefined;
}

function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

/** The disclosure line the server appends; the model never writes the NMLS number itself. */
function disclosureLine(name: string, company: string | undefined, nmlsId: string | undefined): string {
  const nmls = nmlsId ? `NMLS #${nmlsId}` : "NMLS #[add your NMLS ID]";
  return [name, company, nmls, "Equal Housing Opportunity"].filter(Boolean).join(" | ");
}

export function executeCreateStarterKit(call: AiToolCall, session: ChatSessionRecord): string {
  const input = call.input;
  const officerName = str(input.officerName, 80);
  const city = str(input.city, 60);
  const state = str(input.state, 2)?.toUpperCase();
  if (!officerName || !city || !state || !/^[A-Z]{2}$/.test(state)) {
    return JSON.stringify({ error: "missing_details", ask: "Ask for their name, city and two-letter state, then try again." });
  }

  const db = readDb();
  const kits = db.starterKits;
  if (kits.filter((kit) => kit.sessionId === session.id).length >= MAX_KITS_PER_SESSION) {
    return JSON.stringify({ error: "kit_limit", note: "This chat already made its starter kits. Point them to the links you already gave." });
  }
  const today = utcDay(new Date().toISOString());
  if (kits.filter((kit) => utcDay(kit.createdAt) === today).length >= MAX_KITS_PER_DAY) {
    return JSON.stringify({ error: "busy", note: "Starter kits are paused for today. Offer the free signup instead." });
  }

  const fields = {} as Record<KitField, string>;
  const problems: string[] = [];
  for (const field of KIT_FIELDS) {
    const { min, max } = LIMITS[field];
    const raw = typeof input[field] === "string" ? (input[field] as string).trim() : "";
    if (raw.length < min) problems.push(`${field}: too short (at least ${min} characters).`);
    if (raw.length > max) problems.push(`${field}: too long (at most ${max} characters).`);
    fields[field] = raw;
  }
  const nmlsId = cleanNmlsId(input.nmlsId);
  const facts = str(input.facts, 1500);
  problems.push(...checkMarketingCompliance({ fields, facts, nmlsId }));
  if (problems.length > 0) {
    return JSON.stringify({ error: "fix_and_retry", problems: problems.slice(0, 12) });
  }

  const company = str(input.company, 80);
  const zipRaw = normalizeZip(input.zip);
  const disclosure = disclosureLine(officerName, company, nmlsId);
  const complianceNotes = [
    "Drafts only. Review every piece before you publish or send it; you are responsible for your own advertising compliance.",
    nmlsId
      ? `Your NMLS ID (#${nmlsId}) and Equal Housing Opportunity were added to the bio.`
      : "Add your NMLS ID where it says [add your NMLS ID] before using these.",
  ];

  const kit: StarterKitRecord = {
    id: generateId("kit"),
    createdAt: new Date().toISOString(),
    sessionId: session.id,
    officerName,
    city,
    state,
    zip: isValidZip(zipRaw) ? zipRaw : undefined,
    nmlsId,
    bio: `${fields.bio}\n\n${disclosure}`,
    gbpDescription: "",
    gbpPost: "",
    blogTitle: fields.blogTitle,
    blogPost: "",
    blogOpening: fields.blogOpening,
    welcomeEmailSubject: "",
    welcomeEmailBody: "",
    preview: true,
    complianceNotes,
  };
  saveStarterKit(kit);

  return JSON.stringify({
    saved: true,
    starterKitUrl: marketingUrl(`/starter-kit/${kit.id}`),
    bio: kit.bio,
    blogTitle: kit.blogTitle,
    blogOpening: kit.blogOpening,
    lockedPieces: LOCKED_KIT_PIECES,
    complianceNotes,
    howToReply:
      "Show the bio in full and the blog post's title and opening paragraph. Then name the locked pieces in one short line: a paid plan has Cerebro write them, keep them current and post for them. Give the starterKitUrl. Then offer the free account (start_signup) to keep building, and a ZIP code check if they have not done one. Never call the locked pieces free.",
  });
}

export function executeSaveOfficerProspect(call: AiToolCall, session: ChatSessionRecord): string {
  const input = call.input;
  const name = str(input.name, 80);
  if (!name) return JSON.stringify({ error: "name_required" });
  if (input.consent !== true) {
    return JSON.stringify({ error: "no_consent", note: "Ask whether the YPN USA team may contact them; save only after a clear yes." });
  }
  const emailRaw = str(input.email, 120)?.toLowerCase();
  const email = emailRaw && EMAIL_RE.test(emailRaw) ? emailRaw : undefined;
  const phone = cleanPhone(input.phone);
  if (!email && !phone) {
    return JSON.stringify({ error: "contact_required", note: "Ask for a valid email or 10-digit phone number." });
  }
  const zip = normalizeZip(input.zip);
  const plan = str(input.planInterest, 20);
  const latestKit = [...readDb().starterKits].reverse().find((kit) => kit.sessionId === session.id);
  const now = new Date().toISOString();
  upsertOfficerProspect({
    id: generateId("prospect"),
    createdAt: now,
    updatedAt: now,
    sessionId: session.id,
    name,
    email,
    phone,
    zip: isValidZip(zip) ? zip : undefined,
    city: str(input.city, 60),
    state: str(input.state, 2)?.toUpperCase(),
    planInterest: plan,
    consent: true,
    starterKitId: latestKit?.id,
    notes: str(input.notes, 400),
  });
  return JSON.stringify({
    saved: true,
    note: "Saved for the YPN USA team. Tell them someone from YPN USA will reach out; do not promise a time. Nothing was sent.",
  });
}

function officerForLead(loId: string): LoanOfficerRecord {
  if (loId === HOUSE_OFFICER_ID) return houseOfficerRecord();
  const officer = readDb().loanOfficers.find((item) => item.id === loId);
  return officer ? borrowerFacingOfficer(officer) : houseOfficerRecord();
}

function goalPhrase(leadType: ChatSessionRecord["capturedFields"]["leadType"]): string {
  if (leadType === "buyer") return "your home purchase";
  if (leadType === "seller") return "selling your home";
  if (leadType === "refinance") return "refinancing";
  return "your home plans";
}

/** The officer's first message, drafted from captured facts only. Never sent by Cerebro. */
export function draftFirstFollowUp(input: {
  channel: "phone" | "text" | "email";
  borrowerName?: string;
  officer: LoanOfficerRecord;
  leadType: ChatSessionRecord["capturedFields"]["leadType"];
  preferredWindow?: string;
  topic?: string;
}): { subject?: string; body: string } {
  const first = input.borrowerName?.split(/\s+/)[0] || "there";
  const officerFirst = input.officer.name.split(/\s+/)[0] || input.officer.name;
  const goal = input.topic || goalPhrase(input.leadType);
  const when = input.preferredWindow ? ` You mentioned ${input.preferredWindow} works best.` : "";
  if (input.channel === "email") {
    return {
      subject: `Following up on ${goal}`,
      body: `Hi ${first},\n\nThis is ${input.officer.name}. You asked on ypnus.com for a loan officer to reach out about ${goal}.${when} What's the best time for a quick call? I'm happy to answer your questions and walk you through your options, with no obligation.\n\n${officerFirst}`,
    };
  }
  if (input.channel === "text") {
    return {
      body: `Hi ${first}, it's ${input.officer.name}. You asked on ypnus.com for a loan officer to reach out about ${goal}.${when} Is now a good time for a quick call? Reply STOP to opt out.`,
    };
  }
  return {
    body: `Call script: "Hi ${first}, this is ${input.officer.name}. You asked on ypnus.com for a loan officer to call about ${goal}.${when} Is now still a good time?"`,
  };
}

export function executeRequestCallback(call: AiToolCall, session: ChatSessionRecord): string {
  if (!session.borrowerLeadId) {
    return JSON.stringify({ error: "not_yet_qualified", note: "Get their name, an email or phone, and consent to be contacted first." });
  }
  const f = session.capturedFields;
  if (f.consent !== true) return JSON.stringify({ error: "no_consent" });
  const channel = call.input.channel;
  if (channel !== "phone" && channel !== "text" && channel !== "email") {
    return JSON.stringify({ error: "channel must be phone, text or email." });
  }
  if ((channel === "phone" || channel === "text") && !f.phone) {
    return JSON.stringify({ error: "phone_missing", note: "Ask for the best phone number first." });
  }
  if (channel === "email" && !f.email) {
    return JSON.stringify({ error: "email_missing", note: "Ask for their email first." });
  }
  const db = readDb();
  const lead = db.borrowerLeads.find((item) => item.id === session.borrowerLeadId);
  if (!lead) return JSON.stringify({ error: "lead_not_found" });

  const preferredWindow = str(call.input.preferredWindow, 120);
  const topic = str(call.input.topic, 80);
  const officer = officerForLead(lead.assignedLoId);
  const now = new Date().toISOString();

  // One open callback per lead: a second request updates the first instead of piling up.
  const existing = db.cerebroActions.find(
    (action) => action.borrowerLeadId === lead.id && action.kind === "callback_request" && action.status === "awaiting_approval" && !isBeingSent(action),
  );
  const request: CerebroQueuedActionRecord = {
    id: existing?.id ?? generateId("cba"),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    loId: lead.assignedLoId,
    borrowerLeadId: lead.id,
    kind: "callback_request",
    status: "awaiting_approval",
    channel,
    preferredWindow,
    body: `${f.name ?? "The borrower"} asked for a ${channel === "phone" ? "call" : channel} about ${topic || goalPhrase(f.leadType)}${preferredWindow ? ` (${preferredWindow})` : ""}.`,
    source: "public_chat",
  };
  saveCerebroAction(request);

  const draft = draftFirstFollowUp({ channel, borrowerName: f.name, officer, leadType: f.leadType, preferredWindow, topic });
  const existingDraft = db.cerebroActions.find(
    (action) => action.borrowerLeadId === lead.id && action.kind === "follow_up_draft" && action.status === "awaiting_approval" && !isBeingSent(action),
  );
  saveCerebroAction({
    id: existingDraft?.id ?? generateId("cba"),
    createdAt: existingDraft?.createdAt ?? now,
    updatedAt: now,
    loId: lead.assignedLoId,
    borrowerLeadId: lead.id,
    kind: "follow_up_draft",
    status: "awaiting_approval",
    channel,
    preferredWindow,
    subject: draft.subject,
    body: draft.body,
    source: "public_chat",
  });
  if (!existing) {
    appendCrmNote(lead.id, `Cerebro: borrower asked for a ${channel} callback${preferredWindow ? ` (${preferredWindow})` : ""}. First message drafted and waiting for your approval.`);
  }

  return JSON.stringify({
    queued: true,
    note: "The request is with their loan officer, with a drafted first message waiting for the officer's approval. Tell them their loan officer will reach out by the method they chose; never promise a specific time. Nothing was sent yet.",
  });
}
