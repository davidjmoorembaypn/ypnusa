import { randomUUID } from "node:crypto";
import { MAX_BID_WINDOW_MS } from "../config.js";

// IAB OpenRTB 2.6 bid request builder. Pure function: no I/O, no clocks except the id.

const ALPHA3 = { US: "USA", CA: "CAN", GB: "GBR", MX: "MEX", AU: "AUS" };

/** Truncate IPs before they leave our network (IPv4 /24, IPv6 /48). */
export function truncateIp(ip) {
  if (typeof ip !== "string") return {};
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return { ip: ip.split(".").slice(0, 3).concat("0").join(".") };
  if (ip.includes(":")) {
    const head = ip.split(":").slice(0, 3).join(":");
    return { ipv6: `${head}::` };
  }
  return {};
}

function buildImp(slot, { floorUsd, tagPrefix }) {
  const [w, h] = slot.size.split("x").map(Number);
  return {
    id: slot.id,
    tagid: `${tagPrefix}:${slot.id}`,
    secure: 1,
    bidfloor: floorUsd,
    bidfloorcur: "USD",
    displaymanager: "ypn-edge",
    displaymanagerver: "0.1.0",
    banner: { w, h, format: [{ w, h }], pos: slot.pos ?? 0 },
  };
}

/**
 * @param {object} input
 * @param {{id:string,size:string,pos?:number}[]} input.slots validated slots
 * @param {object} input.config result of loadConfig()
 * @param {string} input.page absolute page URL
 * @param {string} [input.referrer]
 * @param {{ua?:string, ip?:string, language?:string, country?:string}} input.device
 * @param {ReturnType<import('./consent.js').evaluateConsent>} input.consent
 * @param {string|null} input.userId already-hashed first-party id (only used when personalize)
 * @param {{id:string,name?:string,value?:string}[]} input.segments
 */
export function buildBidRequest({ slots, config, page, referrer, device = {}, consent, userId, segments = [], requestId }) {
  if (!slots?.length) throw new Error("at least one slot is required");
  const tmax = Math.min(MAX_BID_WINDOW_MS, config.tmaxMs);
  const geo = ALPHA3[String(device.country ?? "").toUpperCase()];

  const request = {
    id: requestId ?? randomUUID(),
    at: 1, // first price
    tmax,
    cur: ["USD"],
    imp: slots.map((s) => buildImp(s, { floorUsd: config.floorUsd, tagPrefix: config.publisherId })),
    site: {
      id: config.publisherId,
      name: config.siteName,
      domain: config.siteDomain,
      page,
      ...(referrer ? { ref: referrer } : {}),
      privacypolicy: 1,
      publisher: { id: config.publisherId, name: config.siteName, domain: config.siteDomain },
    },
    device: {
      ...(device.ua ? { ua: device.ua } : {}),
      ...truncateIp(device.ip),
      ...(device.language ? { language: String(device.language).slice(0, 2).toLowerCase() } : {}),
      ...(consent.gpc ? { dnt: 1, lmt: 1 } : {}),
      ...(geo ? { geo: { country: geo } } : {}),
    },
    regs: {
      coppa: 0,
      ...(consent.gdprApplies ? { gdpr: 1 } : {}),
      ...(consent.usPrivacy ? { us_privacy: consent.usPrivacy } : {}),
      ...(consent.gpp ? { gpp: consent.gpp, gpp_sid: consent.gppSid } : {}),
      ext: {
        ...(consent.gdprApplies ? { gdpr: 1 } : {}),
        ...(consent.usPrivacy ? { us_privacy: consent.usPrivacy } : {}),
        ...(consent.gpc ? { gpc: 1 } : {}),
      },
    },
    source: { tid: randomUUID() },
  };
  if (config.bcat.length) request.bcat = config.bcat;
  if (config.badv.length) request.badv = config.badv;

  // Personal data only with an explicit opt-in and no opt-out signal.
  if (consent.personalize && userId) {
    const segs = segments.map((s) => ({ id: s.id, ...(s.name ? { name: s.name } : {}), ...(s.value ? { value: s.value } : {}) }));
    request.user = {
      id: userId,
      ...(consent.tcf ? { consent: consent.tcf } : {}),
      ...(segs.length ? { data: [{ id: "ypn-first-party", name: "ypnus.com first-party", segment: segs }] } : {}),
      ext: {
        ...(consent.tcf ? { consent: consent.tcf } : {}),
        ypn: { v: 1, segs: segs.map((s) => s.id) },
      },
    };
  }
  return request;
}
