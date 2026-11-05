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
