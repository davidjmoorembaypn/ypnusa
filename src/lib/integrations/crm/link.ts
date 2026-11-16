import crypto from "node:crypto";
import dnsCallback from "node:dns";
import https from "node:https";
import { readDb, writeDb } from "@/lib/db";
import { generateId } from "@/lib/id";
import { OUTBOUND_TIMEOUT_MS } from "@/lib/outbound";
import { scoreLead } from "@/lib/scoring/lead-score";
import type { CrmConnectionRecord, CrmDeliveryRecord } from "@/lib/types";
import { checkOutboundUrlResolves, isPrivateAddress } from "./url-safety";

/**
 * A loan officer's two-way link to their own CRM (upgrade 2), built for Zapier but usable by
 * any system that can receive and send a webhook. No vendor account or paid plan needed.
 *
 * Out: when a lead is routed to the officer, YPN USA posts a "lead.created" event to their
 * address, signed with HMAC-SHA256 (X-YPN-Signature: t=<unix>,v1=<hex of HMAC(secret, t.body)>).
 * The event id stays the same across retries, so the receiver can drop duplicates.
 * In: the CRM posts status changes and notes to /api/webhooks/crm/{connection id} with the
 * inbound token (see inbound.ts).
 *
 * Nothing here logs an address, a secret or a borrower detail. Delivery records keep only
 * ids, statuses and HTTP codes; the event body is rebuilt from the lead at send time.
 */

export const CRM_SIGNATURE_HEADER = "X-YPN-Signature";
/** Retry waits after the 1st, 2nd and 3rd failed try. The 4th failure is final. */
const RETRY_DELAYS_MS = [30_000, 2 * 60_000, 10 * 60_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const MAX_DELIVERIES_PER_CONNECTION = 50;
/** How long one process holds a delivery while it sends it. Past this, another may take over. */
const CLAIM_MS = OUTBOUND_TIMEOUT_MS + 30_000;

function randomSecret(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(24).toString("base64url")}`;
}

export function hashInboundToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function signCrmBody(body: string, secret: string, timestamp: number): string {
  const digest = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

// ── Connection settings ──────────────────────────────────────────────────────

export interface CrmConnectionView {
  connected: boolean;
  connectionId?: string;
  /** Host only (e.g. hooks.zapier.com): the full address may hold a secret. */
  outboundHost?: string;
  createdAt?: string;
  lastOutboundAt?: string;
  lastOutboundOk?: boolean;
  lastInboundAt?: string;
  recentDeliveries: Array<Pick<CrmDeliveryRecord, "id" | "event" | "status" | "attempts" | "createdAt" | "sentAt" | "lastHttpStatus" | "lastError">>;
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export function crmConnectionView(userId: string): CrmConnectionView {
  const db = readDb();
  const connection = db.crmConnections.find((item) => item.userId === userId && item.enabled);
  if (!connection) return { connected: false, recentDeliveries: [] };
  const recentDeliveries = db.crmDeliveries
    .filter((item) => item.connectionId === connection.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 10)
    .map(({ id, event, status, attempts, createdAt, sentAt, lastHttpStatus, lastError }) => ({
      id,
      event,
      status,
      attempts,
      createdAt,
      sentAt,
      lastHttpStatus,
      lastError,
    }));
  return {
    connected: true,
    connectionId: connection.id,
    outboundHost: hostOf(connection.outboundUrl),
    createdAt: connection.createdAt,
    lastOutboundAt: connection.lastOutboundAt,
    lastOutboundOk: connection.lastOutboundOk,
    lastInboundAt: connection.lastInboundAt,
    recentDeliveries,
  };
}

export type ConnectResult =
  | { ok: true; connectionId: string; signingSecret: string; inboundToken: string }
  | { ok: false; error: string };

/**
 * Saves (or replaces) the officer's CRM link. Returns the signing secret and inbound token
 * once; only a hash of the token is kept, so a lost token means connecting again.
 */
export async function connectCrm(userId: string, rawUrl: unknown): Promise<ConnectResult> {
  const check = await checkOutboundUrlResolves(rawUrl);
  if (!check.ok) return check;
  const signingSecret = randomSecret("ypnsig");
  const inboundToken = randomSecret("ypnin");
  const now = new Date().toISOString();
  const connection: CrmConnectionRecord = {
    id: generateId("crmc"),
    userId,
    outboundUrl: check.url.toString(),
    signingSecret,
    inboundTokenHash: hashInboundToken(inboundToken),
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
  writeDb((db) => {
    // One link per officer: a new one replaces the old, so old tokens stop working. The officer
    // keeps their CRM's ids on their leads and any lead still waiting to go out: a new address
    // usually means a new Zap for the same CRM. Disconnecting is how to start clean.
    const old = new Set(db.crmConnections.filter((item) => item.userId === userId).map((item) => item.id));
    db.crmConnections = db.crmConnections.filter((item) => item.userId !== userId);
    db.crmDeliveries = db.crmDeliveries
      .filter((item) => !old.has(item.connectionId) || (item.status === "pending" && item.event === "lead.created"))
      .map((item) => (old.has(item.connectionId) ? { ...item, connectionId: connection.id, claimId: undefined, claimUntil: undefined } : item));
    for (const crm of db.crmLeads) {
      if (crm.assignedLoId !== userId || !crm.externalRefs?.some((ref) => old.has(ref.connectionId))) continue;
      const moved = crm.externalRefs.map((ref) => (old.has(ref.connectionId) ? { ...ref, connectionId: connection.id } : ref));
      // At most one id per connection: the most recently linked one wins.
      const byConnection = new Map(moved.map((ref) => [ref.connectionId, ref]));
      crm.externalRefs = [...byConnection.values()];
    }
    db.crmConnections.push(connection);
  });
  return { ok: true, connectionId: connection.id, signingSecret, inboundToken };
}

export function disconnectCrm(userId: string): void {
  writeDb((db) => {
    const old = new Set(db.crmConnections.filter((item) => item.userId === userId).map((item) => item.id));
    db.crmConnections = db.crmConnections.filter((item) => item.userId !== userId);
    db.crmDeliveries = db.crmDeliveries.filter((item) => !old.has(item.connectionId));
  });
}

// ── Outbound events ──────────────────────────────────────────────────────────

export interface CrmLeadEvent {
  event: CrmDeliveryRecord["event"];
  eventId: string;
  occurredAt: string;
  source: "ypnus.com";
  lead: {
    id: string;
    crmLeadId?: string;
    createdAt: string;
    status?: string;
    name?: string;
    email?: string;
    phone?: string;
    /** The borrower agreed to be contacted by this officer. Check it before calling or texting. */
    contactConsent: boolean;
    zip?: string;
    loanProgram?: string;
    purchaseOrRefinance?: string;
    timeline?: string;
    creditBand?: string;
    propertyType?: string;
    firstTimeBuyer?: boolean;
    leadScore?: number;
    leadScoreBand?: string;
    funnelSource?: string;
  };
}

/** The event body for a delivery, built from the lead as it is now. Null when the lead is gone. */
export function buildCrmEvent(delivery: CrmDeliveryRecord): CrmLeadEvent | null {
  const base = { event: delivery.event, eventId: delivery.id, occurredAt: delivery.createdAt, source: "ypnus.com" as const };
  if (delivery.event === "test") {
    return {
      ...base,
      lead: {
        id: "lead_test_example",
        createdAt: delivery.createdAt,
        status: "new_ai_routed",
        name: "Test Borrower",
        email: "test.borrower@example.com",
        phone: "+15555550100",
        contactConsent: true,
        zip: "93277",
        loanProgram: "fha",
        purchaseOrRefinance: "purchase",
        timeline: "0-3 months",
        creditBand: "660-699",
        leadScore: 72,
        leadScoreBand: "hot",
        funnelSource: "test",
      },
    };
  }
  const db = readDb();
  const lead = db.borrowerLeads.find((item) => item.id === delivery.borrowerLeadId);
  if (!lead || lead.assignedLoId !== delivery.userId) return null;
  const crm = db.crmLeads.find((item) => item.borrowerLeadId === lead.id);
  const answers = lead.answers;
  const score = scoreLead({ lead });
  return {
    ...base,
    lead: {
      id: lead.id,
      crmLeadId: crm?.id,
      createdAt: lead.createdAt,
      status: crm?.status,
      name: answers.name,
      email: answers.email,
      phone: answers.phone,
      contactConsent: answers.contactConsent === true,
      zip: answers.zip,
      loanProgram: answers.loanProgram,
      purchaseOrRefinance: answers.purchaseRefiIntent,
      timeline: answers.timeline,
      creditBand: answers.estimatedCreditBand,
      propertyType: answers.propertyType,
      firstTimeBuyer: answers.firstTimeBuyer,
      leadScore: score.score,
      leadScoreBand: score.band,
      funnelSource: lead.funnelSource,
    },
  };
}

type FetchInit = { method: "POST"; headers: Record<string, string>; body: string; redirect: "manual"; signal: AbortSignal };
type Fetcher = (url: string, init: FetchInit) => Promise<{ status: number }>;

/**
 * DNS lookup for the send itself: refuses to connect when the name now resolves to a private
 * address. The earlier check alone isn't enough, because the name is looked up again to connect
 * and a hostile DNS server can answer differently the second time (DNS rebinding).
 */
export function publicOnlyLookup(
  hostname: string,
  options: dnsCallback.LookupOptions,
  callback: (error: NodeJS.ErrnoException | null, address: string | dnsCallback.LookupAddress[], family?: number) => void,
): void {
  dnsCallback.lookup(hostname, { ...options, all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error, []);
    const list = addresses as dnsCallback.LookupAddress[];
    if (list.length === 0 || list.some((entry) => isPrivateAddress(entry.address))) {
      const blocked: NodeJS.ErrnoException = new Error("address not allowed");
      blocked.code = "EADDRBLOCKED";
      return callback(blocked, []);
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

/** One https POST that never follows a redirect and only connects to public addresses. */
const defaultFetcher: Fetcher = (url, init) =>
  new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: init.method,
        headers: { ...init.headers, "Content-Length": String(Buffer.byteLength(init.body)) },
        lookup: publicOnlyLookup as unknown as https.RequestOptions["lookup"],
        signal: init.signal,
      },
      (response) => {
        response.resume();
        resolve({ status: response.statusCode ?? 0 });
      },
    );
    request.on("error", reject);
    request.end(init.body);
  });
let fetcher: Fetcher = defaultFetcher;

/** Test hook: replace the network call. */
export function setCrmFetchForTests(next: Fetcher | null): void {
  fetcher = next ?? defaultFetcher;
}

let scheduleRetries = true;
/** Test hook: turn off in-process retry timers (tests drive retries with processDueCrmDeliveries). */
export function setCrmRetryTimersForTests(enabled: boolean): void {
  scheduleRetries = enabled;
}

function pruneDeliveries(deliveries: CrmDeliveryRecord[], connectionId: string): CrmDeliveryRecord[] {
  const mine = deliveries
    // A delivery still waiting to go out is never dropped, or its lead would never reach the CRM.
    .filter((item) => item.connectionId === connectionId && item.status !== "pending")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const drop = new Set(mine.slice(MAX_DELIVERIES_PER_CONNECTION).map((item) => item.id));
  return deliveries.filter((item) => !drop.has(item.id));
}

/**
 * Records an event for the officer's CRM and starts sending it. Does nothing when the
 * officer has no CRM link. Never throws: a CRM problem must not break the lead.
 */
export function queueCrmEvent(
  userId: string,
  event: CrmDeliveryRecord["event"],
  borrowerLeadId?: string,
  options: { sendNow?: boolean } = {},
): CrmDeliveryRecord | null {
  try {
    const connection = readDb().crmConnections.find((item) => item.userId === userId && item.enabled);
    if (!connection) return null;
    const delivery: CrmDeliveryRecord = {
      id: generateId("crmevt"),
      connectionId: connection.id,
      userId,
      event,
      borrowerLeadId,
      status: "pending",
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
    writeDb((db) => {
      db.crmDeliveries.push(delivery);
      db.crmDeliveries = pruneDeliveries(db.crmDeliveries, connection.id);
    });
    if (options.sendNow !== false) {
      void deliverCrmEvent(delivery.id).catch(() => {
        // deliverCrmEvent records its own failures; this only guards the unexpected.
      });
    }
    return delivery;
  } catch {
    console.warn("[crm] could not queue a CRM event");
    return null;
  }
}

/**
 * Sends a lead to its officer's CRM once: when the lead first reaches them, and again only if
 * it later moves to another officer. Never sends the same lead twice to one CRM link.
 */
export function queueLeadForOfficer(userId: string, borrowerLeadId: string): CrmDeliveryRecord | null {
  try {
    const db = readDb();
    const connection = db.crmConnections.find((item) => item.userId === userId && item.enabled);
    if (!connection) return null;
    const already = db.crmDeliveries.some(
      (item) => item.connectionId === connection.id && item.event === "lead.created" && item.borrowerLeadId === borrowerLeadId,
    );
    if (already) return null;
    return queueCrmEvent(userId, "lead.created", borrowerLeadId);
  } catch {
    console.warn("[crm] could not queue a CRM event");
    return null;
  }
}

type Attempt = { ok: true; status: number } | { ok: false; status: number; error: string; final?: boolean };

async function attemptSend(connection: CrmConnectionRecord, delivery: CrmDeliveryRecord): Promise<Attempt> {
  const event = buildCrmEvent(delivery);
  if (!event) return { ok: false, status: 0, error: "lead_unavailable", final: true };
  const check = await checkOutboundUrlResolves(connection.outboundUrl);
  if (!check.ok) {
    // A name that doesn't resolve right now may be a passing DNS problem: try again later.
    // An address that resolves to a private network is never sent to.
    return check.reason === "unresolved"
      ? { ok: false, status: 0, error: "no_response" }
      : { ok: false, status: 0, error: "address_blocked", final: true };
  }
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  try {
    const response = await fetcher(check.url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "YPN-USA-CRM-Link/1",
        "X-YPN-Event": event.event,
        "X-YPN-Event-Id": event.eventId,
        [CRM_SIGNATURE_HEADER]: signCrmBody(body, connection.signingSecret, timestamp),
      },
      body,
      // Never follow a redirect: it could point at an internal address.
      redirect: "manual",
      signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
    });
    if (response.status >= 200 && response.status < 300) return { ok: true, status: response.status };
    const final = response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429;
    return { ok: false, status: response.status, error: response.status >= 300 && response.status < 400 ? "redirect" : "http_error", final };
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "EADDRBLOCKED") return { ok: false, status: 0, error: "address_blocked", final: true };
    return { ok: false, status: 0, error: "no_response" };
  }
}

/** Deliveries being sent right now in this process, so a timer and a cron run never send one twice at once. */
const inFlight = new Set<string>();

/** Sends one queued event (one try). Returns the delivery as stored afterwards. */
export async function deliverCrmEvent(deliveryId: string, now: Date = new Date()): Promise<CrmDeliveryRecord | null> {
  if (inFlight.has(deliveryId)) return null;
  inFlight.add(deliveryId);
  try {
    return await deliverOnce(deliveryId, now);
  } finally {
    inFlight.delete(deliveryId);
  }
}

async function deliverOnce(deliveryId: string, now: Date): Promise<CrmDeliveryRecord | null> {
  // Claim the delivery in the shared store before any network call, so two server processes
  // (or a timer and the automation run) never send it at once or count one failure twice.
  const claimId = crypto.randomUUID();
  let claimed: { delivery: CrmDeliveryRecord; connection: CrmConnectionRecord } | null = null;
  let current: CrmDeliveryRecord | null = null;
  writeDb((store) => {
    const row = store.crmDeliveries.find((item) => item.id === deliveryId);
    if (!row) return;
    current = structuredClone(row);
    if (row.status !== "pending") return;
    // Not due yet: a newer retry time was stored after this call was scheduled.
    if (row.nextAttemptAt && Date.parse(row.nextAttemptAt) > now.getTime()) return;
    // Someone else is sending it right now.
    if (row.claimId && row.claimUntil && Date.parse(row.claimUntil) > Date.now()) return;
    const link = store.crmConnections.find((item) => item.id === row.connectionId && item.enabled);
    if (!link) {
      row.status = "failed";
      row.lastError = "link_removed";
      row.nextAttemptAt = undefined;
      current = structuredClone(row);
      return;
    }
    row.claimId = claimId;
    row.claimUntil = new Date(Date.now() + CLAIM_MS).toISOString();
    claimed = { delivery: structuredClone(row), connection: structuredClone(link) };
  });
  const job = claimed as { delivery: CrmDeliveryRecord; connection: CrmConnectionRecord } | null;
  if (!job) return current as CrmDeliveryRecord | null;

  const result = await attemptSend(job.connection, job.delivery);
  let stored: CrmDeliveryRecord | null = null;
  let retryIn: number | null = null;
  writeDb((store) => {
    const row = store.crmDeliveries.find((item) => item.id === deliveryId);
    // Only the process holding the claim records the result.
    if (!row || row.status !== "pending" || row.claimId !== claimId) return;
    row.claimId = undefined;
    row.claimUntil = undefined;
    row.attempts += 1;
    row.lastHttpStatus = result.status;
    const link = store.crmConnections.find((item) => item.id === row.connectionId);
    if (link) {
      link.lastOutboundAt = now.toISOString();
      link.lastOutboundOk = result.ok;
    }
    if (result.ok) {
      row.status = "sent";
      row.sentAt = now.toISOString();
      row.lastError = undefined;
      row.nextAttemptAt = undefined;
    } else if (result.final || row.attempts >= MAX_ATTEMPTS) {
      row.status = "failed";
      row.lastError = result.error;
      row.nextAttemptAt = undefined;
    } else {
      retryIn = RETRY_DELAYS_MS[row.attempts - 1];
      row.lastError = result.error;
      row.nextAttemptAt = new Date(now.getTime() + retryIn).toISOString();
    }
    stored = structuredClone(row);
  });
  const saved = stored as CrmDeliveryRecord | null;
  const wait = retryIn as number | null;
  if (!result.ok) console.warn(`[crm] event not delivered (status ${result.status || "none"}, ${result.error})`);
  if (wait !== null && scheduleRetries) {
    const timer = setTimeout(() => {
      void deliverCrmEvent(deliveryId).catch(() => {});
    }, wait);
    timer.unref?.();
  }
  return saved;
}

/** Retries events whose wait is over. Called by the automation run; safe to call any time. */
export async function processDueCrmDeliveries(now: Date = new Date(), limit = 25): Promise<{ attempted: number; sent: number }> {
  const due = readDb()
    .crmDeliveries.filter((item) => item.status === "pending" && (!item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= now.getTime()))
    .slice(0, limit);
  let sent = 0;
  for (const delivery of due) {
    const result = await deliverCrmEvent(delivery.id, now);
    if (result?.status === "sent") sent += 1;
  }
  return { attempted: due.length, sent };
}
