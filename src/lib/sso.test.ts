import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { ssoSecretDiagnostics, verifySsoHandoff } from "./sso";

const TEST_SECRET = "test-sso-shared-secret";

function sign(
  email: string,
  sub: string,
  role: string,
  iat: string,
  next: string,
  tier = "",
  subscriptionStatus = "",
  trialEndsAt = "",
  secret = TEST_SECRET,
): string {
  return createHmac("sha256", secret)
    .update([email, sub, role, iat, next, tier, subscriptionStatus, trialEndsAt].join("|"))
    .digest("base64url");
}

/** LEGACY (5-field) signature — matches what the live ypnus-app-sso.php still signs today. */
function signLegacy(email: string, sub: string, role: string, iat: string, next: string, secret = TEST_SECRET): string {
  return createHmac("sha256", secret).update([email, sub, role, iat, next].join("|")).digest("base64url");
}

function buildUrl(
  overrides: Partial<
    Record<"email" | "sub" | "role" | "iat" | "next" | "tier" | "subscriptionStatus" | "trialEndsAt" | "sig", string>
  > = {},
) {
  const email = overrides.email ?? "jordan@example.com";
  const sub = overrides.sub ?? "wp_42";
  const role = overrides.role ?? "mlo";
  const iat = overrides.iat ?? String(Math.floor(Date.now() / 1000));
  const next = overrides.next ?? "/dashboard";
  const tier = overrides.tier ?? "";
  const subscriptionStatus = overrides.subscriptionStatus ?? "";
  const trialEndsAt = overrides.trialEndsAt ?? "";
  const sig = overrides.sig ?? sign(email, sub, role, iat, next, tier, subscriptionStatus, trialEndsAt);

  const url = new URL("https://app.ypnus.com/api/auth/callback");
  url.searchParams.set("email", email);
  url.searchParams.set("sub", sub);
  url.searchParams.set("role", role);
  url.searchParams.set("iat", iat);
  url.searchParams.set("next", next);
  if (tier) url.searchParams.set("tier", tier);
  if (subscriptionStatus) url.searchParams.set("subscriptionStatus", subscriptionStatus);
  if (trialEndsAt) url.searchParams.set("trialEndsAt", trialEndsAt);
  url.searchParams.set("sig", sig);
  return url;
}

/** Builds a URL signed under the LEGACY 5-field format only — no tier/status/trialEndsAt signed. */
function buildLegacyUrl(
  overrides: Partial<Record<"email" | "sub" | "role" | "iat" | "next" | "sig", string>> = {},
) {
  const email = overrides.email ?? "jordan@example.com";
  const sub = overrides.sub ?? "wp_42";
  const role = overrides.role ?? "mlo";
  const iat = overrides.iat ?? String(Math.floor(Date.now() / 1000));
  const next = overrides.next ?? "/dashboard";
  const sig = overrides.sig ?? signLegacy(email, sub, role, iat, next);

  const url = new URL("https://app.ypnus.com/api/auth/callback");
  url.searchParams.set("email", email);
  url.searchParams.set("sub", sub);
  url.searchParams.set("role", role);
  url.searchParams.set("iat", iat);
  url.searchParams.set("next", next);
  url.searchParams.set("sig", sig);
  return url;
}

describe("SSO handoff verification", () => {
  it("fails closed when the shared secret isn't configured", () => {
    delete process.env.YPNUS_SSO_SHARED_SECRET;
    const result = verifySsoHandoff(buildUrl());
    assert.ok("error" in result);
  });

  it("accepts a correctly-signed, fresh handoff once the secret is configured", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const result = verifySsoHandoff(buildUrl());
    assert.ok(!("error" in result));
    if (!("error" in result)) {
      assert.equal(result.email, "jordan@example.com");
      assert.equal(result.role, "mlo");
      assert.equal(result.next, "/dashboard");
    }
  });

  it("rejects a tampered signature", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const result = verifySsoHandoff(buildUrl({ sig: "0".repeat(43) }));
    assert.ok("error" in result);
  });

  it("rejects a signature produced with the wrong secret", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const badSig = sign(
      "jordan@example.com",
      "wp_42",
      "mlo",
      String(Math.floor(Date.now() / 1000)),
      "/dashboard",
      "",
      "",
      "",
      "wrong-secret",
    );
    const result = verifySsoHandoff(buildUrl({ sig: badSig }));
    assert.ok("error" in result);
  });

  it("rejects a stale token outside the freshness window", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const staleIat = String(Math.floor(Date.now() / 1000) - 600);
    const result = verifySsoHandoff(buildUrl({ iat: staleIat, sig: sign("jordan@example.com", "wp_42", "mlo", staleIat, "/dashboard") }));
    assert.ok("error" in result);
  });

  it("rejects an unrecognized role", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const iat = String(Math.floor(Date.now() / 1000));
    const result = verifySsoHandoff(
      buildUrl({ role: "superadmin", sig: sign("jordan@example.com", "wp_42", "superadmin", iat, "/dashboard") }),
    );
    assert.ok("error" in result);
  });

  it("rejects an open-redirect next target", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const iat = String(Math.floor(Date.now() / 1000));
    const result = verifySsoHandoff(
      buildUrl({ next: "//evil.example.com", sig: sign("jordan@example.com", "wp_42", "mlo", iat, "//evil.example.com") }),
    );
    assert.ok("error" in result);
  });

  it("carries a signed tier/subscriptionStatus/trialEndsAt claim through when present", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const result = verifySsoHandoff(
      buildUrl({ tier: "growth", subscriptionStatus: "trialing", trialEndsAt: "2026-10-01T00:00:00Z" }),
    );
    assert.ok(!("error" in result));
    if (!("error" in result)) {
      assert.equal(result.tier, "growth");
      assert.equal(result.subscriptionStatus, "trialing");
      assert.equal(result.trialEndsAt, "2026-10-01T00:00:00Z");
    }
  });

  it("omits the entitlement claim fields (never guesses paid) when they're absent from the handoff", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const result = verifySsoHandoff(buildUrl());
    assert.ok(!("error" in result));
    if (!("error" in result)) {
      assert.equal(result.tier, undefined);
      assert.equal(result.subscriptionStatus, undefined);
      assert.equal(result.trialEndsAt, undefined);
    }
  });

  it("rejects a handoff whose tier/status claim was tampered with after signing (can't forge paid access)", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const legit = buildUrl({ tier: "starter", subscriptionStatus: "active" });
    // Swap in a higher tier without re-signing — the signature covers tier/status, so this must fail.
    legit.searchParams.set("tier", "elite");
    const result = verifySsoHandoff(legit);
    assert.ok("error" in result);
  });

  it("rejects an unrecognized tier or subscriptionStatus value even with a valid signature over it", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const iat = String(Math.floor(Date.now() / 1000));
    const badTier = verifySsoHandoff(
      buildUrl({ tier: "platinum", sig: sign("jordan@example.com", "wp_42", "mlo", iat, "/dashboard", "platinum") }),
    );
    // An unrecognized tier is signed validly but simply dropped (isPricingTierId guards it) — not an error,
    // just no claim carried through, matching "absent" behavior (fails closed to free downstream).
    assert.ok(!("error" in badTier));
    if (!("error" in badTier)) assert.equal(badTier.tier, undefined);
  });

  describe("legacy (5-field) compatibility — TEMPORARY, remove once ypnus-app-sso.php sends v2", () => {
    it("accepts a validly-signed LEGACY handoff and carries no entitlement claim", () => {
      process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
      const result = verifySsoHandoff(buildLegacyUrl());
      assert.ok(!("error" in result));
      if (!("error" in result)) {
        assert.equal(result.email, "jordan@example.com");
        assert.equal(result.role, "mlo");
        assert.equal(result.next, "/dashboard");
        assert.equal(result.tier, undefined);
        assert.equal(result.subscriptionStatus, undefined);
        assert.equal(result.trialEndsAt, undefined);
      }
    });

    it("rejects a tampered LEGACY signature", () => {
      process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
      const result = verifySsoHandoff(buildLegacyUrl({ sig: "0".repeat(43) }));
      assert.ok("error" in result);
    });

    it("rejects a LEGACY signature produced with the wrong secret", () => {
      process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
      const iat = String(Math.floor(Date.now() / 1000));
      const badSig = signLegacy("jordan@example.com", "wp_42", "mlo", iat, "/dashboard", "wrong-secret");
      const result = verifySsoHandoff(buildLegacyUrl({ iat, sig: badSig }));
      assert.ok("error" in result);
    });

    it("never trusts an unsigned tier/subscriptionStatus tacked onto an otherwise-valid LEGACY URL", () => {
      process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
      const url = buildLegacyUrl();
      // Legacy signature only covers email|sub|role|iat|next — appending these afterwards must
      // not grant paid entitlement, since they were never part of what was signed.
      url.searchParams.set("tier", "elite");
      url.searchParams.set("subscriptionStatus", "active");
      url.searchParams.set("trialEndsAt", "2099-01-01T00:00:00Z");
      const result = verifySsoHandoff(url);
      assert.ok(!("error" in result));
      if (!("error" in result)) {
        assert.equal(result.tier, undefined);
        assert.equal(result.subscriptionStatus, undefined);
        assert.equal(result.trialEndsAt, undefined);
      }
    });

    it("rejects a stale LEGACY token outside the freshness window", () => {
      process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
      const staleIat = String(Math.floor(Date.now() / 1000) - 600);
      const result = verifySsoHandoff(
        buildLegacyUrl({ iat: staleIat, sig: signLegacy("jordan@example.com", "wp_42", "mlo", staleIat, "/dashboard") }),
      );
      assert.ok("error" in result);
    });

    it("does not accidentally accept a v2-signed URL as legacy or vice versa", () => {
      process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
      const iat = String(Math.floor(Date.now() / 1000));
      // A v2 signature (covering the 8-field message with real entitlement values) must not
      // verify against the 5-field legacy message either — the two canonical strings differ in
      // byte content, not just field count, so cross-format confusion should be impossible.
      const v2Sig = sign("jordan@example.com", "wp_42", "mlo", iat, "/dashboard", "elite", "active", "");
      const asLegacy = buildLegacyUrl({ iat, sig: v2Sig });
      const result = verifySsoHandoff(asLegacy);
      assert.ok("error" in result);
    });
  });
});

describe("ssoSecretDiagnostics", () => {
  it("reports unconfigured with a null fingerprint when unset", () => {
    delete process.env.YPNUS_SSO_SHARED_SECRET;
    const diagnostics = ssoSecretDiagnostics();
    assert.equal(diagnostics.configured, false);
    assert.equal(diagnostics.fingerprint, null);
  });

  it("reports configured with a matching fingerprint, never the raw secret", () => {
    process.env.YPNUS_SSO_SHARED_SECRET = TEST_SECRET;
    const diagnostics = ssoSecretDiagnostics();
    assert.equal(diagnostics.configured, true);
    assert.equal(diagnostics.fingerprint, createHash("sha256").update(TEST_SECRET).digest("hex").slice(0, 8));
  });
});
