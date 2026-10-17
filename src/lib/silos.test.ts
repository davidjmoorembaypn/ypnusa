import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SILOS } from "./silos";

const NOINDEX_PATHS = ["/ai-platform", "/mortgage-loans/tools", "/real-estate-leads"];

describe("silos", () => {
  for (const silo of Object.values(SILOS)) {
    it(`${silo.id}: links are unique, internal and never point at noindexed placeholders`, () => {
      const hrefs = silo.links().map((link) => link.href);
      assert.equal(new Set(hrefs).size, hrefs.length, "duplicate href inside a silo");
      for (const href of [silo.pillar.href, ...hrefs]) {
        assert.ok(href.startsWith("/"), `${href} must be an internal path`);
        assert.ok(!NOINDEX_PATHS.some((bad) => href === bad || href.startsWith(`${bad}/`)), `${href} is noindexed`);
      }
    });
  }

  it("each page belongs to a single silo", () => {
    const seen = new Map<string, string>();
    for (const silo of Object.values(SILOS)) {
      for (const link of silo.links()) {
        assert.ok(!seen.has(link.href), `${link.href} is in both ${seen.get(link.href)} and ${silo.id}`);
        seen.set(link.href, silo.id);
      }
    }
  });

  it("mortgage silo covers every program and local city page", () => {
    const hrefs = SILOS.mortgage.links().map((link) => link.href);
    assert.ok(hrefs.some((h) => h === "/mortgage-loans/fha"));
    assert.ok(hrefs.some((h) => h.startsWith("/mortgage-broker/")));
    assert.ok(hrefs.includes("/tools/equity"));
  });
});
