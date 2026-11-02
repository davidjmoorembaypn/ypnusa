import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readDb, writeDb } from "@/lib/db";
import { safeAccountNext } from "@/lib/native-platform";
import { isValidEmail } from "@/lib/validation";

const TTL = 15 * 60 * 1000;
export const LOGIN_BROWSER_COOKIE = "ypnus_login_browser";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function issueLoginChallenge(emailInput: string, next: unknown) {
  const email = emailInput.trim().toLowerCase();
  if (email.length > 254 || !isValidEmail(email)) throw new Error("Invalid email address.");
  const token = randomBytes(32).toString("base64url");
  const browser = randomBytes(32).toString("base64url");
  const now = Date.now();
  writeDb((db) => {
    const challenges = (db.loginChallenges ?? []).filter((item) => item.expiresAt > now);
    // Durable per-address throttle in addition to the per-IP route guard.
    if (challenges.filter((item) => item.email === email).length >= 3) throw new Error("Please wait before requesting another sign-in email.");
    challenges.push({ tokenHash: hash(token), browserHash: hash(browser), email, next: safeAccountNext(next), expiresAt: now + TTL });
    db.loginChallenges = challenges;
  }, { requirePersistent: true });
  return { token, browser, email };
}

export function revokeLoginChallenge(token: string): void {
  writeDb((db) => { db.loginChallenges = (db.loginChallenges ?? []).filter((item) => item.tokenHash !== hash(token)); }, { requirePersistent: true });
}

export function consumeLoginChallenge(token: string, browser: string): { sub: string; email: string; role: "mlo"; next: string } | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !/^[A-Za-z0-9_-]{43}$/.test(browser)) return null;
  let result: { sub: string; email: string; role: "mlo"; next: string } | null = null;
  writeDb((db) => {
    const challenge = (db.loginChallenges ?? []).find((item) => item.tokenHash === hash(token) && item.browserHash === hash(browser) && item.expiresAt > Date.now());
    if (!challenge) return;
    const accounts = db.nativeAccounts ?? [];
    let account = accounts.find((item) => item.email === challenge.email);
    if (!account) {
      account = { id: `native_${randomUUID()}`, email: challenge.email, createdAt: new Date().toISOString() };
      accounts.push(account);
    }
    db.nativeAccounts = accounts;
    db.loginChallenges = (db.loginChallenges ?? []).filter((item) => item !== challenge);
    // Public email login NEVER confers admin access, even for a matching email.
    result = { sub: account.id, email: account.email, role: "mlo", next: challenge.next };
  }, { requirePersistent: true });
  return result;
}

export function verifiedNativeEmail(sub: string): string | null {
  return (readDb().nativeAccounts ?? []).find((account) => account.id === sub)?.email ?? null;
}
