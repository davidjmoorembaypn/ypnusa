import { generateId } from "./id";
import { readDb, writeDb } from "./db";
import { requiredDisclosures, type ComplianceOfficer } from "./compliance/guardrails";
import { zipToState } from "./compliance/zip-state";
import { findPublicOfficerPage, type PublicOfficerPage } from "./officer-profile";
import { alertOfficerOfChatReply } from "./push-alerts";
import type { ChatMessageRecord, ChatSessionRecord } from "./types";

/**
 * Borrower chats on a loan officer's own page, and Live Takeover (upgrade 3.7):
 * the officer pauses Cerebro on one conversation, replies as themselves, and hands it back.
 *
 * - A chat started on /lo/[slug] is tied to that officer (officerUserId). Only that officer
 *   (or an admin) can see it, take it over or reply.
 * - While an officer has taken over, Cerebro stays silent: borrower messages are saved and
 *   wait for the officer. Handing back lets Cerebro answer again.
 * - Every write here goes through writeDb on the stored session, so a borrower message and
 *   an officer reply arriving together never overwrite each other.
 */

const MAX_OFFICER_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES_PER_SESSION = 200;
/** Chats with activity in this window show on the officer's Live chats list. */
const LIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface OfficerChatContext {
  userId: string;
  slug: string;
  name: string;
  firstName: string;
  nmlsId: string;
  company?: string;
  licensedStates: string[];
  /** The officer's disclosure lines for an AI chat (name + NMLS, company NMLS, Equal Housing). */
  disclosures: string[];
}

function complianceOfficerFor(page: PublicOfficerPage): ComplianceOfficer {
  const profile = page.profile;
  return {
    name: profile.fullName,
    nmlsId: profile.nmlsId,
    company: profile.company,
    companyNmlsId: profile.companyNmlsId,
    licenses: profile.licenses,
    equalHousing: profile.equalHousing,
  };
}

/** The live officer page behind a slug, shaped for the chat. Null when the page isn't public. */
export function officerChatContext(slug: unknown): OfficerChatContext | null {
  const page = findPublicOfficerPage(slug);
  if (!page) return null;
  const profile = page.profile;
  const licensedStates = [...new Set((profile.licenses ?? []).map((license) => license.state.toUpperCase()))].sort();
  return {
    userId: page.userId,
    slug: page.slug,
    name: profile.fullName,
    firstName: profile.fullName.trim().split(/\s+/)[0] ?? profile.fullName,
    nmlsId: profile.nmlsId,
    company: profile.company,
    licensedStates,
    disclosures: requiredDisclosures(complianceOfficerFor(page), "ai_message", undefined),
  };
}

/** Extra system-prompt rules for a chat on an officer's page. */
export function officerChatPrompt(officer: OfficerChatContext): string {
  const states = officer.licensedStates.length > 0 ? officer.licensedStates.join(", ") : null;
  return [
    `This conversation is on ${officer.name}'s own page (NMLS #${officer.nmlsId}${officer.company ? `, ${officer.company}` : ""}).`,
    `You are ${officer.firstName}'s AI assistant. If asked, say plainly that you are an AI assistant, not ${officer.firstName}, and that ${officer.firstName} reviews every request personally.`,
    `When you ask for contact consent, ask whether ${officer.name} may follow up by phone, text and email.`,
    states
      ? `${officer.firstName} is licensed to originate loans only in: ${states}. Once you know the property's state or ZIP code, if it is outside those states, say kindly that ${officer.firstName} can't help with a property there and that YPN USA can connect them with a licensed loan officer in that state. Do not describe ${officer.firstName}'s loan options for that state.`
      : `You don't know which states ${officer.firstName} is licensed in. Don't say ${officer.firstName} can help in any particular state; say ${officer.firstName} will confirm that.`,
    "Never quote rates, APRs, payments, fees, or approval odds; say the loan officer will go over real numbers.",
  ].join("\n");
}

/**
 * True when the officer may take this borrower: their licensed states include the borrower's
 * state, or no licenses are on file yet (the compliance engine warns but doesn't block then).
 */
export function officerLicensedFor(officer: Pick<OfficerChatContext, "licensedStates">, borrower: { zip?: string; state?: string }): boolean {
  if (officer.licensedStates.length === 0) return true;
  // The ZIP code is the reliable signal; a typed state only counts as a two-letter code.
  const typed = borrower.state?.trim().toUpperCase();
  const state = zipToState(borrower.zip ?? "") ?? (typed && /^[A-Z]{2}$/.test(typed) ? typed : null);
  if (!state) return true;
  return officer.licensedStates.includes(state);
}

/** Shown when an officer has no profile name yet. */
export const OFFICER_NAME_FALLBACK = "Your loan officer";

/** The first name a borrower sees for this officer (from their profile), or a neutral label. */
export function officerFirstNameFor(userId: string | undefined): string {
  if (!userId) return OFFICER_NAME_FALLBACK;
  const fullName = readDb().agentOnboarding.find((record) => record.userId === userId)?.officerProfile?.fullName?.trim();
  return fullName ? (fullName.split(/\s+/)[0] ?? fullName) : OFFICER_NAME_FALLBACK;
}

// ── Access ────────────────────────────────────────────────────────────────────

export interface ChatViewer {
  sub: string;
  role: string;
}

/**
 * The officer the chat belongs to: whoever its lead is routed to once there is a lead (so a
 * borrower moved to a licensed officer goes with their chat), otherwise the page owner.
 */
export function chatOwnerId(session: Pick<ChatSessionRecord, "officerUserId" | "crmLeadId">): string | undefined {
  if (session.crmLeadId) {
    const assigned = readDb().crmLeads.find((lead) => lead.id === session.crmLeadId)?.assignedLoId;
    if (assigned) return assigned;
  }
  return session.officerUserId;
}

/** The first name of the officer handling this chat now (after any reassignment). */
export function chatHandlerFirstName(session: Pick<ChatSessionRecord, "officerUserId" | "crmLeadId">): string {
  return officerFirstNameFor(chatOwnerId(session));
}

export function canManageChat(session: ChatSessionRecord, viewer: ChatViewer): boolean {
  if (session.mode !== "lead_qualification") return false;
  if (viewer.role === "admin") return true;
  const owner = chatOwnerId(session);
  return Boolean(owner) && owner === viewer.sub;
}

// ── Listing ──────────────────────────────────────────────────────────────────

export interface LiveChatSummary {
  sessionId: string;
  borrowerLabel: string;
  handledBy: "ai" | "officer";
  status: ChatSessionRecord["status"];
  updatedAt: string;
  messageCount: number;
  /** True when the borrower wrote last (someone owes them a reply). */
  awaitingReply: boolean;
  lastMessagePreview: string;
}

function borrowerLabel(session: ChatSessionRecord): string {
  const parts = session.capturedFields.name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "New visitor";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 90 ? `${flat.slice(0, 87)}...` : flat;
}

/** The viewer's borrower chats with activity in the last 7 days, newest first. */
export function listLiveChats(viewer: ChatViewer, now: Date = new Date()): LiveChatSummary[] {
  const since = now.getTime() - LIVE_WINDOW_MS;
  return readDb()
    .chatSessions.filter((session) => session.mode === "lead_qualification" && session.messages.length > 0)
    .filter((session) => Date.parse(session.updatedAt) >= since)
    .filter((session) => canManageChat(session, viewer))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .map((session) => {
      const last = session.messages[session.messages.length - 1];
      return {
        sessionId: session.id,
        borrowerLabel: borrowerLabel(session),
        handledBy: session.handledBy ?? "ai",
        status: session.status,
        updatedAt: session.updatedAt,
        messageCount: session.messages.length,
        awaitingReply: last?.role === "user",
        lastMessagePreview: last ? preview(last.content) : "",
      };
    });
}

export interface ChatTranscriptMessage {
  id: string;
  from: "borrower" | "cerebro" | "officer";
  /** Who typed an officer message. */
  authorName?: string;
  content: string;
  createdAt: string;
}

export function transcriptMessages(session: Pick<ChatSessionRecord, "messages">): ChatTranscriptMessage[] {
  return session.messages.map((message) => ({
    id: message.id,
    from: message.role === "user" ? "borrower" : message.author === "officer" ? "officer" : "cerebro",
    ...(message.author === "officer" && message.authorName ? { authorName: message.authorName } : {}),
    content: message.content,
    createdAt: message.createdAt,
  }));
}

// ── Takeover actions ─────────────────────────────────────────────────────────

export type TakeoverResult =
  | { ok: true; session: ChatSessionRecord }
  | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" | "NOT_TAKEN_OVER" | "EMPTY_MESSAGE" };

function mutateChat(
  sessionId: string,
  viewer: ChatViewer,
  change: (session: ChatSessionRecord) => TakeoverResult | null,
): TakeoverResult {
  const existing = readDb().chatSessions.find((session) => session.id === sessionId);
  if (!existing) return { ok: false, code: "NOT_FOUND" };
  if (!canManageChat(existing, viewer)) return { ok: false, code: "FORBIDDEN" };
  let result: TakeoverResult = { ok: false, code: "NOT_FOUND" };
  writeDb((db) => {
    const session = db.chatSessions.find((item) => item.id === sessionId);
    if (!session) return;
    const failed = change(session);
    if (failed) {
      result = failed;
      return;
    }
    session.updatedAt = new Date().toISOString();
    result = { ok: true, session: structuredClone(session) };
  });
  return result;
}

/** The officer pauses Cerebro on this chat. Idempotent. */
export function takeOverChat(sessionId: string, viewer: ChatViewer): TakeoverResult {
  return mutateChat(sessionId, viewer, (session) => {
    if (session.handledBy !== "officer") {
      session.handledBy = "officer";
      session.handledByChangedAt = new Date().toISOString();
    }
    return null;
  });
}

/** Cerebro answers this chat again. Idempotent. */
export function handBackChat(sessionId: string, viewer: ChatViewer): TakeoverResult {
  return mutateChat(sessionId, viewer, (session) => {
    if (session.handledBy === "officer") {
      session.handledBy = "ai";
      session.handledByChangedAt = new Date().toISOString();
    }
    return null;
  });
}

/** The officer's own reply to the borrower. Only while the chat is taken over. */
export function officerReply(sessionId: string, viewer: ChatViewer, text: unknown): TakeoverResult {
  const content = typeof text === "string" ? text.trim().slice(0, MAX_OFFICER_MESSAGE_LENGTH) : "";
  if (!content) return { ok: false, code: "EMPTY_MESSAGE" };
  // The borrower sees the name of whoever actually typed it, even after the chat moved officers.
  const authorName = officerFirstNameFor(viewer.sub);
  return mutateChat(sessionId, viewer, (session) => {
    if (session.handledBy !== "officer") return { ok: false, code: "NOT_TAKEN_OVER" };
    pushMessage(session, {
      id: generateId("msg"),
      role: "assistant",
      author: "officer",
      authorName,
      content,
      createdAt: new Date().toISOString(),
    });
    return null;
  });
}

function pushMessage(session: ChatSessionRecord, message: ChatMessageRecord): void {
  session.messages.push(message);
  if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
    session.messages.splice(0, session.messages.length - MAX_MESSAGES_PER_SESSION);
  }
}

/**
 * Saves a borrower message onto the stored session in one write, when the officer has taken
 * over. Returns the stored session, or null when the chat is (no longer) taken over, so the
 * caller lets Cerebro answer as usual.
 */
export function appendBorrowerMessageIfTakenOver(sessionId: string, content: string): ChatSessionRecord | null {
  let stored: ChatSessionRecord | null = null;
  writeDb((db) => {
    const session = db.chatSessions.find((item) => item.id === sessionId);
    if (!session || session.handledBy !== "officer") return;
    pushMessage(session, { id: generateId("msg"), role: "user", content, createdAt: new Date().toISOString() });
    session.updatedAt = new Date().toISOString();
    stored = structuredClone(session);
  });
  const saved = stored as ChatSessionRecord | null;
  const ownerId = saved ? chatOwnerId(saved) : undefined;
  if (saved && ownerId) alertOfficerOfChatReply(ownerId, saved.id);
  return saved;
}

/**
 * Before Cerebro's reply is saved: picks up a takeover (and any officer messages) that
 * happened while the model was answering, so saving the turn never undoes them.
 * Returns true when the officer took over meanwhile, so the AI reply must be dropped.
 */
export function reconcileWithStored(session: ChatSessionRecord): boolean {
  const stored = readDb().chatSessions.find((item) => item.id === session.id);
  if (!stored) return false;
  const known = new Set(session.messages.map((message) => message.id));
  for (const message of stored.messages) {
    if (!known.has(message.id)) session.messages.push(message);
  }
  session.messages.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  session.handledBy = stored.handledBy;
  session.handledByChangedAt = stored.handledByChangedAt;
  return stored.handledBy === "officer";
}
