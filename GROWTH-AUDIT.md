# Growth audit: ypnus.com (2026-11-27)

Method: production build of `main` at `04a9f6f`, served locally (`npm start`), then every URL in
`/sitemap.xml` and `/local-seo-sitemap.xml` (414 URLs) fetched and parsed for status, `<title>`, meta
description, H1 count, canonical, Open Graph/Twitter tags, JSON-LD validity and visible word count.
Per-page results: `GROWTH-AUDIT-PAGES.csv` (before and after this branch). Repo and funnel map:
`REPO-MAP.md`.

## Headline result

The site was already in good technical shape after this month's SEO passes. Of 414 indexable URLs:

| Check | Before | After this branch |
|---|---|---|
| Non-200 URLs in sitemaps | 0 | 0 |
| Pages with more than one `<title>` | 0 | 0 |
| Pages without exactly one H1 | 0 | 0 |
| Missing or non-self canonical | 0 | 0 |
| Missing OG or Twitter tags | 0 | 0 |
| Invalid JSON-LD blocks | 0 | 0 |
| Duplicate titles / metas / H1s | 0 / 0 / 0 | 0 / 0 / 0 |
| Titles over 60 characters (cut off in Google) | **47** (longest 75) | **0** (longest 60) |
| Meta descriptions under 110 characters | 15 | 3 (blog excerpts, left as written) |
| Titles under 30 characters | 9 | 5 (legal pages, fine as is) |

## Key pages (before)

| Page | Title (chars) | Meta (chars) | H1 | Canonical | Words | JSON-LD |
|---|---|---|---|---|---|---|
| / | Mortgage Lead Generation & AI for Loan Officers \| YPN USA (57) | 142 | Want more time to close loans? Meet your own AI assistant. | self | 2185 | Organization, WebSite, WebPage, SoftwareApplication, FAQPage, VideoObject |
| /pricing | Pricing: Free, Pro, Growth & Exclusive Plans \| YPN USA (54) | 126 | Start free. Lock your territory when you're ready. | self | 1681 | Organization, WebSite, SoftwareApplication (Offer per plan), FAQPage, BreadcrumbList |
| /claim-territory | Claim Your Exclusive ZIP Code \| YPN USA (39) | 133 | Claim your exclusive ZIP code | self | 448 | Organization, WebSite, BreadcrumbList, Service |
| /cerebro | Cerebro: AI Assistant for Mortgage Loan Officers \| YPN USA (58) | 139 | Cerebro, the AI assistant for mortgage loan officers | self | 1067 | SoftwareApplication, FAQPage, BreadcrumbList |
| /features | Features: Local Pages, ZIP Codes & AI Intake \| YPN USA (54) | 138 | An AI assistant that answers, qualifies and follows up for you | self | 913 | BreadcrumbList |
| /teams | YPN USA for Mortgage Teams & Branch Managers (44) | 135 | A pipeline for every loan officer on your team | self | 936 | WebPage, Service, FAQPage, BreadcrumbList |
| /about | David J. Moore, MBA: Mortgage Expert & Author \| YPN USA (55) | 147 | David J. Moore, MBA — mortgage expert, author & founder of YPN USA | self | 510 | Person, ProfilePage, Book, BreadcrumbList |
| /compare | MLO Software Comparisons and Alternatives \| YPN USA (51) | 153 | Compare YPN USA to Shared Lead Vendors & MLO Tools | self | 1941 | ItemList, BreadcrumbList |
| /vs/zillow-flex | YPN USA vs Zillow Flex: What Loan Officers Should Know (2026) (61) | 144 | YPN USA vs Zillow Flex (2026): What Loan Officers Should Know | self | 1517 | Article, FAQPage, BreadcrumbList |
| /topics/exclusive-mortgage-leads | Mortgage Leads for Loan Officers: Exclusive vs Shared (53) | 138 | Mortgage leads for loan officers: exclusive vs shared… | self | 2198 | CollectionPage, FAQPage, BreadcrumbList |
| /loan-officers | Loan Officer Markets: Check Your ZIP Code \| YPN USA (51) | 136 | Find your market and claim your ZIP code | self | 764 | CollectionPage, FAQPage, BreadcrumbList |
| /roi | Loan Officer Marketing ROI Calculator \| YPN USA (47) | 116 | How many extra loans pay for YPN? | self | 643 | WebApplication, FAQPage, BreadcrumbList |

Word counts include header and footer text, so they overstate body copy by roughly 300 words.

## Top 20 fixes, ranked by (conversion impact × SEO impact) / effort

| # | Fix | Conv. | SEO | Effort | Status |
|---|---|---|---|---|---|
| 1 | Homepage H1 says who, what and why different (ZIP code, not shared leads) | High | Med | Low | Done, needs approval |
| 2 | Hero trust row: 1 per ZIP code, trial, ZIP code locks at first payment | High | — | Low | Done |
| 3 | Hero secondary CTA "Start free, no card required" | Med | — | Low | Done |
| 4 | Objection cards: not shared, works with your CRM, you handle rates and credit | High | Low | Low | Done |
| 5 | "Is YPN USA a lender?" in homepage FAQ + FAQPage schema | Med | Med | Low | Done |
| 6 | 404 sends lost visitors to Check ZIP code and Pricing, not the dashboard | Med | Low | Low | Done |
| 7 | 47 titles over 60 chars (brand suffix pushed blog, market and guide titles over) | — | Med | Low | Done (central fix + 20 hand titles) |
| 8 | 7 loan-type and hub metas at 97-107 chars, some with WordPress-era claims | Low | Med | Low | Done |
| 9 | Legal page metas still name app.ypnus.com, which now only redirects | — | Low | Low | Done |
| 10 | Feature and contact titles were one or two words ("Contact \| YPN USA") | — | Low | Low | Done |
| 11 | Unsourced stats in imported WordPress posts and pages (e.g. "65%–82% contact rate", "The average loan officer takes 47…") | Trust | Trust | Med | Flagged, not changed |
| 12 | Broken dollar figures in an imported post table (",500 – ,000+": "$" lost on import) | Trust | Low | Low | Flagged, not changed |
| 13 | Thin, overlapping posts compete with stronger ones on "exclusive vs shared" (`/blog/exclusive-zip-territory-vs-shared-mortgage-leads`, `/blog/how-mlos-capture-exclusive-ai-mortgage-leads`) | — | Med | Med | Needs approval (301 merge) |
| 14 | Header sticky CTA is "Start free"; brief's primary is "Check my ZIP code" | Med | — | Low | Needs approval |
| 15 | "15-day paid trial" (brief) vs "15-day free trial" (site, Stripe trial) wording | Trust | — | Low | Needs approval |
| 16 | `/check-zip` (60-day demand check) is not in the sitemap | — | Low | Low | Next task, check intent first |
| 17 | Three blog metas at 102-109 chars | — | Low | Low | Next task |
| 18 | Mobile LCP 5.2 s on home (daily health check, Nov 17; before the Nov 25 inline-CSS and poster fixes) | Med | Med | Med | Re-measure after deploy |
| 19 | Lighthouse not runnable here (no Chrome in the build box) | — | — | — | Run PageSpeed on live after deploy |
| 20 | `trial_start` is not a separate event; it is `checkout_started` with the plan | — | — | Low | Next task if GA4 needs it split |

## Performance

| Item | Finding |
|---|---|
| LCP element | Hero poster image (`/assets/hero/hero-poster-v1-*.webp`), `width=1600 height=900`, `fetchpriority=high` |
| LCP preload | Yes: phone and wide renditions preloaded with media queries (`src/components/homepage/HeroVideo.tsx`) |
| Hero video | Not loaded on phones; on desktop only after load + idle, skipped for reduced motion / Data Saver |
| Below-fold images | Every other `<img>` on the homepage is `loading="lazy"` |
| CSS | Inlined (`inlineCss`, PR #250), so no render-blocking stylesheet |
| Fonts | One preloaded woff2 (next/font, `font-display: swap`) |
| Third-party JS | GA4 `lazyOnload`; Clarity tag; YouTube is a click-to-load facade |
| Lighthouse | Not available in this environment. Last field number: mobile LCP 5.2 s (Nov 17), before PR #250 |

## CRO audit (before)

- Desktop hero: video background; left column eyebrow "For licensed mortgage loan officers nationwide",
  H1 "Want more time to close loans? Meet your own AI assistant.", one paragraph about Cerebro, one text
  link "See Cerebro in action"; right column the ZIP code check card ("Check my ZIP code" button).
- Mobile hero: same copy stacked, ZIP code card below it (button reads "Check ZIP" under 640 px).
- First two viewports: one primary action (ZIP code check), one text link (See Cerebro), header "Start free".
  The H1 did not say what the product is or why it differs from shared leads; nothing in the hero said
  the ZIP code is exclusive, that there is a free plan, or when the ZIP code locks.
- ZIP code flow: one field + one button; inline validation ("Enter a valid 5-digit ZIP code."), loading
  skeleton, open/locked result, nearby open ZIP codes when locked, then plan buttons. ZIP code from the URL
  or session is prefilled. It is already one step to an answer, so no flow change was needed.
- Sticky: header is sticky with "Start free"; a sticky ZIP code bar appears once the hero scrolls away,
  and the page reserves bottom padding so it never covers the footer.

## Tracking audit

| Item | Status |
|---|---|
| GA4 | Present (`GA_ID` in `src/app/layout.tsx`, lazy) |
| Microsoft Clarity | Present on public pages (PR #253) |
| Search Console | In use per earlier project work (not re-checked from here); a sitemap resubmit is still on David's list |
| `zip_check` | Present (`track("zip_check")`) |
| `checkout_start` | Present as `checkout_started` (funnel) and `begin_checkout` (GA4) |
| `trial_start` | Not separate; covered by `checkout_started` with `plan`/`checkout` params |
| `demo_watch` | Present as `video_start` (YouTube facade) |
| `calculator_use` | Present as `home_roi_adjust` and calculator events |
| Homepage CTA clicks | `home_cta_click` with a `cta` id (new ids: `hero_start_free`, `objections_check_zip`) |
