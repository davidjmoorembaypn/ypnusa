import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { brandingLine, buildEmbedSnippet, embedAttributionUrl, escapeHtmlAttr, sanitizeEmbedBranding } from "./embed-branding";

describe("embed attribution link", () => {
  it("points at the free ZIP checker with the agreed UTM tags", () => {
    const url = new URL(embedAttributionUrl("https://ypnus.com"));
    assert.equal(url.pathname, "/check-zip");
    assert.equal(url.searchParams.get("utm_source"), "embed_widget");
    assert.equal(url.searchParams.get("utm_medium"), "referral");
    assert.equal(url.searchParams.get("utm_campaign"), "free_tools");
  });
});

describe("sanitizeEmbedBranding", () => {
  it("keeps a normal company name and an NMLS number", () => {
    assert.deepEqual(sanitizeEmbedBranding({ company: "Acme Lending, Inc.", nmls: "1234567" }), { company: "Acme Lending, Inc.", nmls: "1234567" });
  });

  it("strips markup and script characters instead of repairing them", () => {
    const out = sanitizeEmbedBranding({ company: '<img src=x onerror="alert(1)">Acme', nmls: "12ab34" });
    assert.ok(!/[<>"=()]/.test(out.company ?? ""));
    assert.equal(out.nmls, "1234");
  });

  it("limits length, collapses whitespace and drops empty values", () => {
    assert.equal(sanitizeEmbedBranding({ company: "A".repeat(200) }).company?.length, 60);
    assert.equal(sanitizeEmbedBranding({ company: "  Acme    Co  " }).company, "Acme Co");
    assert.deepEqual(sanitizeEmbedBranding({ company: "   ", nmls: "" }), {});
    assert.equal(sanitizeEmbedBranding({ nmls: "1".repeat(30) }).nmls?.length, 10);
  });

  it("takes the first value when a parameter is repeated", () => {
    assert.equal(sanitizeEmbedBranding({ nmls: ["111", "222"] }).nmls, "111");
  });

  it("formats the footer line", () => {
    assert.equal(brandingLine({ company: "Acme", nmls: "5" }), "Acme · NMLS #5");
    assert.equal(brandingLine({ nmls: "5" }), "NMLS #5");
    assert.equal(brandingLine({}), "");
  });
});

describe("buildEmbedSnippet", () => {
  const base = { origin: "https://ypnus.com", path: "/embed/equity", height: 820, title: "Home equity snapshot", creditPath: "/tools/equity", creditText: "Home equity calculator by YPN USA" };

  it("builds the plain iframe and credit line without branding", () => {
    const html = buildEmbedSnippet(base);
    assert.match(html, /<iframe src="https:\/\/ypnus\.com\/embed\/equity" /);
    assert.match(html, /height="820"/);
    assert.match(html, /<a href="https:\/\/ypnus\.com\/tools\/equity">Home equity calculator by YPN USA<\/a>/);
  });

  it("carries company and NMLS as encoded, escaped query parameters", () => {
    const html = buildEmbedSnippet({ ...base, branding: { company: "Smith & Sons", nmls: "99" } });
    assert.match(html, /\?company=Smith\+%26\+Sons&amp;nmls=99"/);
  });

  it("cannot be broken out of the attribute by hostile input", () => {
    const html = buildEmbedSnippet({ ...base, title: 'x" onload="alert(1)', branding: { company: '"><script>alert(1)</script>' } });
    assert.ok(!html.includes("<script"));
    assert.ok(!/title="x" onload/.test(html));
    assert.equal(escapeHtmlAttr(`"<&>'`), "&quot;&lt;&amp;&gt;&#39;");
  });
});
