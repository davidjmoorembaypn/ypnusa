# Authority plan — changelog

## 2026-11-05 — Month 1 (files only; nothing deployed or published)

### Baseline
- `authority/baseline.md`: 10 prompts checked. ypnus.com absent from top results for all 10, including the branded search. Paid AI-answer tools were unavailable (OpenSEO Prompt Explorer needs the paid plan; Semrush out of API units; Ahrefs plan insufficient), so this is a web-search proxy.

### Comparison pages (10)
- Rebuilt `/vs/bonzo/`, `/vs/homebot/`, `/vs/lendingtree/`, `/vs/mortgage-coach/`, `/vs/total-expert/`, `/vs/velocify/`, `/vs/zillow-flex/`, `/ypnus-vs-bntouch/`, `/ypnus-vs-loanofficer-ai/`, `/ypnus-vs-real-geeks/`. URLs and page IDs unchanged.
- Each page: quick answer, at-a-glance table, what each product is, feature table, published pricing with source link and check date, pros and cons for both (YPN USA included), five-stage workflow fit, who should choose which, verdict, visible FAQ (matches FAQPage schema), sources, trademark and conflict-of-interest disclosure, "More comparisons" links.
- Competitor facts come only from each competitor's own site, read 2026-11-05 (sources listed on each page and in `data/comparisons.json`). Where a company publishes no pricing, the page says so.
- Removed claims the old pages made that YPN USA "generates exclusive leads"; replaced with what the About page says the product does, plus "no guaranteed results".
- Old pricing (Growth $99.99 / Pro $199.99 / Elite $299.99) gone from all 10; they now state Free $0, Pro $99, Growth $199, Exclusive $299.
- Source data: `data/comparisons.json`; generator: `scripts/build-comparisons.js` (`npm run build:comparisons`). Originals saved in `authority/originals/`.
- Zillow Flex page reframed: Zillow's own page lists Flex for agents, brokers and teams, not loan officers.

### Author block and schema
- `views/partials/author-bio.ejs`: name, title, bio from `site.json` (licenses and role only), NMLS with Consumer Access verify link, DRE, MBA, review date, editorial policy link. Removed the unconfirmed "25-year mortgage loan officer" line.
- Shown on comparison, loan-type, market, feature, platform, territory, mlo-marketing and compare pages (opt out per page with `authorBox: false`), and on posts as before.
- JSON-LD (`src/seo.js`): Person node (with NMLS/DRE identifiers and EducationalOccupationalCredential) on all author-block pages; WebPage `author`, `lastReviewed`, `reviewedBy`; new `Article` node on pages with `schemaType: "Article"` (the 10 comparisons). NMLS/DRE identifiers moved from Organization to Person, since they are David's individual licenses and YPN Inc. is not a lender. FAQPage and BreadcrumbList unchanged (comparisons now get the generated BreadcrumbList instead of their old embedded one).
- Validated: all JSON-LD parses on 482 URLs (`npm run check`, 0 failures, 0 broken links).

### Internal links
- `data/internal-links.json` + `src/related-links.js`: "Keep exploring" block (3–7 links) under loan-type, market, territory, feature, platform, mlo-marketing, compare and vs-hub pages. Skips links already in the body and missing pages.

### New draft pages (noindex until David approves)
- `/editorial-policy/` and `/research-methodology/` (`robots: noindex,follow`, `draftForReview: true`). To publish: set `robots` to `index,follow` and remove `draftForReview`.

### Other
- `public/assets/site.css`: styles for related links and author credentials.
- README: notes on comparisons, internal links, author bio.
- `ypnus-node.zip` was NOT rebuilt; rebuild it before upload.

## 2026-11-05 — Old pricing removed site-wide (David: "continue")

- Replaced every remaining old price and tier name in `content/` with the current tiers: Free $0, Pro $99/mo, Growth $199/mo, Exclusive $299/mo. Old prices mapped by amount: $99.99 Growth → Pro $99, $199.99 Pro → Growth $199, $299.99 Elite → Exclusive $299.
- Pages changed (10): `/` (index), `/about/`, `/how-it-works/`, `/features/`, `/mlo-growth-engine/`, `/agent-co-branding/`, `/platform/loan-officer-crm/`, `/boost-business-ai-mortgae-leads-ypn-usa/`, `/easy-mortgage-websites-ypn-usa-professionals/`, `/boost-your-mortgage-business-ypn-usa-insights/`. These are the 10 pages MIGRATION-REPORT.md listed as needing a pricing decision.
- Covers price cards, FAQ text and their FAQPage schema, embedded JSON-LD Offers (99.99/199.99/299.99 → 99/199/299), "See plan" buttons, trial notes ("15-day free trial, then $99/month"), the home page break-even calculator (now divides by $99, "months of the Pro plan"), the `/features/` mini price grid (names were Growth $99 / Pro $199 / Elite $299), `/agent-co-branding/` page allotments by tier, and "Included (Pro/Elite)" on `/platform/loan-officer-crm/`.
- Generic uses kept: "Elite-scale production" in two Central Valley posts (not a plan name). Unpublished drafts in `content/_unpublished/` not touched.
- Originals saved in `authority/originals/pricing-fix/`.
- `npm run check`: 482 URLs, 0 failures, 0 broken links. A search of content/, views/, src/ and data/site.json finds no $99.99 / $199.99 / $299.99 or "Elite" plan name.
- **Not changed, needs David:** the home page has 5 Stripe checkout links (buy.stripe.com, three plan buttons plus the post-ZIP-check buttons). Their labels now say Pro $99 / Growth $199 / Exclusive $299, but the links themselves were created for the old $99.99 / $199.99 / $299.99 plans and may still charge those amounts. Replace them with payment links for the new prices before launch. The buttons also keep their old `data-stripe-plan` attributes (growth/pro/elite) for analytics.

## 2026-11-05 — Founder experience claims added (confirmed by David)

- David confirmed: 25 years as a mortgage loan officer, 2,000+ home loans closed, former Wells Fargo and JPMorgan Chase loan officer, MBA from California State University, Fresno.
- `data/site.json` `founder.bio` now carries these claims; the author block shows them on every author-block page and post.
- Person JSON-LD (`src/seo.js`): `description` = bio, new `alumniOf` (California State University, Fresno), MBA credential now `recognizedBy` Fresno State.
- Made the site consistent with 25 years (was "20+ years" / "two decades"): `/about-david-moore/` (intro line, first paragraph, expertise card, meta description), `/best-ai-mortgage-marketing-2026/` byline, `/guides/` intro. Originals in `authority/originals/bio/`.
- `npm run check`: 0 failures, 0 broken links.

## 2026-11-05 — David's answers applied ("whatever you suggest")

### Editorial Policy and Research Methodology — now live-ready
- Promises: "David J. Moore or a licensed reviewer reviews every page before it is published"; "No company pays to be included, ranked or left out of a comparison"; comparisons rechecked "at least every 6 months, and sooner when a company changes its pricing" (was 90 days).
- Removed `noindex` and `draftForReview` from `/editorial-policy/` and `/research-methodology/`; both are now in the sitemap. Added "How We Compare" and "Editorial Policy" to the footer links (`data/site.json`).
- `data/comparisons.json` readme updated to the 6-month recheck.

### CRM wording
- `/platform/loan-officer-crm/` (URL kept) rewritten: "Lead Capture and Follow-Up That Works Alongside Your CRM". Says YPN USA is not a CRM replacement; adds built-in lead capture, AI intake and follow-up; keeps the CRM for the full pipeline and the LOS as system of record. Removed "full CRM", "What YPN USA replaces", the CSV-import FAQ and duplicate CTA blocks. New FAQ with matching FAQPage schema.
- Matching wording on `/platform/mortgage-pos-intake/` ("Instant lead record … alongside your CRM"; meta description), the `/features/` related card, and the next/previous links on `/platform/mortgage-pos-intake/` and `/seo-is-officially-dead-long-live-semantic-intelligence/`. Originals in `authority/originals/crm-wording/`.

### AI tracking
- No paid tool. New `authority/citation-check.md`: the same 10 prompts monthly across Google (incl. AI Overview), Bing, and free ChatGPT, Perplexity and Copilot, with a record template and quick Search Console/Bing checks.

### Check
- `npm run check`: 484 URLs (2 new pages), 0 failures, 0 broken links.
