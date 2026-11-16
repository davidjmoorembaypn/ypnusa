import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sitemap from "../app/sitemap";
import { REPORT_COUNTIES } from "./market-report";

describe("market report in the sitemap", () => {
  it("lists the hub and every county page once", () => {
    const urls = sitemap().map((entry) => new URL(entry.url).pathname);
    assert.equal(urls.filter((u) => u === "/research").length, 1);
    for (const county of REPORT_COUNTIES) {
      assert.equal(urls.filter((u) => u === `/research/${county.slug}`).length, 1, county.slug);
    }
  });
});
