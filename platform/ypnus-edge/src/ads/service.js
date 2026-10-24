import { randomUUID } from "node:crypto";
import { buildBidRequest } from "../openrtb/builder.js";
import { evaluateConsent } from "../openrtb/consent.js";
import { runAuction } from "../openrtb/client.js";
import { selectWinners } from "../openrtb/response.js";
import { hashUserId } from "../segments/store.js";
import { signToken } from "../lambda/sign.js";
import { houseAdFor } from "./house.js";

const SLOT_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/i;

const houseSlot = (slot) => {
  const [w, h] = slot.size.split("x").map(Number);
  return { type: "house", w, h, ...houseAdFor(slot.size) };
};

export function adsEnabledForPath(pathname, config) {
  const p = String(pathname || "/").toLowerCase();
  return !config.blockedPathPrefixes.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/** Validate untrusted client input. Returns {ok:false,error} or {ok:true,...}. */
export function parseAdRequest(body, config) {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  let page;
  try {
    page = new URL(String(body.page));
  } catch {
    return { ok: false, error: "invalid_page" };
  }
  if (page.hostname !== config.siteDomain && page.hostname !== `www.${config.siteDomain}`) return { ok: false, error: "invalid_page_host" };
  if (!Array.isArray(body.slots) || !body.slots.length || body.slots.length > config.maxSlotsPerRequest) return { ok: false, error: "invalid_slots" };
  const seen = new Set();
  const slots = [];
  for (const raw of body.slots) {
    if (!raw || !SLOT_ID.test(String(raw.id)) || !config.allowedSizes.includes(String(raw.size)) || seen.has(raw.id)) return { ok: false, error: "invalid_slot" };
    seen.add(raw.id);
    slots.push({ id: String(raw.id), size: String(raw.size), pos: Number.isInteger(raw.pos) && raw.pos >= 0 && raw.pos <= 7 ? raw.pos : 0 });
  }
  return { ok: true, page, slots, consent: body.consent && typeof body.consent === "object" ? body.consent : {} };
}

/**
 * Full ad decision. Always resolves, never throws, and always returns an answer for every slot.
 * @param {object} deps {config, segments:SegmentStore, fetchImpl?, now?}
 */
export async function decideAds({ input, headers = {}, ip, cookies = {}, deps }) {
  const { config, segments, fetchImpl, now = () => performance.now() } = deps;
  const t0 = now();
  const timings = { segmentsMs: 0, auctionMs: 0 };
  const parsed = parseAdRequest(input, config);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };

  const houseOnly = (reason) => ({
    status: 200,
    setCookie: null,
    body: { v: 1, reason, slots: Object.fromEntries(parsed.slots.map((s) => [s.id, houseSlot(s)])) },
    metrics: { reason, bids: 0, ...timings },
  });

  if (!adsEnabledForPath(parsed.page.pathname, config)) {
    return { status: 200, body: { v: 1, reason: "path_blocked", slots: Object.fromEntries(parsed.slots.map((s) => [s.id, { type: "none" }])) }, metrics: { reason: "path_blocked", bids: 0, ...timings } };
  }
  if (!config.dsps.length) return houseOnly("no_dsp");

  const country = headers["cloudfront-viewer-country"] ?? "";
  const consent = evaluateConsent({ headers, consent: parsed.consent, country });

  // 1) Segments: capped, cached, fail-open. Only with consent.
  let uid = cookies.ypn_uid;
  let setCookie = null;
  let userId = null;
  let segs = [];
  if (consent.personalize && config.hmacSecret) {
    if (!uid || !/^[0-9a-f-]{36}$/.test(uid)) {
      uid = randomUUID();
      setCookie = `ypn_uid=${uid}; Max-Age=31536000; Path=/; Secure; HttpOnly; SameSite=Lax`;
    }
    userId = hashUserId(config.hmacSecret, uid);
    const s0 = now();
    const found = await segments.lookup(userId, config.segmentTimeoutMs);
    timings.segmentsMs = Math.round(now() - s0);
    segs = found.segments;
  }

  // 2) Auction: hard ceiling inside runAuction.
  const request = buildBidRequest({
    slots: parsed.slots,
    config,
    page: parsed.page.href,
    referrer: typeof headers.referer === "string" ? headers.referer : undefined,
    device: { ua: headers["user-agent"], ip, language: String(headers["accept-language"] ?? "").split(",")[0], country },
    consent,
    userId,
    segments: segs,
  });
  const a0 = now();
  const results = await runAuction({ dsps: config.dsps, request, windowMs: config.abortMs, maxBytes: config.maxResponseBytes, fetchImpl, now });
  timings.auctionMs = Math.round(now() - a0);
  const { winners, rejected } = selectWinners({ request, results, config });

  // 3) Shape one answer per slot.
  const slotsOut = {};
  for (const slot of parsed.slots) {
    const [w, h] = slot.size.split("x").map(Number);
    const win = winners.get(slot.id);
    if (!win) {
      slotsOut[slot.id] = houseSlot(slot);
      continue;
    }
    slotsOut[slot.id] = {
      type: "bid",
      w,
      h,
      html: win.adm,
      crid: win.crid,
      token: config.hmacSecret && (win.nurl || win.burl) ? signToken(config.hmacSecret, { j: randomUUID(), n: win.nurl, b: win.burl, p: win.price, d: win.dsp }, Date.now(), config.tokenTtlSeconds) : null,
    };
  }
  return {
    status: 200,
    setCookie,
    body: { v: 1, slots: slotsOut },
    metrics: {
      reason: "ok",
      personalized: consent.personalize,
      consentReason: consent.reason,
      segments: segs.length,
      bids: winners.size,
      dsp: results.map((r) => ({ id: r.dsp, status: r.status, ms: Math.round(r.ms) })),
      rejected: rejected.length,
      totalMs: Math.round(now() - t0),
      ...timings,
    },
  };
}
