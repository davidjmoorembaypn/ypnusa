import assert from "node:assert/strict";
import test, { describe, it } from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import mediaManifest from "@/content/wp-import/media-manifest.json";
import { enforceSingleH1, needsFullPageLoad, normalizeWpHref, normalizeWpHtml, prepareWpHtml, tidyAutoLinks } from "./wp-html";

test("same-site hrefs lose trailing slashes and absolute ypnus.com hosts", () => {
  assert.equal(normalizeWpHref("/vs/bonzo/"), "/vs/bonzo");
  assert.equal(normalizeWpHref("/features/"), "/features");
  assert.equal(normalizeWpHref("/blog/"), "/blog");
  assert.equal(normalizeWpHref("/"), "/");
  assert.equal(normalizeWpHref("https://ypnus.com/vs/homebot/"), "/vs/homebot");
  assert.equal(normalizeWpHref("https://www.ypnus.com/markets/"), "/markets");
  assert.equal(normalizeWpHref("https://app.ypnus.com"), "/");
  assert.equal(normalizeWpHref("https://ypnus.com"), "/");
  assert.equal(normalizeWpHref("https://ypnus.com/"), "/");
});

test("query strings and fragments are kept", () => {
  assert.equal(normalizeWpHref("https://ypnus.com/pricing/?plan=pro#faq"), "/pricing?plan=pro#faq");
  assert.equal(normalizeWpHref("/blog/?ref=x"), "/blog?ref=x");
  assert.equal(normalizeWpHref("https://ypnus.com/lo-signup.html?plan=free"), "/login?next=%2Fonboarding");
});

test("retired WordPress paths are rewritten to their replacements", () => {
  assert.equal(normalizeWpHref("https://ypnus.com/check-zip.html"), "/claim-territory");
  assert.equal(normalizeWpHref("/territory/"), "/claim-territory");
  assert.equal(normalizeWpHref("/territory/fresno-93720/"), "/territory/fresno-93720");
  assert.equal(normalizeWpHref("https://ypnus.com/pricing-plans/"), "/pricing");
  assert.equal(normalizeWpHref("/pricing.html"), "/pricing");
  assert.equal(normalizeWpHref("https://ypnus.com/va-loans/"), "/loan-types/va-loan-leads");
  assert.equal(normalizeWpHref("/terms/"), "/terms-of-service");
  assert.equal(normalizeWpHref("/privacy"), "/privacy-policy");
});

test("external, anchor and non-http hrefs are left alone", () => {
  for (const href of [
    "https://www.nmlsconsumeraccess.org/EntityDetails.aspx/individual/787257/",
    "https://evil-ypnus.com/x/",
    "#faq",
    "mailto:support@ypnus.com",
    "tel:+15595120372",
    "style.css",
    "",
  ]) {
    assert.equal(normalizeWpHref(href), href);
  }
});

test("normalizeWpHtml rewrites anchors, drops WP endpoints, the broken banner and relative assets", () => {
  const html = [
    '<link rel="pingback" href="https://ypnus.com/xmlrpc.php">',
    '<link rel="alternate" type="application/rss+xml" href="https://ypnus.com/feed/">',
    '<link rel="stylesheet" href="style.css">',
    '<a class="btn" href="https://ypnus.com/vs/bonzo/">Bonzo</a>',
    "<a href='/blog/'>Blog</a>",
    '<a href="https://ypnus.com/feed/">RSS</a>',
    '<p><img loading="lazy" src="https://ypnus.com/wp-content/uploads/2026/08/ypn-usa-mlo-banner.jpg" alt="x"></p>',
    '<img src="/images/david-j-moore-mba.jpg" alt="David">',
    '<script src="script.js"></script>',
    '<a href="https://example.com/a/">Ext</a>',
    "<p>Sign in at https://app.ypnus.com/login</p>",
  ].join("\n");
  const out = normalizeWpHtml(html);
  assert.ok(!out.includes("pingback"));
  assert.ok(!out.includes("/feed/"));
  assert.ok(!out.includes("style.css"));
  assert.ok(!out.includes("script.js"));
  assert.ok(!out.includes("ypn-usa-mlo-banner"));
  assert.ok(!out.includes("<p></p>"));
  assert.ok(out.includes('<a class="btn" href="/vs/bonzo">Bonzo</a>'));
  assert.ok(out.includes("<a href='/blog'>Blog</a>"));
  assert.ok(out.includes("RSS"));
  assert.ok(out.includes('src="/images/david-j-moore-mba.jpg"'));
  assert.ok(out.includes('href="https://example.com/a/"'));
  assert.ok(out.includes("<p>Sign in at https://ypnus.com/login</p>"));
  assert.ok(!out.includes("app.ypnus.com"));
  assert.equal(normalizeWpHtml(out), out, "idempotent");
});

test("enforceSingleH1 keeps exactly one h1", () => {
  // Renderer prints its own title: every body h1 is demoted.
  assert.deepEqual(enforceSingleH1('<h1 class="a">A</h1><p>x</p>', true), {
    html: '<h2 class="a">A</h2><p>x</p>',
    needsTitleH1: false,
  });
  // No renderer title, two body h1s: keep the first, demote the second.
  assert.deepEqual(enforceSingleH1("<h1>A</h1><h1>B</h1>", false), {
    html: "<h1>A</h1><h2>B</h2>",
    needsTitleH1: false,
  });
  // No h1 anywhere: the renderer must print the title.
  assert.deepEqual(enforceSingleH1("<h2>A</h2>", false), { html: "<h2>A</h2>", needsTitleH1: true });
  // h1s inside scripts are not markup (they don't count), but one a script writes at
  // runtime is demoted so the rendered page still has a single h1. CSS is untouched.
  const scripted = '<script>el.innerHTML = `<h1 class="x">${t}</h1>`;</script><style>h1{color:red}</style><p>y</p>';
  assert.deepEqual(enforceSingleH1(scripted, false), {
    html: '<script>el.innerHTML = `<h2 class="x">${t}</h2>`;</script><style>h1{color:red}</style><p>y</p>',
    needsTitleH1: true,
  });
});

test("prepareWpHtml combines link cleanup and the h1 rule", () => {
  const out = prepareWpHtml('<h1>T</h1><a href="https://app.ypnus.com/features/">F</a>', true);
  assert.equal(out.html, '<h2>T</h2><a href="/features">F</a>');
  assert.equal(out.needsTitleH1, false);
});

test("interactive imported pages need a full page load", () => {
  assert.equal(needsFullPageLoad("/mortgage-payment-calculator"), true);
  assert.equal(needsFullPageLoad("/mortgage-payment-calculator/"), true);
  assert.equal(needsFullPageLoad("/mlo-marketing?x=1"), true);
  assert.equal(needsFullPageLoad("/mlo-marketing/local-seo-for-loan-officers"), false);
  assert.equal(needsFullPageLoad("/pricing"), false);
});

describe("rehosted WordPress media", () => {
  it("rewrites known uploads to /media and leaves unknown files alone", () => {
    const html =
      '<p>x</p><img src="https://ypnus.com/wp-content/uploads/2026/05/real-estate-property-for-sale.jpg" srcset="https://ypnus.com/wp-content/uploads/2026/05/real-estate-property-for-sale-768x419.jpg 768w"><img src="/wp-content/uploads/2099/01/not-here.jpg">';
    const out = normalizeWpHtml(html);
    assert.ok(out.includes('src="/media/uploads/2026/05/real-estate-property-for-sale.jpg"'));
    assert.ok(out.includes("/media/uploads/2026/05/real-estate-property-for-sale-768x419.jpg 768w"));
    assert.ok(out.includes("/wp-content/uploads/2099/01/not-here.jpg"));
    assert.match(out, /<img width="\d+" height="\d+" decoding="async" src="\/media\/uploads\/2026\/05\/real-estate-property-for-sale\.jpg"/);
    assert.match(out, /<img decoding="async" loading="lazy" src="\/wp-content\/uploads\/2099/);
  });

  it("has every manifest file on disk", () => {
    for (const rel of Object.keys(mediaManifest)) {
      assert.ok(existsSync(path.join(process.cwd(), "public/media/uploads", rel)), rel);
    }
  });
});

test("root-level post links go to /blog and redirected slugs skip the hop", () => {
  assert.equal(normalizeWpHref("/local-zip-code-market-intelligence/"), "/blog/local-zip-code-market-intelligence");
  assert.equal(normalizeWpHref("https://ypnus.com/onboarding.html"), "/onboarding");
});

test("replaces old file-name link text in imported posts with words", () => {
  const html = '<p>See <a href="/claim-territory?utm_source=ypnus">check-zip.html</a> and <a href="/login?next=%2Fonboarding">lo-signup.html</a>.</p>';
  const out = normalizeWpHtml(html);
  assert.match(out, />whether your ZIP code is open<\/a>/);
  assert.match(out, />create your free account<\/a>/);
  assert.doesNotMatch(out, /\.html<\/a>/);
  assert.match(out, /href="\/claim-territory"/);
});

test("campaign tags come off internal links, other parameters stay", () => {
  assert.equal(normalizeWpHref("/blog/?utm_source=x"), "/blog");
  assert.equal(
    normalizeWpHref("https://ypnus.com/pricing?utm_source=ypnus&utm_medium=cta&utm_campaign=post_x&utm_content=depth"),
    "/pricing",
  );
  assert.equal(normalizeWpHref("/claim-territory?utm_source=ypnus&amp;zip=93277&amp;utm_medium=body#form"), "/claim-territory?zip=93277#form");
  assert.equal(normalizeWpHref("/pricing?plan=pro&utm_source=a"), "/pricing?plan=pro");
  // Other sites keep their tags: that is how they credit a visit from us.
  assert.equal(
    normalizeWpHref("https://toinvested.com/property-analyzer/?utm_source=ypnus"),
    "https://toinvested.com/property-analyzer/?utm_source=ypnus",
  );
});

test("WordPress ZIP code forms submit to the live checker without campaign tags", () => {
  const html =
    '<form class="zipf" action="https://ypnus.com/check-zip.html" method="get"><input type="hidden" name="utm_source" value="guide">' +
    '<input type="hidden" name="utm_medium" value="zip_form"><input name="zip" type="text"></form>';
  const out = normalizeWpHtml(html);
  assert.match(out, /<form class="zipf" action="\/claim-territory" method="get">/);
  assert.doesNotMatch(out, /utm_/);
  assert.match(out, /<input name="zip" type="text">/);
});

test("the dead WordPress briefing script is removed, other scripts stay", () => {
  const html =
    '<form id="ypnHubBrief"></form><script>(function(){fetch("/wp-json/ypnusa-homepage/v1/lead",{method:"POST"})})();</script>' +
    "<script>var calc = 1;</script>";
  const out = normalizeWpHtml(html);
  assert.doesNotMatch(out, /ypnusa-homepage/);
  assert.match(out, /<script>var calc = 1;<\/script>/);
  assert.match(out, /<form method="post" id="ypnHubBrief"><\/form>/);
});

test("WordPress's &#038; escapes are separators, not fragments", () => {
  assert.equal(normalizeWpHref("https://ypnus.com/pricing-plans/?utm_source=ypnus&#038;utm_medium=cta&#038;utm_campaign=x"), "/pricing");
  assert.equal(normalizeWpHref("/pricing?a=1&#38;b=2&#038;utm_source=x#faq"), "/pricing?a=1&amp;b=2#faq");
});

test("bridged lead forms post even before JavaScript loads", () => {
  const out = normalizeWpHtml('<form id="contact-form"><input name="ct_name"></form><form id="other"></form>');
  assert.match(out, /<form method="post" id="contact-form">/);
  assert.match(out, /<form id="other">/);
  assert.match(normalizeWpHtml('<form class="brief" id="ypnHubBrief" novalidate>'), /<form method="post" class="brief" id="ypnHubBrief" novalidate>/);
});

test("only real hidden utm inputs are removed", () => {
  const html = '<input data-type="hidden" name="utm_source"><input type="hidden" name="utm_medium" value="x">';
  assert.equal(normalizeWpHtml(html), '<input data-type="hidden" name="utm_source">');
});

test("normalizeWpHtml drops a pasted document's wrapper and <title> but keeps its style and content", () => {
  const html =
    '\n<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width">\n' +
    "<title>Second title</title>\n<style>.x{color:red}</style>\n</head>\n<body>\n<p>Hello</p><meta itemprop=\"name\" content=\"Kept\">\n</body>\n</html>";
  const out = normalizeWpHtml(html);
  assert.doesNotMatch(out, /<title|<meta charset|<meta name|<html|<\/html|<head|<\/head|<body|<\/body|DOCTYPE/i);
  assert.match(out, /<style>\.x\{color:red\}<\/style>/);
  assert.match(out, /<p>Hello<\/p>/);
  assert.match(out, /<meta itemprop="name" content="Kept">/, "microdata meta is kept");
  assert.equal(normalizeWpHtml(out), out, "idempotent");
});

test("normalizeWpHtml keeps SVG titles and microdata meta whose values mention charset or viewport", () => {
  const svg = '<svg role="img" aria-labelledby="t1"><title id="t1">Loan comparison</title><rect/></svg>';
  const meta =
    '<meta itemprop="url" content="https://example.org/charset"><meta itemprop="name" content="viewport http-equiv">' +
    '<meta name="description" content="A charset=UTF-8 guide"><meta content="A charset=UTF-8 > guide" itemprop="description">';
  const out = normalizeWpHtml(`<title>Page</title>${svg}<p>x</p>${meta}`);
  assert.ok(out.includes(svg), "svg title kept");
  assert.ok(out.includes(meta), "itemprop meta kept");
  assert.doesNotMatch(out, /<title>Page<\/title>/);
  const docMeta = normalizeWpHtml("<meta charset='utf-8'><meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\"><meta name=viewport content=\"width=device-width\"><p>y</p>");
  assert.equal(docMeta, "<p>y</p>");
});

describe("anchor text and auto-link cleanup (Nov 24 audit)", () => {
  it("unwraps the auto-linked bare 'MLO' term but keeps the word", () => {
    const out = normalizeWpHtml('<p>If another <a href="https://ypnus.com/mlo-marketing-automation/">MLO</a> in your area</p>');
    assert.equal(out, "<p>If another MLO in your area</p>");
  });

  it("unwraps 'pre-approval' linked to the features page, keeps other pre-approval links", () => {
    assert.equal(normalizeWpHtml('<a href="/features/">pre-approval</a>'), "pre-approval");
    assert.match(normalizeWpHtml('<a href="/blog/pre-approval-guide">pre-approval</a>'), /<a href="\/blog\/pre-approval-guide">/);
  });

  it("replaces the raw 'pricing-plans' slug used as link text", () => {
    assert.equal(normalizeWpHtml('<a href="/pricing-plans/">pricing-plans</a>'), '<a href="/pricing">YPN USA plans and pricing</a>');
  });

  it("links each related page once per body, but keeps repeated calls to action", () => {
    const html =
      '<a href="/vs/bonzo">YPN USA vs Bonzo</a> x <a href="/vs/bonzo">YPN USA vs Bonzo</a> ' +
      '<a href="/check-zip">Check your ZIP code</a> <a href="/check-zip">Check your ZIP code</a>';
    assert.equal(
      tidyAutoLinks(html),
      '<a href="/vs/bonzo">YPN USA vs Bonzo</a> x YPN USA vs Bonzo ' +
        '<a href="/check-zip">Check your ZIP code</a> <a href="/check-zip">Check your ZIP code</a>',
    );
  });

  it("leaves external links, image links and different link text alone", () => {
    const html =
      '<a href="https://example.com/a">A</a><a href="https://example.com/a">A</a>' +
      '<a href="/vs/bonzo"><img src="/x.png" alt="x"></a><a href="/vs/bonzo"><img src="/x.png" alt="x"></a>' +
      '<a href="/vs/bonzo">Bonzo</a><a href="/vs/bonzo">compare Bonzo</a>';
    assert.equal(tidyAutoLinks(html), html);
  });

  it("is safe to run twice", () => {
    const html = '<p><a href="/vs/homebot">Homebot</a> and <a href="/vs/homebot">Homebot</a> <a href="/mlo-marketing-automation">MLO</a></p>';
    const once = normalizeWpHtml(html);
    assert.equal(normalizeWpHtml(once), once);
  });

  it("drops editor placeholder images such as src=\"image-url\"", () => {
    const out = normalizeWpHtml('<figure class="wp-block-image"><img src="image-url" alt="Chart"></figure><p>Text</p>');
    assert.equal(out, "<p>Text</p>");
    assert.match(normalizeWpHtml('<img src="/media/uploads/2026/01/a.png" alt="a">'), /<img/);
    assert.match(normalizeWpHtml('<img src="data:image/png;base64,AAAA" alt="a">'), /<img/);
  });
});
