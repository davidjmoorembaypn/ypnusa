# Repo map: ypnus.com growth funnel

Stack: Next.js 16 App Router, React 19, Tailwind CSS 4, TypeScript. One app serves the whole of
ypnus.com (WordPress retired Nov 2026). Hosting: AWS EC2 ("ypnus-app", us-east-2); merging to `main`
builds a release that installs itself (see `aws/README.md`). Analytics: GA4 (`src/app/layout.tsx`,
lazy-loaded), Microsoft Clarity (`src/components/analytics/clarity-tag.tsx`), first-party funnel events
(`src/lib/funnel-events.ts`, `src/lib/track.ts`).

## Where SEO is set

| Concern | File |
|---|---|
| Title/meta/canonical/OG/Twitter for every marketing page | `src/lib/seo.ts` (`marketingMetadata`, `pageTitle`, `fitTitle`) |
| Hand-written titles and metas for key pages | `src/lib/seo/page-seo.ts` (`PAGE_SEO`, `TOPIC_SEO`) |
| Meta description length clamp | `src/lib/seo/meta-description.ts` |
| Live title/description/headline overrides set from /admin | `liveSiteOverride` in `src/lib/db.ts`, read by `src/lib/seo.ts` |
| Site-wide Organization, WebSite, Person JSON-LD | `src/app/layout.tsx` |
| Product (SoftwareApplication + Offer per plan), FAQPage helpers | `src/lib/seo.ts` |
| Breadcrumbs (+ BreadcrumbList JSON-LD) | `src/lib/seo/breadcrumbs.ts`, `src/components/breadcrumbs.tsx` |
| Topic clusters, internal linking, indexable post list | `src/lib/seo/clusters.ts` |
| robots.txt | `src/app/robots.ts` |
| Sitemaps | `src/app/sitemap.ts`, `src/app/local-seo-sitemap.xml/` |
| Imported WordPress pages and posts (titles via `seoTitle` / `metaTitle`) | `src/content/wp-import/pages.json`, `posts.json`, route builder `src/lib/wp-page-route.tsx` |
| 404 | `src/app/not-found.tsx` |

## Funnel

| Step | Route | Files |
|---|---|---|
| Homepage | `/` | `src/app/page.tsx`, `src/lib/homepage-copy.ts`, `src/components/homepage/*` |
| Check ZIP code (hero card, pricing hero, sticky bar) | `/`, `/pricing`, `/claim-territory` | `src/components/territory-claim.tsx`, `src/components/homepage/sticky-zip-bar.tsx`, `src/lib/zip-session.ts`, API `src/app/api/territory/check` |
| ZIP demand check (60-day activity) | `/check-zip` | `src/app/check-zip/page.tsx`, `src/components/zip-demand-check.tsx` |
| Pricing | `/pricing` | `src/app/pricing/page.tsx`, plans in `src/lib/pricing.ts`, buttons `src/components/pricing-cta.tsx` |
| Free signup / trial / checkout | Stripe Checkout | `src/lib/checkout.ts` (`FREE_SIGNUP_HREF`, `checkoutUrlForTier`, `payNowUrlForTier`) |
| After payment | `/billing`, `/onboarding`, `/dashboard` | `src/app/billing`, `src/app/onboarding`, `src/app/dashboard` |
| ZIP code ledger (do not touch) | | `src/lib/territory-ledger.ts`, `src/lib/repositories` |

## Content

| Type | Route | Source |
|---|---|---|
| Blog | `/blog/[slug]` | `src/content/blog*.ts`, `src/content/wp-import/posts.json` |
| Comparisons | `/vs/[slug]`, `/compare/[slug]` | `src/content/compare-pages.ts`, `src/components/compare/compare-page.tsx`, imported `vs` pages |
| Topic pillars | `/topics/[slug]` | `src/lib/seo/clusters.ts` |
| Metro / market / ZIP pages (data-driven) | `/markets/*`, `/reports/*`, `/research` | `src/components/metro-*`, `src/components/market-report`, `src/components/local-seo` |
