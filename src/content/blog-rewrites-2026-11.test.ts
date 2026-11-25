import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_BLOG_POSTS } from "@/content/blog-all";
import { CONSOLIDATED_POST_SLUGS } from "@/content/august-batch-consolidation";
import {
  EMAIL_FOLLOW_UP_SEQUENCES,
  LANDING_PAGE_EXAMPLES,
  LOAN_OFFICER_MARKETING_STRATEGIES as POST,
  MORTGAGE_LEAD_GENERATION,
  MORTGAGE_REFERRALS_BEYOND_REALTORS,
  NEW_LOAN_OFFICER_CLIENTS,
  RESPA_CO_MARKETING,
  REWRITTEN_POSTS,
  SOCIAL_MEDIA_POSTING_FREQUENCY,
  SOCIAL_MEDIA_WHAT_WORKS,
} from "@/content/blog-rewrites-2026-11";
import { WP_POSTS } from "@/content/wp-import";
import { INDEXABLE_POSTS, TOPIC_CLUSTERS } from "@/lib/seo/clusters";

/** Visible text of an HTML fragment: scripts and styles removed, tags stripped. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

describe("rewritten marketing-strategies post", () => {
  it("replaces the imported post at the same URL and stays indexable", () => {
    const same = ALL_BLOG_POSTS.filter((p) => p.slug === POST.slug);
    assert.equal(same.length, 1, "exactly one post with this slug");
    assert.equal(same[0], POST, "the native rewrite wins over the imported post");
    assert.ok(WP_POSTS.some((p) => p.slug === POST.slug), "the imported post it replaces still exists in the import");
    assert.ok(INDEXABLE_POSTS.some((p) => p.slug === POST.slug), "indexable, so it stays in the sitemap");
    assert.ok(!CONSOLIDATED_POST_SLUGS.has(POST.slug));
    assert.ok(REWRITTEN_POSTS.includes(POST));
  });

  it("has none of the junk the imported version showed to readers", () => {
    const text = visibleText(POST.html);
    for (const bad of ['"@context"', '"@graph"', "@type", "production-ready", "Internal linking map", "VA Loan Fresno", "Table of Contents", "Home »", "silo"]) {
      assert.ok(!text.includes(bad), `visible text contains ${bad}`);
    }
    assert.ok(!/\[\d+(?:,\s*\d+)*\]/.test(text), "citation markers like [1, 2, 3]");
    assert.ok(!/<script/i.test(POST.html), "no script tags in the body");
    assert.ok(!/\$\s?29\.99/.test(POST.html), "the retired $29.99 price");
  });

  it("opens with a quotable answer and carries a visible FAQ and sources", () => {
    assert.match(POST.html, /^<p><strong>Short answer:<\/strong>/);
    assert.ok(POST.faq && POST.faq.length >= 4, "at least four FAQ entries");
    for (const item of POST.faq ?? []) {
      assert.ok(item.q.endsWith("?") && item.a.length > 40, item.q);
    }
    const sources = POST.html.slice(POST.html.indexOf("<h2>Sources</h2>"));
    const links = [...sources.matchAll(/<a href="(https:\/\/[^"]+)"[^>]*rel="noopener nofollow"/g)].map((m) => m[1]);
    assert.ok(links.length >= 3, `only ${links.length} sources`);
    for (const url of links) assert.match(url, /^https:\/\/(www\.consumerfinance\.gov|www\.fcc\.gov|docs\.fcc\.gov)\//, url);
  });

  it("keeps the title and description inside SERP limits", () => {
    assert.ok(POST.metaTitle && POST.metaTitle.length <= 60, `metaTitle ${POST.metaTitle?.length}`);
    assert.ok(POST.description.length <= 160, `description ${POST.description.length}`);
    assert.match(POST.description, /loan officer marketing/i);
  });

  it("links only to posts that are published, indexable and not consolidated, and never to itself", () => {
    const indexable = new Set(INDEXABLE_POSTS.map((p) => p.slug));
    const html = [POST.html, ...(POST.faq ?? []).map((f) => f.html ?? "")].join("\n");
    const slugs = [...html.matchAll(/href="\/blog\/([a-z0-9-]+)"/g)].map((m) => m[1]);
    assert.ok(slugs.length >= 8, `only ${slugs.length} internal links`);
    for (const slug of slugs) {
      assert.notEqual(slug, POST.slug, "links to itself");
      assert.ok(!CONSOLIDATED_POST_SLUGS.has(slug), `${slug} is consolidated (it redirects)`);
      assert.ok(indexable.has(slug), `${slug} is not an indexable post`);
    }
  });
});

describe("meta descriptions of imported posts", () => {
  it("do not start with a stray 'n' left by a lost newline", () => {
    const bad = WP_POSTS.filter((p) => /^n\s/.test(p.description)).map((p) => p.slug);
    assert.deepEqual(bad, []);
  });
});

describe("mortgage leads pillar page", () => {
  const cluster = TOPIC_CLUSTERS.find((c) => c.slug === "exclusive-mortgage-leads");

  it("targets 'mortgage leads for loan officers' in the title, description and H1", () => {
    assert.ok(cluster);
    assert.match(cluster.title, /^Mortgage Leads for Loan Officers/);
    assert.match(cluster.description, /mortgage leads for loan officers/i);
    assert.match(cluster.h1, /^Mortgage leads for loan officers/);
  });

  it("answers how loan officers get leads and whether shared leads are worth buying", () => {
    const questions = cluster?.faq.map((f) => f.q) ?? [];
    assert.ok(questions.includes("How do loan officers get mortgage leads?"));
    assert.ok(questions.includes("Are shared mortgage leads worth buying?"));
    assert.ok(questions.length >= 4);
  });
});

const BATCH = [
  { name: "RESPA co-marketing", post: RESPA_CO_MARKETING, phrase: /co-marketing/i },
  { name: "new loan officer clients", post: NEW_LOAN_OFFICER_CLIENTS, phrase: /new loan officer/i },
  { name: "mortgage lead generation", post: MORTGAGE_LEAD_GENERATION, phrase: /mortgage lead generation/i },
  { name: "landing page examples", post: LANDING_PAGE_EXAMPLES, phrase: /mortgage landing page/i },
  { name: "referrals beyond Realtors", post: MORTGAGE_REFERRALS_BEYOND_REALTORS, phrase: /mortgage referrals/i },
  { name: "email follow-up sequences", post: EMAIL_FOLLOW_UP_SEQUENCES, phrase: /email follow-up/i },
];
const SOURCE_HOSTS =
  /^https:\/\/(www\.consumerfinance\.gov|www\.fcc\.gov|docs\.fcc\.gov|www\.ftc\.gov|www\.nar\.realtor|www\.ecfr\.gov|web\.dev|answers\.hud\.gov|www\.va\.gov|www\.rd\.usda\.gov|singlefamily\.fanniemae\.com|support\.google\.com)\//;

for (const { name, post, phrase } of BATCH) {
  describe(`rewritten post: ${name}`, () => {
    it("replaces the imported post at the same URL and stays indexable", () => {
      const same = ALL_BLOG_POSTS.filter((p) => p.slug === post.slug);
      assert.equal(same.length, 1);
      assert.equal(same[0], post);
      assert.ok(WP_POSTS.some((p) => p.slug === post.slug));
      assert.ok(INDEXABLE_POSTS.some((p) => p.slug === post.slug));
      assert.ok(!CONSOLIDATED_POST_SLUGS.has(post.slug));
      assert.ok(REWRITTEN_POSTS.includes(post));
    });

    it("has none of the junk the imported version showed", () => {
      const text = visibleText(post.html);
      for (const bad of ['"@context"', "@type", "production-ready", "Internal linking map", "Table of Contents", "Home »", "silo", "MLO production"]) {
        assert.ok(!text.includes(bad), `visible text contains ${bad}`);
      }
      assert.ok(!/\[\d+(?:,\s*\d+)*\]/.test(text));
      assert.ok(!/<script/i.test(post.html));
      assert.ok(!/\$\s?29\.99/.test(post.html));
      assert.ok(!/^n\s/.test(post.description) && !/^n\s/.test(visibleText(post.html).trim()));
      const h2 = [...post.html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1]);
      assert.equal(new Set(h2).size, h2.length, "duplicate section headings");
    });

    it("opens with a quotable answer, a visible FAQ and sourced facts", () => {
      assert.match(post.html, /^<p><strong>Short answer:<\/strong>/);
      assert.ok(post.faq && post.faq.length >= 4);
      for (const item of post.faq ?? []) assert.ok(item.q.endsWith("?") && item.a.length > 40, item.q);
      const sources = post.html.slice(post.html.indexOf("<h2>Sources</h2>"));
      const links = [...sources.matchAll(/<a href="(https:\/\/[^"]+)"[^>]*rel="noopener nofollow"/g)].map((m) => m[1]);
      assert.ok(links.length >= 3, `only ${links.length} sources`);
      for (const url of links) assert.match(url, SOURCE_HOSTS, url);
    });

    it("keeps title and description inside SERP limits and targets its phrase", () => {
      assert.ok(post.metaTitle && post.metaTitle.length <= 60, `metaTitle ${post.metaTitle?.length}`);
      assert.ok(post.title.length <= 70, `title ${post.title.length}`);
      assert.ok(post.description.length <= 160, `description ${post.description.length}`);
      assert.ok(post.description.length >= 100);
      assert.match(`${post.title} ${post.description}`, phrase);
    });

    it("links only to indexable, non-consolidated posts and never to itself", () => {
      const indexable = new Set(INDEXABLE_POSTS.map((p) => p.slug));
      const html = [post.html, ...(post.faq ?? []).map((f) => f.html ?? "")].join("\n");
      const slugs = [...html.matchAll(/href="\/blog\/([a-z0-9-]+)"/g)].map((m) => m[1]);
      assert.ok(slugs.length >= 6, `only ${slugs.length} internal links`);
      for (const slug of slugs) {
        assert.notEqual(slug, post.slug);
        assert.ok(!CONSOLIDATED_POST_SLUGS.has(slug), `${slug} is consolidated`);
        assert.ok(indexable.has(slug), `${slug} is not an indexable post`);
      }
    });
  });
}

describe("rewritten posts do not compete with each other", () => {
  it("each has its own title and description", () => {
    const all = [POST, ...BATCH.map((b) => b.post)];
    assert.equal(new Set(all.map((p) => p.title)).size, all.length);
    assert.equal(new Set(all.map((p) => p.metaTitle)).size, all.length);
    assert.equal(new Set(all.map((p) => p.description)).size, all.length);
  });

  it("makes no unsourced cost-splitting safe-harbor claim", () => {
    const text = visibleText(RESPA_CO_MARKETING.html).toLowerCase();
    for (const bad of ["safe harbor", "always compliant", "guaranteed compliant", "fair-market share"]) assert.ok(!text.includes(bad), bad);
    assert.match(text, /not legal advice/);
  });
});

describe("second batch of rewrites (landing pages, referrals, email follow-up)", () => {
  const SECOND = [LANDING_PAGE_EXAMPLES, MORTGAGE_REFERRALS_BEYOND_REALTORS, EMAIL_FOLLOW_UP_SEQUENCES];

  it("links to the ZIP check and to a real pillar page", () => {
    const pillars = new Set(TOPIC_CLUSTERS.map((c) => c.slug));
    for (const post of SECOND) {
      const html = [post.html, post.closingHtml ?? ""].join("\n");
      assert.match(html, /href="\/check-zip"/, `${post.slug} has no ZIP-check link`);
      assert.match(html, /href="\/pricing"/, `${post.slug} has no pricing link`);
      const topics = [...html.matchAll(/href="\/topics\/([a-z0-9-]+)"/g)].map((m) => m[1]);
      assert.ok(topics.length >= 1, `${post.slug} links to no pillar`);
      for (const t of topics) assert.ok(pillars.has(t), `${post.slug} links to unknown pillar ${t}`);
      assert.ok(pillars.has(post.cluster ?? ""), `${post.slug} has no valid cluster`);
    }
  });

  it("drops the unsourced claims the imported versions made", () => {
    const banned = [
      "fewer than 20 percent",
      "measurably",
      "Maria",
      "10 to 30",
      "almost always the highest",
      "highest open and response rates",
      "consistently generates the highest",
      "automates this entirely",
      "SMS, AI-powered lead scoring",
    ];
    for (const post of SECOND) {
      const text = visibleText([post.html, ...(post.faq ?? []).map((f) => f.a)].join(" "));
      for (const phrase of banned) assert.ok(!text.includes(phrase), `${post.slug} still says "${phrase}"`);
    }
  });

  it("describes Cerebro's emails as the code behaves: on its own by default, held in approve-first mode, no texts", () => {
    const text = visibleText([EMAIL_FOLLOW_UP_SEQUENCES.html, EMAIL_FOLLOW_UP_SEQUENCES.closingHtml ?? "", ...(EMAIL_FOLLOW_UP_SEQUENCES.faq ?? []).map((f) => f.a)].join(" "));
    assert.match(text, /By default it sends them on its own/);
    assert.match(text, /approve-first mode it holds each one for your OK/);
    assert.match(text, /It sends no texts/);
    for (const wrong of ["nothing is sent automatically", "You approve each message", "drafts follow-up messages for you to review"]) {
      assert.ok(!text.includes(wrong), `still says "${wrong}"`);
    }
  });

  it("states every loan program number it uses with its source link", () => {
    const sources = EMAIL_FOLLOW_UP_SEQUENCES.html.slice(EMAIL_FOLLOW_UP_SEQUENCES.html.indexOf("<h2>Sources</h2>"));
    for (const host of ["answers.hud.gov", "www.va.gov", "www.rd.usda.gov", "singlefamily.fanniemae.com"]) {
      assert.ok(sources.includes(host), `missing source ${host}`);
    }
  });
});

describe("social media posts (platforms/timing and posting-frequency)", () => {
  const SOCIAL_POSTS = [SOCIAL_MEDIA_WHAT_WORKS, SOCIAL_MEDIA_POSTING_FREQUENCY];

  it("each replaces the imported post of the same slug and stays indexable", () => {
    for (const post of SOCIAL_POSTS) {
      const same = ALL_BLOG_POSTS.filter((p) => p.slug === post.slug);
      assert.equal(same.length, 1, `${post.slug}: exactly one post with this slug`);
      // ALL_BLOG_POSTS may wrap the post with an auto-generated metaTitle (see blog-all.ts's
      // withSeoTitle) when the title is too long for SERPs, so compare the content fields
      // rather than requiring reference equality.
      assert.equal(same[0].title, post.title, `${post.slug}: the native rewrite's title wins`);
      assert.equal(same[0].html, post.html, `${post.slug}: the native rewrite's body wins over the imported post`);
      assert.ok(WP_POSTS.some((p) => p.slug === post.slug), `${post.slug}: the imported post it replaces still exists`);
      assert.ok(INDEXABLE_POSTS.some((p) => p.slug === post.slug), `${post.slug}: indexable, so it stays in the sitemap`);
      assert.ok(!CONSOLIDATED_POST_SLUGS.has(post.slug));
      assert.ok(REWRITTEN_POSTS.includes(post));
    }
  });

  it("each carries a visible FAQ and cited sources", () => {
    for (const post of SOCIAL_POSTS) {
      assert.ok(post.faq && post.faq.length >= 4, `${post.slug}: at least four FAQ entries`);
      for (const item of post.faq ?? []) {
        assert.ok(item.q.endsWith("?") && item.a.length > 40, `${post.slug}: ${item.q}`);
      }
      const sources = post.html.slice(post.html.indexOf("<h2>Sources</h2>"));
      const links = [...sources.matchAll(/<a href="(https:\/\/[^"]+)"[^>]*>/g)].map((m) => m[1]);
      assert.ok(links.length >= 2, `${post.slug}: only ${links.length} sources`);
      for (const url of links) assert.match(url, /^https:\/\/(www\.)?(sproutsocial|buffer|contentin|webtonic)\.(com|io)\//, `${post.slug}: ${url}`);
    }
  });

  it("drops the unsupported single-best-day/slot ranking that CodeRabbit flagged", () => {
    for (const post of SOCIAL_POSTS) {
      const text = visibleText([post.html, ...(post.faq ?? []).map((f) => f.a)].join(" "));
      for (const bad of ["ranked LinkedIn's single best day", "ranked the single best slot overall"]) {
        assert.ok(!text.includes(bad), `${post.slug}: still says "${bad}"`);
      }
      assert.ok(text.includes("10 AM") && text.includes("3 PM"), `${post.slug}: keeps the Tuesday/Wednesday 10 AM-3 PM window`);
    }
  });

  it("links between the two posts and to the platform-specific playbooks resolve to real posts", () => {
    const slugs = new Set(ALL_BLOG_POSTS.map((p) => p.slug));
    for (const post of SOCIAL_POSTS) {
      const internalLinks = [...post.html.matchAll(/href="\/blog\/([a-z0-9-]+)"/g)].map((m) => m[1]);
      assert.ok(internalLinks.length >= 1, `${post.slug}: expected at least one internal blog link`);
      for (const target of internalLinks) assert.ok(slugs.has(target), `${post.slug}: links to missing post /blog/${target}`);
    }
  });
});
