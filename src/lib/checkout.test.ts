import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { checkoutUrlForTier, hasDirectCheckoutLink } from "./checkout";

const ENV_KEY = "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO";
const saved = process.env[ENV_KEY];

afterEach(() => {
  if (saved === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = saved;
});

describe("checkoutUrlForTier", () => {
  it("uses the November 2026 Payment Links when no env var is set (id pro = Growth $199)", () => {
    delete process.env[ENV_KEY];
    assert.equal(checkoutUrlForTier("pro"), "https://buy.stripe.com/7sY14mdwm2tb7i93uu3AY0M");
    assert.equal(checkoutUrlForTier("growth"), "https://buy.stripe.com/bJe5kC4ZQffXdGxghg3AY0L");
    assert.equal(checkoutUrlForTier("elite"), "https://buy.stripe.com/5kQdR8akagk1auld543AY0N");
  });

  it("sends the free plan to the app's own emailed sign-in, never WordPress", () => {
    assert.equal(checkoutUrlForTier("free"), "/login?next=%2Fonboarding");
    assert.equal(checkoutUrlForTier("free", "93291"), "/login?next=%2Fonboarding");
  });

  it("routes the retired starter tier to lo-signup.html with plan (and zip, when given)", () => {
    delete process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER;
    assert.match(checkoutUrlForTier("starter"), /lo-signup\.html\?plan=starter$/);
    assert.match(checkoutUrlForTier("starter", "90210"), /lo-signup\.html\?plan=starter&zip=90210$/);
  });

  it("returns the direct Payment Link unchanged when no zip is given", () => {
    process.env[ENV_KEY] = "https://buy.stripe.com/test_abc123";
    assert.equal(checkoutUrlForTier("pro"), "https://buy.stripe.com/test_abc123");
  });

  it("appends client_reference_id so the zip survives a direct Payment Link checkout", () => {
    process.env[ENV_KEY] = "https://buy.stripe.com/test_abc123";
    const url = checkoutUrlForTier("pro", "90210");
    assert.equal(url, "https://buy.stripe.com/test_abc123?client_reference_id=90210");
  });

  it("preserves any existing query params on the configured Payment Link", () => {
    process.env[ENV_KEY] = "https://buy.stripe.com/test_abc123?prefilled_email=x%40y.com";
    const url = checkoutUrlForTier("pro", "90210");
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("prefilled_email"), "x@y.com");
    assert.equal(parsed.searchParams.get("client_reference_id"), "90210");
  });
});

describe("hasDirectCheckoutLink", () => {
  it("reflects whether a Payment Link is configured for the tier", () => {
    delete process.env[ENV_KEY];
    delete process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER;
    assert.equal(hasDirectCheckoutLink("starter"), false);
    assert.equal(hasDirectCheckoutLink("pro"), true);
    process.env[ENV_KEY] = "https://buy.stripe.com/test_abc123";
    assert.equal(hasDirectCheckoutLink("pro"), true);
  });

  it("is always false for the free tier", () => {
    process.env[ENV_KEY] = "https://buy.stripe.com/test_abc123";
    assert.equal(hasDirectCheckoutLink("free"), false);
  });
});
