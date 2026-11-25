import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAN_YPNUS_HELP_WITH_MORTGAGE_MARKETING as post } from "./blog-answers-2026-11";
import { PUBLIC_MONTHLY_PRICE_CENTS } from "@/lib/pricing";

const all = `${post.title} ${post.description} ${post.html} ${JSON.stringify(post.faq)} ${post.closingHtml}`;

describe("can-ypnus-help-with-mortgage-marketing", () => {
  it("quotes only the current plan prices", () => {
    for (const price of ["$29.99", "$99.99", "$299.99", "Starter", "Elite"]) assert.ok(!all.includes(price), price);
    // The monthly prices must match what new customers pay today.
    for (const cents of Object.values(PUBLIC_MONTHLY_PRICE_CENTS)) {
      const price = "$" + String(cents / 100);
      assert.ok(all.includes(price + "/mo") || all.includes(price + " a month"), price);
    }
    for (const price of ["$990", "$79", "$790"]) assert.ok(all.includes(price), price);
  });

  it("claims no CRM integrations or features the site doesn't offer", () => {
    assert.doesNotMatch(all, /Salesforce|Encompass|Velocify|WordPress|Social Media Studio/);
  });

  it("labels the unreleased Cerebro features as coming soon", () => {
    assert.match(post.html, /<h2>What's coming soon \(not live yet\)<\/h2>/);
    assert.match(post.html, /Local Visibility Score/);
  });

  it("keeps the compliance line and says ZIP code, not bare ZIP", () => {
    assert.match(all, /not a lender/);
    assert.match(all, /RESPA, TCPA and state licensing/);
    assert.doesNotMatch(post.html.replace(/<[^>]*>/g, " "), /\bZIP\b(?! code)/);
  });

  it("links to pricing, ZIP code checker, Cerebro, metro pages and related posts", () => {
    for (const href of ["/pricing", "/check-zip", "/cerebro", "/markets/metro", "/markets", "/teams", "/blog/mortgage-crm-vs-ai-assistant"]) {
      assert.ok(all.includes(`href="${href}"`), href);
    }
  });
});

describe("can-ypnus-help-with-mortgage-marketing in the sitemap", () => {
  it("is listed at /blog/can-ypnus-help-with-mortgage-marketing", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = sitemap().map((entry) => new URL(entry.url).pathname);
    assert.ok(urls.includes("/blog/can-ypnus-help-with-mortgage-marketing"));
  });
});
