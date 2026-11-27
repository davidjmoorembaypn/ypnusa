import assert from "node:assert/strict";
import test from "node:test";
import { FOUNDER_ID, fitTitle, marketingMetadata, monthlyOfferPriceSpecification, pageTitle } from "./seo";

test("pageTitle keeps the brand suffix only for short titles", () => {
  assert.equal(pageTitle("Pricing"), "Pricing");
  const long = "Google Business Profile Optimizer for Mortgage & Real Estate";
  assert.ok(long.length > 55);
  assert.deepEqual(pageTitle(long), { absolute: long });
  assert.deepEqual(pageTitle("About YPN USA"), { absolute: "About YPN USA" });
  assert.deepEqual(pageTitle("Short", { absolute: true }), { absolute: "Short" });
});

test("pageTitle never adds a suffix that pushes a title past 60 characters", () => {
  const base = "20 Google Business Profile Post Ideas for Loan Officers"; // 55
  assert.deepEqual(pageTitle(base), { absolute: base });
  const fits = "Mortgage Lead Generation for Loan Officers in 2026"; // 50
  assert.equal(pageTitle(fits), fits);
});

test("fitTitle drops a trailing brand only when the title is too long", () => {
  assert.equal(fitTitle("Pricing | YPN USA"), "Pricing | YPN USA");
  assert.equal(
    fitTitle("What to Check Before Paying for Mortgage Leads in a ZIP Code | YPN USA"),
    "What to Check Before Paying for Mortgage Leads in a ZIP Code",
  );
  assert.equal(fitTitle("Mortgage Payment Calculator | Free Monthly Payment Estimator — YPN USA"), "Mortgage Payment Calculator | Free Monthly Payment Estimator");
  const midBrand = "Mortgage Loan Officer in Atlanta, GA — Exclusive Leads with YPN USA";
  assert.equal(fitTitle(midBrand), midBrand);
});

test("marketingMetadata defaults to the canonical ypnus.com origin", () => {
  const meta = marketingMetadata({ title: "Pricing", description: "d", path: "/pricing" });
  assert.equal(meta.alternates?.canonical, "https://ypnus.com/pricing");
  assert.equal(meta.title, "Pricing");
  const long = marketingMetadata({
    title: "AI Social Media Marketing Writer for Mortgage & Real Estate",
    description: "d",
    path: "/tools/social-writer",
  });
  assert.deepEqual(long.title, { absolute: "AI Social Media Marketing Writer for Mortgage & Real Estate" });
});

test("monthly offers carry a UnitPriceSpecification", () => {
  assert.deepEqual(monthlyOfferPriceSpecification(99), {
    "@type": "UnitPriceSpecification",
    price: "99",
    priceCurrency: "USD",
    unitCode: "MON",
    billingDuration: "P1M",
  });
  assert.equal(FOUNDER_ID, "https://ypnus.com/#person-david-moore");
});
