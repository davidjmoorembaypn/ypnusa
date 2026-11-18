import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-marketing-kit-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

describe("Marketing kit", async () => {
  const kit = await import("./marketing-kit");
  const db = await import("./db");
  const { officerShortId } = await import("./officer-profile");
  const { checkMarketingCompliance } = await import("./ai/marketing-compliance");
  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  const profile = {
    fullName: "Jane Doe",
    nmlsId: "123456",
    phone: "5595120372",
    company: "Valley Home Loans",
    companyNmlsId: "654321",
    slug: "jane-doe-00000000",
    updatedAt: new Date().toISOString(),
  };
  const page = { slug: "jane-doe-1a2b3c4d" };
  const paid = (tier: "growth" | "pro" | "elite" | "free" | "starter") =>
    ({ tier, status: tier === "free" ? "none" : "active", hasVerifiedClaim: true }) as const;

  describe("website badge", () => {
    it("is plain HTML with brand-name links only, pointing at the officer's page", () => {
      const snippet = kit.badgeSnippet({ userId: "acct_1", profile, page });
      assert.match(snippet, /href="https:\/\/ypnus\.com\/lo\/jane-doe-1a2b3c4d"/);
      assert.match(snippet, />Powered by YPN USA<\/a>/);
      assert.match(snippet, new RegExp(`/api/badge/${officerShortId("acct_1")}`));
      assert.match(snippet, /alt="Jane Doe, NMLS #123456: chat with Cerebro 24\/7"/);
      assert.doesNotMatch(snippet, /<script/i);
      assert.doesNotMatch(snippet, /mortgage leads|loan officer marketing/i, "no keyword anchors");
    });

    it("links to ypnus.com until the borrower page is live", () => {
      const snippet = kit.badgeSnippet({ userId: "acct_1", profile, page: null });
      assert.match(snippet, /<a href="https:\/\/ypnus\.com\/" target="_blank" rel="noopener"><img/);
    });

    it("escapes the officer's name in the SVG", () => {
      const svg = kit.badgeSvg({ profile: { fullName: "Ann <O'Hara>", nmlsId: "123456" }, zip: "93720" });
      assert.doesNotMatch(svg, /<O'Hara>/);
      assert.match(svg, /Ann &lt;O&apos;Hara&gt;/);
      assert.match(svg, /ZIP 93720/);
    });

    it("only counts outside websites from the Referer", () => {
      assert.equal(kit.badgeHostFromReferer("https://www.janedoeloans.com/about"), "www.janedoeloans.com");
      assert.equal(kit.badgeHostFromReferer("https://ypnus.com/dashboard"), null);
      assert.equal(kit.badgeHostFromReferer("https://app.ypnus.com/"), null);
      assert.equal(kit.badgeHostFromReferer("javascript:alert(1)"), null);
      assert.equal(kit.badgeHostFromReferer(null), null);
    });

    it("records the first website and touches it at most once a day", () => {
      const t0 = new Date("2026-11-18T10:00:00Z");
      db.recordBadgeSeen("acct_badge", "janedoeloans.com", t0);
      db.recordBadgeSeen("acct_badge", "janedoeloans.com", new Date("2026-11-18T12:00:00Z"));
      let saved = db.readMarketingKit("acct_badge");
      assert.equal(saved?.badgeHost, "janedoeloans.com");
      assert.equal(saved?.badgeLastSeenAt, t0.toISOString());
      db.recordBadgeSeen("acct_badge", "janedoeloans.com", new Date("2026-11-19T12:00:00Z"));
      saved = db.readMarketingKit("acct_badge");
      assert.equal(saved?.badgeFirstSeenAt, t0.toISOString());
      assert.equal(saved?.badgeLastSeenAt, "2026-11-19T12:00:00.000Z");
    });
  });

  describe("LinkedIn allowance", () => {
    const now = new Date("2026-11-18T00:00:00Z");
    const article = (month: string) => ({ id: month + Math.random(), month, title: "t", body: "b", source: "template" as const, createdAt: now.toISOString() });

    it("gives Free and Starter none", () => {
      assert.equal(kit.articlesLeft(kit.linkedinAllowance(paid("free")), [], now), 0);
      assert.equal(kit.articlesLeft(kit.linkedinAllowance(paid("starter")), [], now), 0);
    });

    it("gives the $99 Pro plan one article in total", () => {
      const allowance = kit.linkedinAllowance(paid("growth"));
      assert.equal(kit.articlesLeft(allowance, [], now), 1);
      assert.equal(kit.articlesLeft(allowance, [article("2026-01")], now), 0);
    });

    it("gives Growth one a month and Exclusive two a month", () => {
      const growth = kit.linkedinAllowance(paid("pro"));
      assert.equal(kit.articlesLeft(growth, [article("2026-10")], now), 1);
      assert.equal(kit.articlesLeft(growth, [article("2026-11")], now), 0);
      const exclusive = kit.linkedinAllowance(paid("elite"));
      assert.equal(kit.articlesLeft(exclusive, [article("2026-11")], now), 1);
    });

    it("re-checks the allowance inside the write lock", () => {
      const allowance = kit.linkedinAllowance(paid("growth"));
      const first = db.saveLinkedInArticle("acct_li", article("2026-11"), (a) => kit.articlesLeft(allowance, a, now) > 0);
      const second = db.saveLinkedInArticle("acct_li", article("2026-11"), (a) => kit.articlesLeft(allowance, a, now) > 0);
      assert.equal(first, true);
      assert.equal(second, false);
      assert.equal(db.readMarketingKit("acct_li")?.linkedinArticles.length, 1);
    });
  });

  describe("LinkedIn article drafts", () => {
    const now = new Date("2026-11-18T00:00:00Z");

    it("falls back to a compliant template with disclosures and the page link when no AI is set up", async () => {
      const draft = await kit.draftLinkedInArticle({ profile, page, zip: "93720", now, provider: null });
      assert.equal(draft.source, "template");
      assert.match(draft.body, /Jane Doe, NMLS #123456/);
      assert.match(draft.body, /Valley Home Loans, NMLS #654321/);
      assert.match(draft.body, /Equal Housing Opportunity/);
      assert.match(draft.body, /https:\/\/ypnus\.com\/lo\/jane-doe-1a2b3c4d/);
    });

    it("every template passes the advertising checks", () => {
      for (let offset = 0; offset < 4; offset += 1) {
        const topic = kit.topicForMonth(now, offset);
        const problems = checkMarketingCompliance({ fields: { title: topic.title("93720"), article: topic.template("93720").join("\n\n") } });
        assert.deepEqual(problems, [], `topic ${offset}`);
      }
    });

    const longBody = "Buying a home is a big step. ".repeat(20);

    it("sends a non-compliant draft back once with the problems, then keeps the fixed one", async () => {
      const requests: string[] = [];
      const replies = [`TITLE: Great news\n\nRates are 5.9% today. ${longBody}`, `TITLE: Great news\n\n${longBody}`];
      const provider = {
        name: "fake",
        async generate(request: { messages: { content: string }[] }) {
          requests.push(request.messages[0].content);
          return { text: replies.shift()!, toolCalls: [], stopReason: "end" };
        },
      };
      const draft = await kit.draftLinkedInArticle({ profile, page, zip: "93720", now, provider });
      assert.equal(draft.source, "ai");
      assert.equal(requests.length, 2);
      assert.match(requests[1], /rate, APR or percentage/);
      assert.doesNotMatch(draft.body, /5\.9%/);
      assert.match(draft.body, /NMLS #123456/);
    });

    it("uses the template when the AI keeps breaking the rules", async () => {
      const provider = {
        name: "fake",
        async generate() {
          return { text: `TITLE: Act now\n\nWe guarantee approval. ${longBody}`, toolCalls: [], stopReason: "end" };
        },
      };
      const draft = await kit.draftLinkedInArticle({ profile, page, zip: "93720", now, provider });
      assert.equal(draft.source, "template");
      assert.doesNotMatch(draft.body, /guarantee/i);
    });
  });
});
