import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
import { generateId } from "./id";
import { readDb, secretsDir, writeDb } from "./db";
import { checkOutboundUrlResolves } from "./integrations/crm/url-safety";
import type { PushSubscriptionRecord } from "./types";

/**
 * Phone alerts for loan officers (upgrade 3.4), sent with standard Web Push: no account,
 * no cost. Alert text never contains borrower details (no names, phone numbers, emails,
 * ZIP codes or amounts). The officer opens the app, signs in, and sees the detail there.
 *
 * Keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY from the environment when set; otherwise a
 * key pair is generated once and kept in <data dir>/secrets/vapid-keys.json (mode 0600),
 * so the server needs no setup step. Subscriptions are encrypted at rest (pii-snapshot.ts).
 */

const MAX_SUBSCRIPTIONS_PER_USER = 10;
const DEFAULT_SUBJECT = "mailto:support@ypnus.com";

export interface PushAlert {
  title: string;
  body: string;
  /** Same-site path to open on tap, e.g. /portal/live-chats. */
  url: string;
  /** Alerts with the same tag replace each other on the phone instead of stacking. */
  tag?: string;
}

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let cachedKeys: VapidKeys | null = null;

function keyFile(): string {
  return path.join(/*turbopackIgnore: true*/ secretsDir(), "vapid-keys.json");
}

function isKeys(value: unknown): value is VapidKeys {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as VapidKeys).publicKey === "string" &&
    typeof (value as VapidKeys).privateKey === "string"
  );
}

/** The server's VAPID key pair: environment first, then the saved file, else a new saved pair. */
export function vapidKeys(): VapidKeys {
  if (cachedKeys) return cachedKeys;
  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  if (envPublic && envPrivate) {
    cachedKeys = { publicKey: envPublic, privateKey: envPrivate };
    return cachedKeys;
  }
  const file = keyFile();
  const saved = readKeyFile(file);
  if (saved) {
    cachedKeys = saved;
    return cachedKeys;
  }
  // Two processes may get here at once. Each writes its own temp file, and only the first
  // hard link to the real name succeeds (it is atomic and refuses to overwrite), so every
  // process ends up with the same key pair: the one that won.
  const generated = webpush.generateVAPIDKeys();
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(/*turbopackIgnore: true*/ temp, JSON.stringify(generated), { mode: 0o600 });
  try {
    fs.linkSync(/*turbopackIgnore: true*/ temp, file);
    cachedKeys = generated;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const winner = readKeyFile(file);
    if (!winner) throw new Error("Push keys file exists but can't be read.");
    cachedKeys = winner;
  } finally {
    fs.rmSync(/*turbopackIgnore: true*/ temp, { force: true });
  }
  return cachedKeys;
}

function readKeyFile(file: string): VapidKeys | null {
  try {
    const saved: unknown = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8"));
    return isKeys(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** Test hook: forget cached keys. */
export function resetPushKeysForTests(): void {
  cachedKeys = null;
}

/** Browser push services. A subscription must point at one of them, never anywhere else. */
const PUSH_SERVICE_HOSTS = new Set(["fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
const PUSH_SERVICE_SUFFIXES = [".push.apple.com", ".notify.windows.com", ".push.services.mozilla.com"];

export function isPushServiceUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
    const host = url.hostname.toLowerCase();
    return PUSH_SERVICE_HOSTS.has(host) || PUSH_SERVICE_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

function isKeyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256 && /^[A-Za-z0-9_\-=+/]+$/.test(value);
}

export type SaveSubscriptionResult = { ok: true } | { ok: false; error: string };

/** Saves (or refreshes) one browser's subscription for the signed-in officer. */
export function saveSubscription(userId: string, input: unknown): SaveSubscriptionResult {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Missing subscription." };
  const { endpoint, keys } = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (!isPushServiceUrl(endpoint)) return { ok: false, error: "Invalid subscription." };
  if (!keys || !isKeyString(keys.p256dh) || !isKeyString(keys.auth)) return { ok: false, error: "Invalid subscription." };
  const p256dh = keys.p256dh;
  const auth = keys.auth;
  writeDb((db) => {
    // One endpoint belongs to one account: re-subscribing on a shared device moves it.
    db.pushSubscriptions = db.pushSubscriptions.filter((item) => item.endpoint !== endpoint);
    const mine = db.pushSubscriptions.filter((item) => item.userId === userId);
    if (mine.length >= MAX_SUBSCRIPTIONS_PER_USER) {
      const oldest = [...mine].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
      db.pushSubscriptions = db.pushSubscriptions.filter((item) => item.id !== oldest.id);
    }
    db.pushSubscriptions.push({
      id: generateId("push"),
      userId,
      endpoint,
      keys: { p256dh, auth },
      createdAt: new Date().toISOString(),
    });
  });
  return { ok: true };
}

/** Removes this browser's subscription (only the signed-in officer's own). */
export function removeSubscription(userId: string, endpoint: unknown): void {
  if (typeof endpoint !== "string") return;
  writeDb((db) => {
    db.pushSubscriptions = db.pushSubscriptions.filter(
      (item) => !(item.userId === userId && item.endpoint === endpoint),
    );
  });
}

export function hasSubscription(userId: string): boolean {
  return readDb().pushSubscriptions.some((item) => item.userId === userId);
}

/** Only same-site paths, so an alert can never send the officer to another site. */
function safePath(url: string): string {
  return url.startsWith("/") && !url.startsWith("//") ? url : "/";
}

type Sender = (subscription: PushSubscriptionRecord, payload: string) => Promise<{ statusCode: number }>;

const defaultSender: Sender = async (subscription, payload) => {
  // Checked again at send time: only a known push service on a public address.
  // A disallowed address counts as gone (the subscription is dropped); a DNS hiccup does not.
  if (!isPushServiceUrl(subscription.endpoint)) throw Object.assign(new Error("push endpoint not allowed"), { statusCode: 410 });
  const check = await checkOutboundUrlResolves(subscription.endpoint);
  if (!check.ok) {
    throw Object.assign(new Error("push endpoint not reachable"), { statusCode: check.reason === "unresolved" ? undefined : 410 });
  }
  const keys = vapidKeys();
  return webpush.sendNotification(
    { endpoint: subscription.endpoint, keys: subscription.keys },
    payload,
    {
      TTL: 60 * 60,
      urgency: "high",
      vapidDetails: {
        subject: process.env.VAPID_SUBJECT?.trim() || DEFAULT_SUBJECT,
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
      },
    },
  );
};

let sender: Sender = defaultSender;

/** Test hook: replace the network sender. */
export function setPushSenderForTests(next: Sender | null): void {
  sender = next ?? defaultSender;
}

/**
 * Sends one alert to every device the officer turned alerts on for. Never throws: a
 * failed alert must not break the lead or chat that triggered it. Gone subscriptions
 * (404/410) are removed. Returns how many devices accepted it.
 */
export async function sendPushToUser(userId: string, alert: PushAlert): Promise<number> {
  const subscriptions = readDb().pushSubscriptions.filter((item) => item.userId === userId);
  if (subscriptions.length === 0) return 0;
  const payload = JSON.stringify({
    title: alert.title.slice(0, 80),
    body: alert.body.slice(0, 160),
    url: safePath(alert.url),
    ...(alert.tag ? { tag: alert.tag.slice(0, 64) } : {}),
  });
  let delivered = 0;
  const gone: string[] = [];
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await sender(subscription, payload);
        delivered += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(subscription.id);
        else console.warn(`[push] alert not delivered (status ${status ?? "unknown"})`);
      }
    }),
  );
  if (gone.length === 0 && delivered === 0) return 0;
  writeDb((db) => {
    if (gone.length > 0) db.pushSubscriptions = db.pushSubscriptions.filter((item) => !gone.includes(item.id));
    if (delivered > 0) {
      const at = new Date().toISOString();
      for (const item of db.pushSubscriptions) if (item.userId === userId && !gone.includes(item.id)) item.lastSentAt = at;
    }
  });
  return delivered;
}

/** Fire-and-forget wrapper for synchronous callers. */
export function queuePushToUser(userId: string, alert: PushAlert): void {
  void sendPushToUser(userId, alert).catch(() => {
    // sendPushToUser never throws; this only guards against the unexpected.
  });
}
