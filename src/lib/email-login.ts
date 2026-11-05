import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { readDb, writeDb } from "@/lib/db";
import { normalizeEmail } from "@/lib/accounts";
import type { LoginTokenRecord } from "@/lib/types";

/**
 * Emailed one-time sign-in links ("magic links"), the replacement for WordPress logins.
 *
 * - The raw token only ever exists in the email; the store keeps its SHA-256.
 * - Links expire after 15 minutes and work once.
 * - At most 5 links per email per hour, so the form can't be used to flood an inbox.
 * - Clicking the link opens a confirmation page whose button POSTs the token. Email
 *   security scanners that pre-open links therefore can't burn the token.
 */

export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000;
export const LOGIN_TOKENS_PER_HOUR = 5;

export const ALLOWED_NEXT_PREFIXES = ["/dashboard", "/portal", "/analytics", "/admin", "/onboarding", "/account", "/billing"];

/** Only same-site app paths are allowed as post-login destinations. */
export function safeNextPath(raw: unknown): string {
  const value = typeof raw === "string" ? raw : "";
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    if (ALLOWED_NEXT_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`))) {
      return value;
    }
  }
  return "/dashboard";
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type IssueLoginTokenResult =
  | { ok: true; token: string; email: string; expiresAt: string }
  | { ok: false; code: "INVALID_EMAIL" | "RATE_LIMITED" };

export function issueLoginToken(rawEmail: unknown, rawNext: unknown, now = Date.now()): IssueLoginTokenResult {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, code: "INVALID_EMAIL" };
  const next = safeNextPath(rawNext);

  const hourAgo = now - 60 * 60 * 1000;
  const recent = readDb().loginTokens.filter(
    (token) => token.email === email && Date.parse(token.createdAt) > hourAgo,
  );
  if (recent.length >= LOGIN_TOKENS_PER_HOUR) return { ok: false, code: "RATE_LIMITED" };

  const token = randomBytes(32).toString("base64url");
  const record: LoginTokenRecord = {
    tokenHash: hashToken(token),
    email,
    next,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + LOGIN_TOKEN_TTL_MS).toISOString(),
  };
  writeDb((db) => {
    // Drop anything older than a day so the table stays small.
    const dayAgo = now - 24 * 60 * 60 * 1000;
    db.loginTokens = db.loginTokens.filter((existing) => Date.parse(existing.createdAt) > dayAgo);
    db.loginTokens.push(record);
  });
  return { ok: true, token, email, expiresAt: record.expiresAt };
}

export type ConsumeLoginTokenResult =
  | { ok: true; email: string; next: string }
  | { ok: false; code: "INVALID_TOKEN" | "EXPIRED_TOKEN" | "USED_TOKEN" };

export function consumeLoginToken(rawToken: unknown, now = Date.now()): ConsumeLoginTokenResult {
  if (typeof rawToken !== "string" || rawToken.length < 20 || rawToken.length > 200) {
    return { ok: false, code: "INVALID_TOKEN" };
  }
  const wanted = Buffer.from(hashToken(rawToken), "hex");
  let result: ConsumeLoginTokenResult = { ok: false, code: "INVALID_TOKEN" };
  writeDb((db) => {
    const match = db.loginTokens.find((token) => {
      const candidate = Buffer.from(token.tokenHash, "hex");
      return candidate.length === wanted.length && timingSafeEqual(candidate, wanted);
    });
    if (!match) return;
    if (match.usedAt) {
      result = { ok: false, code: "USED_TOKEN" };
      return;
    }
    if (Date.parse(match.expiresAt) <= now) {
      result = { ok: false, code: "EXPIRED_TOKEN" };
      return;
    }
    match.usedAt = new Date(now).toISOString();
    result = { ok: true, email: match.email, next: safeNextPath(match.next) };
  });
  return result;
}
