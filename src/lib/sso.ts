import { createHash, createHmac, timingSafeEqual } from "crypto";
import { isPricingTierId, type PricingTierId } from "@/lib/pricing";
import { isEntitlementStatus, type EntitlementStatus, type SessionRole } from "@/lib/session";

/**
 * SSO handoff contract: how ypnus.com (WordPress) hands an authenticated user off to
 * app.ypnus.com after it verifies identity (login, signup, or MLO account creation).
 *
 * WordPress redirects the browser to:
 *
 *   GET https://app.ypnus.com/api/auth/callback
 *     ?email=<user email>
 *     &sub=<stable WP user id>
 *     &role=mlo|admin
 *     &iat=<unix seconds when the token was issued>
 *     &next=<optional relative path, defaults to /dashboard>
 *     &tier=<free|starter|growth|pro|elite, optional, defaults to "free">
 *     &subscriptionStatus=<active|trialing|past_due|canceled|none, optional, defaults to "none">
 *     &trialEndsAt=<ISO timestamp, optional — only meaningful when subscriptionStatus=trialing>
 *     &sig=<base64url HMAC-SHA256, see canonicalMessage below, using YPNUS_SSO_SHARED_SECRET>
 *
 * tier/subscriptionStatus/trialEndsAt are part of the SIGNED message (not optional add-ons
 * tacked on unsigned) — entitlement claims must be exactly as forgery-resistant as identity
 * claims, since they gate paid capability. A handoff that omits them signs the empty-string
 * placeholders shown below, which resolveEntitlement (entitlements.ts) treats as free/none —
 * omitting these params is always safe, it just means "no entitlement asserted," never
 * "assume paid."
 *
 * Both hosts must share the same YPNUS_SSO_SHARED_SECRET. The token is single-use in spirit
 * (short-lived, 5 minutes) but not replay-proof across that window — WordPress should treat it
 * as a one-time redirect, not a durable credential. See docs/sso-handoff.md.
 */

const HANDOFF_TTL_SECONDS = 300;

export interface SsoHandoffClaim {
  sub: string;
  email: string;
  role: SessionRole;
  next: string;
  tier?: PricingTierId;
  subscriptionStatus?: EntitlementStatus;
  trialEndsAt?: string;
}

function ssoSecret(): string | null {
  return process.env.YPNUS_SSO_SHARED_SECRET?.trim() || null;
}

export function ssoHandoffConfigured(): boolean {
  return ssoSecret() !== null;
}

export interface SsoSecretDiagnostics {
  configured: boolean;
  /** First 8 hex chars of sha256(secret) — enough to compare against an independently computed
   *  fingerprint elsewhere (e.g. the WordPress side), never enough to recover the secret itself. */
  fingerprint: string | null;
}

/** Never returns or logs the raw secret. */
export function ssoSecretDiagnostics(): SsoSecretDiagnostics {
  const secret = ssoSecret();
  return {
    configured: secret !== null,
    fingerprint: secret ? createHash("sha256").update(secret).digest("hex").slice(0, 8) : null,
  };
}

function canonicalMessage(
  email: string,
  sub: string,
  role: string,
  iat: string,
  next: string,
  tier: string,
  subscriptionStatus: string,
  trialEndsAt: string,
): string {
  return [email, sub, role, iat, next, tier, subscriptionStatus, trialEndsAt].join("|");
}

export function verifySsoHandoff(url: URL): SsoHandoffClaim | { error: string } {
  const secret = ssoSecret();
  if (!secret) {
    return { error: "SSO handoff is not configured on this deployment (YPNUS_SSO_SHARED_SECRET unset)." };
  }

  const email = url.searchParams.get("email")?.trim();
  const sub = url.searchParams.get("sub")?.trim();
  const role = url.searchParams.get("role")?.trim();
  const iat = url.searchParams.get("iat")?.trim();
  const next = url.searchParams.get("next")?.trim() || "/dashboard";
  // Empty-string defaults, not omitted from the signed message — see the module doc comment.
  const tier = url.searchParams.get("tier")?.trim() ?? "";
  const subscriptionStatus = url.searchParams.get("subscriptionStatus")?.trim() ?? "";
  const trialEndsAt = url.searchParams.get("trialEndsAt")?.trim() ?? "";
  const sig = url.searchParams.get("sig")?.trim();

  if (!email || !sub || !role || !iat || !sig) {
    return { error: "Missing required SSO handoff parameters." };
  }
  if (role !== "mlo" && role !== "admin") {
    return { error: "Unrecognized role in SSO handoff." };
  }
  if (!next.startsWith("/") || next.startsWith("//")) {
    return { error: "Invalid redirect target." };
  }

  const iatNum = Number(iat);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(iatNum) || Math.abs(nowSeconds - iatNum) > HANDOFF_TTL_SECONDS) {
    return { error: "SSO handoff token has expired." };
  }

  const expectedSig = createHmac("sha256", secret)
    .update(canonicalMessage(email, sub, role, iat, next, tier, subscriptionStatus, trialEndsAt))
    .digest("base64url");

  const provided = Buffer.from(sig);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { error: "SSO handoff signature is invalid." };
  }

  const claim: SsoHandoffClaim = { sub, email, role: role as SessionRole, next };
  if (isPricingTierId(tier)) claim.tier = tier;
  if (isEntitlementStatus(subscriptionStatus)) claim.subscriptionStatus = subscriptionStatus;
  if (trialEndsAt) claim.trialEndsAt = trialEndsAt;
  return claim;
}
