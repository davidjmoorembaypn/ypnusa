import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { BUSINESS_DESCRIPTION, BUSINESS_SERVICES } from "@/lib/business-profile";
import { PLAN_ENTITLEMENTS, PUBLIC_PRICING_TIERS } from "@/lib/pricing";

/**
 * Cerebro's follow-up emails go out on their own by default ("live" mode) and wait for the officer only in
 * "approve first" mode (src/lib/cerebro-dispatch.ts, src/lib/ai/knowledge.ts). The business profile that feeds
 * the site's schema and the Google Business Profile must say so, and the paste sheet must match it.
 */
const SHEET = readFileSync(join(process.cwd(), "docs", "gbp-ready-to-paste.md"), "utf8");

describe("business profile wording", () => {
  it("stays inside the Google Business Profile limits", () => {
    assert.ok(BUSINESS_DESCRIPTION.length <= 750, `description is ${BUSINESS_DESCRIPTION.length} characters`);
    for (const service of BUSINESS_SERVICES) assert.ok(service.description.length <= 300, `${service.name}: ${service.description.length} characters`);
  });

  it("does not say the officer approves every message, or that nothing is sent automatically", () => {
    const text = [BUSINESS_DESCRIPTION, ...BUSINESS_SERVICES.map((s) => s.description)].join("\n");
    for (const wrong of ["approve each message", "before it goes out", "nothing sends automatically", "nothing is sent automatically", "drafts follow-up messages"]) {
      assert.ok(!text.includes(wrong), `still says "${wrong}"`);
    }
    const followUp = BUSINESS_SERVICES.find((s) => s.name === "Borrower Follow-Up Assistant");
    assert.ok(followUp);
    assert.match(followUp.description, /on its own/);
    assert.match(followUp.description, /approve-first mode/);
    assert.match(followUp.description, /No texts or calls/);
  });

  it("is the same text as the paste sheet, so the sheet cannot drift from the site", () => {
    assert.ok(SHEET.includes(BUSINESS_DESCRIPTION), "docs/gbp-ready-to-paste.md has a different business description");
    assert.ok(SHEET.includes(`(${BUSINESS_DESCRIPTION.length} of 750 characters)`), "the sheet's character count is out of date");
    for (const service of BUSINESS_SERVICES) assert.ok(SHEET.includes(service.description), `the sheet is missing the ${service.name} text`);
  });

  it("does not tell visitors that every follow-up waits for approval, or that texts are sent", () => {
    const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
    const pages = [read("src/app/page.tsx"), read("src/components/homepage/how-it-works.tsx")].join("\n");
    for (const wrong of ["drafts your\n              follow-ups for your OK", "drafts SMS and email follow-up", "follow-ups for your OK."]) {
      assert.ok(!pages.includes(wrong), `a homepage section still says "${wrong}"`);
    }
    assert.match(pages, /on its own/);
    const plans = [...PUBLIC_PRICING_TIERS.flatMap((t) => t.features), ...PLAN_ENTITLEMENTS.map((r) => r.label)].join("\n");
    assert.ok(!/SMS \+ email follow-ups/.test(plans), "a plan still promises SMS follow-ups");
    assert.match(plans, /email follow-ups, sent for you or held for your OK/);
  });
});
