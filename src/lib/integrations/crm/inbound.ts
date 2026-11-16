import crypto from "node:crypto";
import { readDb, writeDb } from "@/lib/db";
import { safeEqual } from "@/lib/http";
import { claimKey, releaseKey, setKeyRef } from "@/lib/idempotency";
import { hashInboundToken } from "./link";

/**
 * Updates coming back from an officer's CRM (upgrade 2.4). The CRM (usually a Zapier step)
 * posts to /api/webhooks/crm/{connection id} with the inbound token, and may:
 *  - link its own id to a YPN lead (send both leadId and externalId),
 *  - change the lead's status, and
 *  - add a note.
 * It never creates a lead, so a CRM can't make duplicates, and it can only touch leads
 * routed to the officer who owns the link. The same event (same eventId, or the same body
 * when there is none) is applied once. An update older than the last one applied is ignored.
 */

const MAX_STATUS_LENGTH = 40;
const MAX_NOTE_LENGTH = 500;
const MAX_ID_LENGTH = 120;

export type InboundResult =
  | { ok: true; leadId: string; applied: string[]; duplicate?: boolean; stale?: boolean }
  | { ok: false; status: 400 | 401 | 404 | 409; code: string; error: string };

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  // Drop control characters so a note can't break the officer's screen or logs.
  const cleaned = String(value).replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

function cleanId(value: unknown): string | undefined {
  const id = text(value, MAX_ID_LENGTH);
  return id && /^[\w.:@\-]+$/.test(id) ? id : undefined;
}

/** Finds the enabled connection whose inbound token matches. */
export function authenticateInbound(connectionId: string, token: string | null | undefined) {
  if (!token) return null;
  const connection = readDb().crmConnections.find((item) => item.id === connectionId && item.enabled);
  if (!connection) return null;
  return safeEqual(hashInboundToken(token), connection.inboundTokenHash) ? connection : null;
}

function eventKey(connectionId: string, body: Record<string, unknown>): string {
  const eventId = cleanId(body.eventId);
  if (eventId) return `id:${eventId}`;
  const canonical = JSON.stringify(Object.keys(body).sort().map((key) => [key, body[key]]));
  return `body:${crypto.createHash("sha256").update(`${connectionId}\u0000${canonical}`).digest("hex")}`;
}

export function applyCrmUpdate(
  connectionId: string,
  token: string | null | undefined,
  body: Record<string, unknown>,
  now: Date = new Date(),
): InboundResult {
  const connection = authenticateInbound(connectionId, token);
  if (!connection) return { ok: false, status: 401, code: "UNAUTHORIZED", error: "Unknown link or wrong token." };

  const leadId = cleanId(body.leadId);
  const externalId = cleanId(body.externalId);
  const status = text(body.status, MAX_STATUS_LENGTH);
  const note = text(body.note, MAX_NOTE_LENGTH);
  const updatedAtRaw = text(body.updatedAt, 40);
  const updatedAtMs = updatedAtRaw ? Date.parse(updatedAtRaw) : NaN;
  if (updatedAtRaw && Number.isNaN(updatedAtMs)) {
    return { ok: false, status: 400, code: "INVALID_UPDATED_AT", error: "updatedAt must be a date and time." };
  }
  if (!leadId && !externalId) {
    return { ok: false, status: 400, code: "MISSING_LEAD", error: "Send leadId (from YPN USA) or externalId (your CRM's id)." };
  }
  if (!status && !note && !(leadId && externalId)) {
    return { ok: false, status: 400, code: "NOTHING_TO_UPDATE", error: "Send a status, a note, or leadId with externalId to link them." };
  }

  const scope = `crm-inbound:${connection.id}`;
  const key = eventKey(connection.id, body);
  const claim = claimKey(scope, key, now);
  if (!claim.claimed) return { ok: true, leadId: claim.ref ?? "", applied: [], duplicate: true };

  let result: InboundResult = { ok: false, status: 404, code: "LEAD_NOT_FOUND", error: "No lead of yours matches." };
  writeDb((db) => {
    const mine = (id: string | undefined) => db.crmLeads.find((crm) => crm.assignedLoId === connection.userId && (crm.borrowerLeadId === id || crm.id === id));
    const byExternal = externalId
      ? db.crmLeads.find(
          (crm) =>
            crm.assignedLoId === connection.userId &&
            crm.externalRefs?.some((ref) => ref.connectionId === connection.id && ref.externalId === externalId),
        )
      : undefined;
    const crm = leadId ? mine(leadId) : byExternal;
    if (!crm) return;
    if (leadId && externalId && byExternal && byExternal.id !== crm.id) {
      result = { ok: false, status: 409, code: "EXTERNAL_ID_IN_USE", error: "That externalId is already linked to another lead." };
      return;
    }
    if (!Number.isNaN(updatedAtMs) && crm.crmUpdatedAt && updatedAtMs < Date.parse(crm.crmUpdatedAt)) {
      result = { ok: true, leadId: crm.borrowerLeadId, applied: [], stale: true };
      return;
    }

    const applied: string[] = [];
    if (leadId && externalId) {
      const refs = (crm.externalRefs ?? []).filter((ref) => ref.connectionId !== connection.id);
      refs.push({ connectionId: connection.id, externalId });
      crm.externalRefs = refs;
      applied.push("linked");
    }
    if (status && status !== crm.status) {
      crm.status = status;
      applied.push("status");
    }
    if (note) {
      crm.notes.push(`From your CRM ▸ ${note}`);
      applied.push("note");
    }
    crm.crmUpdatedAt = Number.isNaN(updatedAtMs) ? now.toISOString() : new Date(updatedAtMs).toISOString();
    const link = db.crmConnections.find((item) => item.id === connection.id);
    if (link) link.lastInboundAt = now.toISOString();
    result = { ok: true, leadId: crm.borrowerLeadId, applied };
  });

  // writeDb runs the callback synchronously; TypeScript can't see the reassignment.
  const outcome = result as InboundResult;
  if (outcome.ok) setKeyRef(scope, key, outcome.leadId);
  // A rejected update frees its key, so a corrected retry gets through.
  else releaseKey(scope, key);
  return outcome;
}
