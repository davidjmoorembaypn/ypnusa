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
 *
 * --- TEMPORARY dual-signature compatibility (remove once the live WordPress SSO bridge is
 * confirmed sending the 8-field format) ---
 *
 * The live `ypnus-app-sso.php` mu-plugin currently signs only the 5-field legacy message
 * (`email|sub|role|iat|next`) — it predates the entitlement-claim extension below and has not
 * been redeployed yet. Verifying only the new 8-field format here would reject every real
 * WordPress login the moment this app ships, since the signature would never match. So this
 * verifier accepts EITHER format:
 *
 *   - legacy (5 fields): treated as carrying NO entitlement claim, full stop. Even if `tier`/
 *     `subscriptionStatus`/`trialEndsAt` appear in the query string alongside a valid legacy
 *     signature, they are never read — a legacy signature only ever attests to the 5 fields it
 *     actually covers, so anything else in the URL is unsigned attacker-controlled input and is
 *     discarded outright. This is what keeps a legacy handoff safely resolving to "free" instead
 *     of trusting an unsigned `&tier=elite` tacked onto an otherwise-valid old-format URL.
 *   - v2 (8 fields): the entitlement claim is verified as part of the signature, same as today.
 *
 * Which format a given signature matches is determined purely by which canonical byte string it
 * verifies against — never by whether the optional fields happen to be present/empty, so this
 * can't be confused by an attacker padding a legacy URL with blank entitlement params.
 * Every signed field must exclude the `|` delimiter. Without that restriction, a legacy field
 * containing `|` could produce the same canonical byte string as a v2 claim with shifted fields.
 *
 * TODO(post-launch): once `ypnus-app-sso.php` is redeployed to sign the 8-field format
 * (docs/sso-handoff.md), delete `LEGACY_` below and the `matchesLegacy` branch, and always
 * require the v2 signature.
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

function canonicalMessageV2(
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

/** LEGACY: matches the 5-field message the live ypnus-app-sso.php still signs today. */
function canonicalMessageLegacy(email: string, sub: string, role: string, iat: string, next: string): string {
  return [email, sub, role, iat, next].join("|");
}

function safeEqual(providedBase64Url: string, expected: string): boolean {
  const provided = Buffer.from(providedBase64Url);
  const expectedBuf = Buffer.from(expected);
  return provided.length === expectedBuf.length && timingSafeEqual(provided, expectedBuf);
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
  if ([email, sub, role, iat, next, tier, subscriptionStatus, trialEndsAt].some((field) => field.includes("|"))) {
    return { error: "SSO handoff parameters contain an illegal character." };
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

  const expectedV2 = createHmac("sha256", secret)
    .update(canonicalMessageV2(email, sub, role, iat, next, tier, subscriptionStatus, trialEndsAt))
    .digest("base64url");
  const matchesV2 = safeEqual(sig, expectedV2);

  const expectedLegacy = createHmac("sha256", secret)
    .update(canonicalMessageLegacy(email, sub, role, iat, next))
    .digest("base64url");
  const matchesLegacy = !matchesV2 && safeEqual(sig, expectedLegacy);

  if (!matchesV2 && !matchesLegacy) {
    return { error: "SSO handoff signature is invalid." };
  }

  const claim: SsoHandoffClaim = { sub, email, role: role as SessionRole, next };
  // Legacy signatures never covered tier/subscriptionStatus/trialEndsAt — even if those params
  // are present in the URL, they're unsigned under this format and must never be trusted. Only
  // a v2-matched signature can carry an entitlement claim. See the module doc comment above.
  if (matchesV2) {
    if (isPricingTierId(tier)) claim.tier = tier;
    if (isEntitlementStatus(subscriptionStatus)) claim.subscriptionStatus = subscriptionStatus;
    if (trialEndsAt) claim.trialEndsAt = trialEndsAt;
  }
  return claim;
}
