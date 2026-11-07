import assert from "node:assert/strict";
import test from "node:test";
import { enforceSingleH1, needsFullPageLoad, normalizeWpHref, normalizeWpHtml, prepareWpHtml } from "./wp-html";

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
  assert.equal(normalizeWpHref("/blog/?utm_source=x"), "/blog?utm_source=x");
  assert.equal(normalizeWpHref("https://ypnus.com/lo-signup.html?plan=free"), "/lo-signup.html?plan=free");
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
  assert.equal(needsFullPageLoad("/agent-co-branding/"), true);
  assert.equal(needsFullPageLoad("/mlo-marketing?x=1"), true);
  assert.equal(needsFullPageLoad("/mlo-marketing/local-seo-for-loan-officers"), false);
  assert.equal(needsFullPageLoad("/pricing"), false);
});
