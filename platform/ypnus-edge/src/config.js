// Central configuration. Everything is read once per container from environment variables so
// DSP endpoints and secrets never live in code.

/** OpenRTB bid window. Nothing in this service may wait longer than this for a DSP. */
export const MAX_BID_WINDOW_MS = 150;

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};

const json = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const list = (value, fallback = []) =>
  value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : fallback;

export function loadConfig(env = process.env) {
  return Object.freeze({
    siteDomain: env.SITE_DOMAIN || "ypnus.com",
    siteName: env.SITE_NAME || "YPN USA",
    publisherId: env.PUBLISHER_ID || "ypnus",
    // tmax tells the DSP how long it has; abort is our own hard stop and never exceeds 150ms.
    tmaxMs: Math.min(MAX_BID_WINDOW_MS, Math.max(20, int(env.OPENRTB_TMAX_MS, 130))),
    abortMs: MAX_BID_WINDOW_MS,
    segmentTimeoutMs: Math.max(5, Math.min(40, int(env.SEGMENT_TIMEOUT_MS, 25))),
    maxResponseBytes: int(env.MAX_BID_RESPONSE_BYTES, 256 * 1024),
    maxAdmBytes: int(env.MAX_ADM_BYTES, 100 * 1024),
    dsps: json(env.DSP_ENDPOINTS, []), // [{id,url,bearer?,noticeDomains:[...]}]
    bcat: list(env.BLOCKED_IAB_CATEGORIES, ["IAB7-39", "IAB9-7", "IAB14-1", "IAB25", "IAB26"]),
    badv: list(env.BLOCKED_ADVERTISER_DOMAINS),
    // Never run ads on pages that collect borrower data or take payment.
    blockedPathPrefixes: list(env.AD_BLOCKED_PATHS, [
      "/check-zip",
      "/pricing",
      "/billing",
      "/onboarding",
      "/dashboard",
      "/account",
      "/portal",
      "/login",
      "/consultation",
      "/book",
      "/claim-territory",
      "/admin",
    ]),
    allowedSizes: ["300x250", "728x90", "320x50", "300x600", "970x250", "160x600", "320x100", "336x280"],
    maxSlotsPerRequest: 6,
    floorUsd: Number.parseFloat(env.BID_FLOOR_USD ?? "0.25"),
    hmacSecret: env.AD_HMAC_SECRET || "",
    originVerify: env.ORIGIN_VERIFY || "",
    stateTable: env.STATE_TABLE || "",
    noticeTimeoutMs: int(env.NOTICE_TIMEOUT_MS, 800),
    tokenTtlSeconds: int(env.TOKEN_TTL_SECONDS, 600),
  });
}
