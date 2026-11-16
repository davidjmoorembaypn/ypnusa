import crypto from "node:crypto";
import { writeDb } from "./db";

/**
 * "Process this once" for webhooks and jobs. Senders retry on timeouts, so the same
 * lead or event can arrive twice; claimKey() makes the second delivery a no-op that
 * returns what the first one created.
 *
 * Keys are stored hashed (they may be built from an email or phone) and expire after
 * KEY_TTL_DAYS. The claim happens inside one writeDb() call, which holds the store's
 * cross-process lock, so two simultaneous deliveries cannot both win.
 */

const KEY_TTL_DAYS = 30;
const MAX_KEYS = 20_000;

function hashKey(scope: string, key: string): string {
  return crypto.createHash("sha256").update(`${scope}\u0000${key}`).digest("hex");
}

export type ClaimResult = { claimed: true } | { claimed: false; ref?: string };

export function claimKey(scope: string, key: string, now: Date = new Date()): ClaimResult {
  const hashed = hashKey(scope, key);
  const cutoff = new Date(now.getTime() - KEY_TTL_DAYS * 24 * 60 * 60_000).toISOString();
  let result: ClaimResult = { claimed: true };
  writeDb((db) => {
    db.processedKeys = db.processedKeys.filter((record) => record.at >= cutoff).slice(-MAX_KEYS);
    const existing = db.processedKeys.find((record) => record.scope === scope && record.key === hashed);
    if (existing) {
      result = { claimed: false, ref: existing.ref };
      return;
    }
    db.processedKeys.push({ key: hashed, scope, at: now.toISOString() });
  });
  return result;
}

/** Saves what the first delivery created, so duplicates can point to it. */
export function setKeyRef(scope: string, key: string, ref: string): void {
  const hashed = hashKey(scope, key);
  writeDb((db) => {
    const record = db.processedKeys.find((item) => item.scope === scope && item.key === hashed);
    if (record) record.ref = ref;
  });
}

/** Frees a key when processing failed, so the sender's retry can succeed. */
export function releaseKey(scope: string, key: string): void {
  const hashed = hashKey(scope, key);
  writeDb((db) => {
    db.processedKeys = db.processedKeys.filter((item) => !(item.scope === scope && item.key === hashed));
  });
}

/**
 * A stable key for an inbound lead with no id of its own: same email, phone and
 * program on the same day (UTC) count as the same lead.
 */
export function leadFingerprint(input: { email: string; phone: string; program: string; now?: Date }): string {
  const day = (input.now ?? new Date()).toISOString().slice(0, 10);
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.replace(/\D/g, "").slice(-10);
  return `${email}|${phone}|${input.program}|${day}`;
}
