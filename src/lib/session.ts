import fs from "fs";
import path from "path";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { isPricingTierId, type PricingTierId } from "@/lib/pricing";

/**
 * Signed, stateless session tokens for app.ypnus.com.
 *
 * The cookie this backs is intentionally host-only (no `domain` attribute), so it is
 * never sent to ypnus.com — application sessions live exclusively on this host.
 */

export type SessionRole = "mlo" | "admin";

/** Mirrors Stripe/WordPress subscription_status values — see docs/sso-handoff.md. */
export type EntitlementStatus = "active" | "trialing" | "past_due" | "canceled" | "none";

export interface SessionPayload {
  /** Stable subject identifier (WordPress user id, or `dev_<email>` in local dev). */
  sub: string;
  email: string;
  role: SessionRole;
  iat: number;
  exp: number;
  /**
   * Entitlement claims carried from the SSO handoff (see verifySsoHandoff in
   * sso.ts) so every request can resolve paid capability from the signed
   * session alone, with no extra lookup. All optional and absent on older
   * tokens/local dev-login sessions — src/lib/entitlements.ts treats a
   * missing tier as "free" (fails closed to the least-privileged tier,
   * never grants paid capability by omission). See docs/sso-handoff.md for
   * the exact claim contract WordPress must send once it adopts this.
   */
  tier?: PricingTierId;
  subscriptionStatus?: EntitlementStatus;
  /** ISO timestamp — set only when subscriptionStatus is "trialing". */
  trialEndsAt?: string;
}

export function isEntitlementStatus(value: unknown): value is EntitlementStatus {
  return value === "active" || value === "trialing" || value === "past_due" || value === "canceled" || value === "none";
}

export { isPricingTierId };

export const SESSION_COOKIE_NAME = "ypnus_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

/**
 * Fallback secret resolution when SESSION_SECRET isn't configured.
 *
 * Proxy and Route Handlers run as separate module instances (even on a single Node
 * host), so a purely in-memory random secret would sign tokens that the other side
 * can never verify. Persisting it to disk — same data dir as store.json — keeps every
 * process in agreement without requiring an env var, matching this project's "runs
 * fully without environment variables" default.
 */
let cachedDataDir: string | null = null;
function dataDir(): string {
  if (cachedDataDir) return cachedDataDir;
  const configured = process.env.LOANPILOT_DATA_DIR?.trim();
  cachedDataDir = configured || path.resolve(/*turbopackIgnore: true*/ "data");
  return cachedDataDir;
}

let cachedSecret: string | null = null;
let warnedMissingSecret = false;

function loadOrCreatePersistedSecret(): string {
  if (cachedSecret) return cachedSecret;
  const file = path.join(dataDir(), "session-secret.key");

  try {
    const existing = fs.readFileSync(file, "utf8").trim();
    if (existing) {
      cachedSecret = existing;
      return cachedSecret;
    }
  } catch (error) {
    // Doesn't exist yet or unreadable — generate below.
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.warn(
        `[session] Unable to read the persisted session secret at ${file} — generating a new one; existing sessions will be invalidated.`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const generated = randomBytes(32).toString("hex");
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(file, generated, { mode: 0o600 });
  } catch (error) {
    // Read-only/serverless filesystem: this process still works, but sessions won't
    // validate against other processes/instances until SESSION_SECRET is set.
    console.warn(
      `[session] Unable to persist the session secret to ${file} — sessions will not validate ` +
        "across processes or instances. Set SESSION_SECRET explicitly.",
      error instanceof Error ? error.message : error,
    );
  }
  cachedSecret = generated;
  return cachedSecret;
}

function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;
  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn(
      "[session] SESSION_SECRET is not set — falling back to a secret persisted at " +
        "<data dir>/session-secret.key. Set SESSION_SECRET explicitly in production.",
    );
  }
  return loadOrCreatePersistedSecret();
}

function sign(payloadB64: string): string {
  return createHmac("sha256", sessionSecret()).update(payloadB64).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function createSessionToken(user: {
  sub: string;
  email: string;
  role: SessionRole;
  tier?: PricingTierId;
  subscriptionStatus?: EntitlementStatus;
  trialEndsAt?: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: user.sub,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    tier: user.tier,
    subscriptionStatus: user.subscriptionStatus,
    trialEndsAt: user.trialEndsAt,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payloadB64 || !sig) return null;

  if (!safeEqual(sig, sign(payloadB64))) return null;

  try {
    const raw = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof raw.exp !== "number" || raw.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof raw.sub !== "string" || !raw.sub) return null;
    if (typeof raw.email !== "string" || !raw.email) return null;
    if (raw.role !== "mlo" && raw.role !== "admin") return null;

    const payload: SessionPayload = {
      sub: raw.sub,
      email: raw.email,
      role: raw.role,
      iat: typeof raw.iat === "number" ? raw.iat : 0,
      exp: raw.exp,
    };
    // Every entitlement field is verified independently and dropped (not just
    // ignored downstream) if malformed — a tampered/old-shape token degrades
    // to "no entitlement claim," never to a guessed or partial one.
    if (isPricingTierId(raw.tier)) payload.tier = raw.tier;
    if (isEntitlementStatus(raw.subscriptionStatus)) payload.subscriptionStatus = raw.subscriptionStatus;
    if (typeof raw.trialEndsAt === "string" && raw.trialEndsAt) payload.trialEndsAt = raw.trialEndsAt;

    return payload;
  } catch {
    return null;
  }
}

export interface SessionSecretDiagnostics {
  /** Whether SESSION_SECRET is set in the environment (vs. falling back to the persisted key file). */
  configured: boolean;
  source: "env" | "persisted-fallback";
  /** First 8 hex chars of sha256(secret) — enough to compare against an independently computed
   *  fingerprint elsewhere, never enough to recover the secret itself. */
  fingerprint: string;
}

/** Never returns or logs the raw secret — see docs/sso-handoff.md for how to use this safely. */
export function sessionSecretDiagnostics(): SessionSecretDiagnostics {
  const configured = Boolean(process.env.SESSION_SECRET?.trim());
  return {
    configured,
    source: configured ? "env" : "persisted-fallback",
    fingerprint: createHash("sha256").update(sessionSecret()).digest("hex").slice(0, 8),
  };
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
