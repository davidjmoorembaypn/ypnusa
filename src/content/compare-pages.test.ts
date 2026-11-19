import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sitemap from "../app/sitemap";
import { REPORT_PATH, buildDemandReport, reportCitations } from "../lib/demand-report";
import { authorReviewerGraphJsonLd } from "../lib/seo/founder-credentials";
import { COMPARE_PAGES, resolveComparePage } from "./compare-pages";

const paths = () => sitemap().map((entry) => new URL(entry.url).pathname);

describe("head-to-head comparison pages", () => {
  it("are exactly the three agreed URLs, each in the sitemap once", () => {
    assert.deepEqual(COMPARE_PAGES.map((p) => p.path).sort(), [
      "/compare/homebot-vs-cerebro-ai",
      "/compare/lendingtree-vs-exclusive-zip-mortgage-leads",
      "/compare/zillow-premier-lender-alternatives",
    ]);
    for (const page of COMPARE_PAGES) assert.equal(paths().filter((p) => p === page.path).length, 1, page.path);
  });

  for (const page of COMPARE_PAGES) {
    describe(page.slug, () => {
      const prose = [page.title, page.description, page.h1, page.eyebrow, page.intro, page.searchNote ?? "", ...page.faq.flatMap((f) => [f.q, f.a])];

      it("resolves to a sourced competitor entry and the YPN USA entry, with every table cell filled", () => {
        const { competitor, ours, columns } = resolveComparePage(page);
        assert.equal(ours.isYpn, true);
        assert.notEqual(competitor.isYpn, true);
        assert.ok(competitor.sources.length > 0);
        for (const source of [...competitor.sources, ...ours.sources]) assert.match(source.checked, /^\d{4}-\d{2}-\d{2}$/);
        for (const column of columns) {
          assert.ok(competitor.table[column.key]?.trim(), column.key);
          assert.ok(ours.table[column.key]?.trim(), column.key);
        }
      });

      it("keeps the title and description within search limits", () => {
        assert.ok(page.title.length <= 60, `${page.title.length}`);
        assert.ok(page.description.length <= 155, `${page.description.length}`);
      });

      it("uses no em or en dashes, says ZIP code, and makes no rate or results promise", () => {
        for (const text of prose) {
          assert.ok(!/[–—]/.test(text), text);
          assert.ok(!/\bZIP\b(?! code)/.test(text), text);
          assert.ok(!/best rate|lowest rate|guaranteed (leads|loans|approval)|\bAPR\b|pre-?approv/i.test(text), text);
        }
      });

      it("links to related pages that exist in the sitemap or are known routes", () => {
        const known = new Set([...paths(), "/compare", "/cerebro", "/pricing"]);
        for (const r of page.related) assert.ok(known.has(r.href), r.href);
      });
    });
  }
});

describe("quarterly mortgage demand report", () => {
  const report = buildDemandReport(new Set(["93618"]));

  it("is in the sitemap once", () => {
    assert.equal(paths().filter((p) => p === REPORT_PATH).length, 1);
  });

  it("lists 15 national and 15 Central Valley ZIP codes, ranked by buyers", () => {
    assert.equal(report.nationalTop.length, 15);
    assert.equal(report.flagship.length, 15);
    for (const list of [report.nationalTop, report.flagship]) {
      for (let i = 1; i < list.length; i += 1) assert.ok(list[i].buyers <= list[i - 1].buyers);
      assert.deepEqual(list.map((r) => r.rank), Array.from({ length: 15 }, (_, i) => i + 1));
    }
  });

  it("takes territory availability from the ledger", () => {
    assert.deepEqual(report.availability, { flagshipTotal: 15, flagshipOpen: 14, flagshipClaimed: 1 });
    assert.equal(report.flagship.find((r) => r.zip === "93618")?.status, "claimed");
    assert.equal(buildDemandReport(new Set()).availability.flagshipOpen, 15);
  });

  it("totals are positive, consistent and labeled as estimates", () => {
    assert.ok(report.summary.zipCodesCovered > 30_000);
    assert.equal(report.windowDays, 60);
    assert.ok(report.summary.buyers > 0 && report.summary.movers_in > 0);
    assert.equal(report.summary.total, report.summary.buyers + report.summary.sellers + report.summary.movers_in);
    assert.ok(report.summary.buyerSharePct > 0 && report.summary.buyerSharePct < 100);
    assert.match(report.label, /Not a lead count/);
    assert.match(report.source, /Census Bureau/);
  });

  it("citations name the source and link to the report", () => {
    const c = reportCitations("https://ypnus.com");
    assert.match(c.text, /Census Bureau/);
    assert.ok(c.text.includes("https://ypnus.com/reports/quarterly-mortgage-demand"));
    assert.match(c.html, /^<a href="https:\/\/ypnus\.com\/reports\/quarterly-mortgage-demand">/);
  });
});

describe("author and reviewer graph", () => {
  const graph = authorReviewerGraphJsonLd({ url: "https://ypnus.com/research", name: "Loan Officer Market Report" });
  const nodes = graph["@graph"] as Array<Record<string, unknown>>;
  const byType = (type: string) => nodes.find((n) => n["@type"] === type)!;

  it("connects Organization, Person, Book and WebPage by @id", () => {
    const org = byType("Organization");
    const person = byType("Person");
    const page = byType("WebPage");
    assert.equal(org["@id"], "https://ypnus.com/#organization");
    assert.equal(person["@id"], "https://ypnus.com/#person-david-moore");
    assert.deepEqual(page.author, { "@id": person["@id"] });
    assert.deepEqual(page.reviewedBy, { "@id": person["@id"] });
    assert.deepEqual(page.publisher, { "@id": org["@id"] });
    assert.deepEqual(byType("Book").author, { "@id": person["@id"] });
  });

  it("carries the business address, phone and the verifiable founder profiles", () => {
    const org = byType("Organization") as { address: Record<string, string>; telephone: string };
    assert.equal(org.address.streetAddress, "247 N L St");
    assert.equal(org.address.postalCode, "93618");
    assert.match(org.telephone, /559-512-0372/);
    const sameAs = byType("Person").sameAs as string[];
    for (const host of ["nmlsconsumeraccess.org", "orcid.org", "linkedin.com", "facebook.com"]) assert.ok(sameAs.some((u) => u.includes(host)), host);
    assert.ok(!JSON.stringify(graph).includes("tag="), "no affiliate link in structured data");
  });

  it("drops the author claim when the founder only reviewed the page", () => {
    const reviewed = authorReviewerGraphJsonLd({ url: "https://ypnus.com/blog/x", name: "X", written: false });
    const page = (reviewed["@graph"] as Array<Record<string, unknown>>).find((n) => n["@type"] === "WebPage")!;
    assert.equal(page.author, undefined);
    assert.ok(page.reviewedBy);
  });
});
