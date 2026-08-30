# WordPress Site Audit & Fix Log — ypnus.com

**Date:** 2026-08-30
**Scope:** Live WordPress site (ypnus.com) — CMS pages/posts, MU-plugins, and the parallel static HTML site in the web root. Performed via the Novamira MCP connector, directly against the production database and server filesystem. **None of this touched the `ypnusa` Next.js app repository** — this document is a record of that work, not a diff of this codebase.

All fixes below were verified against the *live* site after LiteSpeed cache purges, not just saved to the database.

---

## 1. Full-site SEO audit (Rank Math)

Baseline audit run via Rank Math's SEO analysis: overall score 78/100 ("good"), with the main flagged issue being 76 posts/pages missing focus keywords in their titles. This surfaced the starting point for the deeper issues below, most of which the stock audit didn't catch.

## 2. Duplicate / broken pages rebuilt

An automated content batch (dated Aug 26–28) had left several broken or duplicate pages live:

- **`/ai-mortgage-leads-for-loan-officers-ypn-usa/`** — a duplicate "homepage" competing with the real homepage for the same focus keyword, with fabricated stats ("14,961+ Verified Borrower Leads"), a fake JS calculator, and a dead link. Rewrote content, removed fabricated claims, retargeted its focus keyword away from the real homepage's, fixed the dead link.
- **`/mortgage-marketing-leads-for-loan-officers/`** — a second full duplicate homepage ("YPNUS HOMEPAGE V5"), with a footer block pasted in twice and nav links to nonexistent pages. Deduplicated, fixed dead links, restyled to match the site's real brand.
- **`/mortgage-leads/`** and **`/fresno-mortgage-leads/`** — both published with **completely empty content**. Built out as real money pages with genuine copy, no fabricated stats.

## 3. Home / About / Contact

- Home and About page **SEO titles were stored truncated mid-word with a trailing ellipsis** (e.g. "...Mortgage Loan Of…") — rewrote both as complete titles.
- Fixed a broken `/pricing/` link on the homepage (the real page is `/pricing-plans/`).
- Rewrote Contact page content — it opened with generic auto-generated filler copy and had a "Previous Page: Blog / Next Page" blog-pagination block that made no sense on a static contact page. Added real business info (phone/address).
- Replaced a fabricated, templated FAQ schema ("What is the primary key takeaway regarding Home?") with one that matches the real FAQ content actually on the page.

## 4. Core money pages (Platform, Pricing, Free Trial, Territory, Features)

- Fixed titles/descriptions/focus keywords.
- **Critical bug:** the **Territory page** (`/territory/`, the actual ZIP-claim/conversion page) was set to **`noindex`** — Google was explicitly blocked from indexing the site's most important conversion page. Fixed.
- Removed the same fabricated FAQ + invented "YPN USA MLO Suite" SoftwareApplication schema from all of them.
- Changed the site's default Page schema type from `software` (inappropriate for most pages) to `off`, so new/unconfigured pages stop inheriting a nonsensical default.

## 5. Comparison ("vs") pages cluster

- Found the same bugs repeated across all 6 canonical `/vs/{competitor}/` pages (Total Expert, Velocify, LendingTree, Zillow Flex, Mortgage Coach, hub page): **non-functional CTA buttons** (plain text, no actual link), a **placeholder `NMLS #XXXX`** never filled in, and a broken breadcrumb schema that had been mangled into visible garbage text on the page instead of valid JSON-LD. Fixed all of it across all 6.
- Found 2 duplicate junk pages ("vs Total Expert" and "vs ICE Velocify") scoring 0/100 on Rank Math, using the same generic filler template found elsewhere. 301-redirected them to their canonical twins and trashed the duplicates.
- The 2 genuinely-new comparisons in that batch (Bonzo, Homebot) had no better twin, so rewrote them with real, honest comparison content on clean `/vs/bonzo/` and `/vs/homebot/` URLs.

## 6. Sitewide mechanical/compliance fixes

- Fixed the fake **`NMLS #XXXX`** placeholder on 22 pages → real `NMLS #787257`.
- Removed the generic "Comprehensive Overview: [Page Title]" filler paragraph (a reused template with nonsensical mail-merge text, e.g. "Understanding **Blog** allows Mortgage Loan Originators...") from 18 pages.
- Fixed 4 pages with broken/unwrapped JSON-LD — one had raw, unescaped HTML `<a>` tags inside a JSON string, breaking the JSON entirely.
- Bulk-removed a fabricated, templated FAQ schema (identical placeholder Q&A referencing each page's own title) and an invented "YPN USA MLO Suite" SoftwareApplication schema found on **310 of 328 published pages/posts** — this had been stamped across virtually the entire site by an earlier automated pass.

## 7. City / loan-type page cluster (56 pages: FHA/VA/DSCR/Conventional/First-Time-Buyer × ~11 cities)

- Audited for broken interactive widgets, mangled entities, unwired buttons — all clean; these are static content pages, not interactive tools.
- Confirmed NMLS formatting consistent, no filler copy present.
- **Found the cluster had zero JSON-LD schema at all** (a side effect of the site's default-schema change in §4 combined with a Rank Math internal quirk where postmeta-driven schema wasn't rendering for these specific posts). Fixed by embedding page-specific `Service` schema (loan type + city parsed from each title) directly into all 56 pages, verified live.

## 8. Parallel static HTML site (44 files in the web root)

This site runs a second, hand-built static site alongside WordPress (`index.html`, `pricing.html`, `features.html`, `lo-signup.html`, `check-zip.html`, etc.), used for parts of the live conversion funnel.

**Quarantined (renamed off their public URLs, files preserved on disk, fully reversible):**
- **`_archived-static-index.html`** — an explicitly "archived" alternate homepage still live and displaying **`NMLS #1230391`** instead of the real, verified number, **`#787257`** — a real public-facing licensing-compliance risk.
- **`post3593_fixed.html`** — a raw, unstyled content fragment (no header/nav/footer) sitting publicly at its own URL.
- **`preview-direction-a/b/c.html`** — three internal design mockups ("Elevated Dark and Gold," "Light Corporate Trust," "Luxury Fintech Hybrid") with no noindex tag, fully crawlable by Google.
- **`readme.html`** — WordPress's own stock installer readme, exposed at `/readme.html` (security-hygiene / fingerprinting risk; low priority, `noindex,nofollow` already set).

**Fixed in place:**
- **`pricing.html`** — the Monthly/Annual billing toggle changed which button looked active but never updated the displayed prices (no `data-price-monthly`/`data-price-annual` markers existed for the site's own `ypnus-checkout-router.js` to target). Added correct annual-equivalent rates (Starter $25.49/mo, Pro $84.99/mo, Elite $254.99/mo) and wired them up; verified live.
- **`about.html`, `features.html`, `templates.html`, `ypn-sitebuilder-home.html`** — every self-referencing URL (canonical tags, Open Graph, JSON-LD, internal nav) was built against a `/sitebuilder/` subdirectory that was never deployed (404). A broken self-canonical tells Google the "real" page lives at a dead URL. Fixed 46 references across the 4 files to point to their actual live URLs.
- Checked all 82 unique internal links across the static site — only the `/sitebuilder/` issue above was broken.

## 9. Infrastructure discoveries (affect how future edits take effect)

- **`ypnus-seo-titles.php`** (MU-plugin) hard-forces the `<title>` tag via a hardcoded URL→title map, overriding Rank Math via four separate hooks (including an output-buffer string replace) for `/`, `/pricing-plans`, `/features`, `/contact`, `/about`. Updated its map to match the corrected titles from §3–4 — without this, title fixes to those five pages would not have appeared live.
- **LiteSpeed full-page cache** serves stale HTML after content changes; every fix in this log was verified only after an explicit `wp litespeed-purge all`.
- **`/territory/`** and **`/free-trial/`** 301-redirect to `check-zip.html`, a separate, well-built static conversion funnel with its own tracking and schema — left as-is (appears intentional), but means the WordPress "Territory"/"Free Trial" posts are not what visitors actually see at those URLs.
- **`/ml-engine/`** and **`/life-events-engine/`** similarly redirect to `/predictive-lead-gen/` — checked the real destination; it was already clean.

## 10. Blog posts (159 published posts)

- **Root-caused a sitewide duplicate-schema bug** instead of patching post-by-post: every post was emitting conflicting `Article` + `NewsArticle` + `BlogPosting` schema because a custom schema engine (`ypnus-rich-schema.php`) and Rank Math's native schema were both firing on the same post. Fixed with one targeted change to the plugin's Rank-Math-override logic.
- **151 of 159 posts** also had a legacy, redundant `Article` schema hardcoded directly into their own content (from before the custom engine existed) — one had a `mainEntityOfPage` URL pointing to a completely different article. Stripped from all 151.
- Fixed one post (1850) with raw, unwrapped JSON-LD rendering as visible garbage text.
- **80 of 159 posts** (half the blog) had their primary "Schedule a Demo Today" CTA linking to `https://ypnus.com/#contact` — an anchor that does not exist on the homepage. Fixed to the real `/contact/` page.
- Found and fixed **19 distinct broken internal links** across 145 unique URLs audited — some appearing on 70–90 posts each (`/fha-loan-guide/`, `/claim-your-zip/`, several fictional tool/guide pages that were never built, and a few posts linking to other posts' old, pre-rename slugs). Remapped all to real, verified-live destinations across 121 posts.
- One post ("SEO Article Writing Guide for Better Rankings") contained literal **unfilled AI-generation template stubs** presented as real links — "Pillar Topic Name," "Related Subtopic 1/2," "Affiliate Product Name" — including a fake affiliate-product pitch. Removed the fake affiliate sentence entirely; converted the other placeholders to honest descriptive text rather than inventing fake destinations.
- Removed a repeated **"MLO Production Strategy Blueprint"** callout box (identical boilerplate text) from **115 posts** — flagged as low-severity in an earlier pass, removed on explicit request. Verified zero remaining in the database and confirmed gone on 3 spot-checked live posts.

## Known follow-ups not addressed (flagged, not fixed)

- `templates.html` and `tools.html` (static site) were checked for links/schema but not given a full content-quality review.
- No further review was done on the ~30 static pages beyond the checks described in §8.
- Blog post body-copy quality (beyond the specific issues above) was not reviewed article-by-article.
