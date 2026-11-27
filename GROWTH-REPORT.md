# Growth report: ypnus.com (branch `growth-final-2026-11-27`)

## TL;DR

- **What changed:** the homepage hero now leads with the offer (own your ZIP code instead of buying
  shared leads), adds a trust row and a "Start free" link, and a new three-card section answers the
  objections loan officers raise (shared leads, CRM, rates and credit). The homepage FAQ now answers
  "Is YPN USA a lender?". The 404 page points to Check my ZIP code and Pricing. Every one of the 414
  sitemap pages now has a title of 60 characters or fewer (47 were longer), and 12 short meta
  descriptions were rewritten.
- **What improved:** titles over 60 chars 47 → 0 (longest 75 → 60); metas under 110 chars 15 → 3;
  duplicate titles, metas and H1s stay at 0; every page still has one H1, a self canonical, OG and
  Twitter tags and valid JSON-LD. Build, 1,557 tests and lint pass.
- **What needs approval:** the new homepage headline and copy, plus six decisions listed under
  "Top 7 approvals". Nothing is live: this branch is not merged, and merging to `main` installs it on
  the live server within about 10 minutes.

## Definition of Done

| Box | Status |
|---|---|
| Build passes (`npm run build`, 0 errors) | ✅ Passes. `npm test` 1,557/1,557, `npm run lint` clean |
| No duplicate titles/metas/H1s on indexable pages | ✅ 0 / 0 / 0 across 414 URLs |
| Every indexable page: title 50-60, meta 140-160, 1 H1, canonical, OG, valid JSON-LD | ⚠️ PARTIAL. 1 H1, canonical, OG/Twitter and valid JSON-LD: 414/414. Titles ≤ 60: 414/414, but many good titles are under 50 (e.g. "Pricing: …" at 54 is fine; legal pages at 23-29); padding them to 50 would add filler, so they were left. Metas: the repo's tested rule is ≤ 155 (not 160); 3 blog excerpts remain at 102-109 |
| Hero answers Who + What + Why different + Next step in 5 s | ✅ Eyebrow (licensed MLOs) + H1 (own your ZIP code, not shared leads) + subhead (Cerebro 24/7, leads stay yours) + ZIP code check card |
| Homepage + Pricing: one primary CTA per viewport, "Check my ZIP code" | ✅ Homepage hero: the ZIP code check button is the only button; "Start free" and "See Cerebro" are text links. Pricing hero leads with the same ZIP code check. ⚠️ Plan cards on /pricing each keep their own "Start 15-day trial" buttons (that is the purchase step) |
| Sticky header CTA + sticky mobile CTA, not covering forms/footer | ✅ Already present: sticky header ("Start free") and the sticky ZIP code bar after the hero; the page reserves bottom padding so the bar never covers the footer. Header CTA text: see approval 4 |
| LCP image preloaded + width/height; below-fold lazy | ✅ Already present (hero poster preloaded per breakpoint, 1600×900, `fetchpriority=high`; all other homepage images lazy) |
| /GROWTH-REPORT.md with Before/After + approvals | ✅ This file |
| Work on branch `growth-final-[DATE]`, never main | ✅ `growth-final-2026-11-27`, draft PR |
| No compliance disclosure removed or weakened | ✅ Verified on built pages: "not a commitment to lend", "Equal Housing Opportunity", NMLS #787257, CA DRE #01852847, "Exclusivity applies within YPN USA", "not a lender" and the never-quotes-rates line are all still on the homepage and /pricing, and the footer licensing line is unchanged |
| Lighthouse scores | ❌ FAILED: no Chrome in the build environment. Run PageSpeed Insights on the live homepage and /pricing after deploy |

## Before / After: titles and metas

Homepage H1 before: "Want more time to close loans? Meet your own AI assistant."
Homepage H1 after: "Own your ZIP code instead of buying shared leads. Cerebro answers your borrowers 24/7."
No other H1 changed.

| Page | Old title (chars) | New title (chars) | Old meta (chars) | New meta (chars) |
|---|---|---|---|---|
| /accessibility-statement | Accessibility Statement \| YPN USA (33) | unchanged | 64 | YPN Inc.'s accessibility statement for ypnus.com: our commitment, the work still under way, third-party content, and how to report a barrier on any page. (153) |
| /atlanta-ga-mortgage-loan-officer | Mortgage Loan Officer in Atlanta, GA — Exclusive Leads with YPN USA (67) | Atlanta, GA Loan Officers: Exclusive ZIP Code Leads (51) | unchanged | unchanged |
| /blog/20-google-business-profile-post-ideas-for-loan-officers | 20 Google Business Profile Post Ideas for Loan Officers \| YPN USA (65) | 20 Google Business Profile Post Ideas for Loan Officers (55) | unchanged | unchanged |
| /blog/financing-the-missing-middle-townhomes-and-duplexes | Financing the Missing Middle: Townhomes and Duplexes \| YPN USA (62) | Financing the Missing Middle: Townhomes and Duplexes (52) | unchanged | unchanged |
| /blog/how-many-mortgage-loan-officers-are-there | How Many Mortgage Loan Officers Are in the U.S.? (2026) \| YPN USA (65) | How Many Mortgage Loan Officers Are in the U.S.? (2026) (55) | unchanged | unchanged |
| /blog/how-mlos-can-track-60-day-homebuyer-demand-by-zip-code | How MLOs Can Track 60-Day Homebuyer Demand by ZIP Code \| YPN USA (64) | How MLOs Can Track 60-Day Homebuyer Demand by ZIP Code (54) | unchanged | unchanged |
| /blog/how-often-should-a-loan-officer-post-on-social-media | How Often Should a Loan Officer Post on Social Media? \| YPN USA (63) | How Often Should a Loan Officer Post on Social Media? (53) | unchanged | unchanged |
| /blog/how-to-build-a-mortgage-lead-capture-page-no-designer-needed | How to Build a Mortgage Lead Capture Page (No Designer Needed) (62) | How to Build a Mortgage Lead Capture Page Without a Designer (60) | unchanged | unchanged |
| /blog/how-to-get-realtor-referrals | How to Get Realtor Referrals in 2026: A 7-Step System \| YPN USA (63) | How to Get Realtor Referrals in 2026: A 7-Step System (53) | unchanged | unchanged |
| /blog/how-to-look-up-a-loan-officers-production | How to Look Up a Loan Officer's Production or Volume \| YPN USA (62) | How to Look Up a Loan Officer's Production or Volume (52) | unchanged | unchanged |
| /blog/how-to-stand-out-as-a-loan-officer-in-a-slow-market | How to Stand Out as a Loan Officer in a Slow Market \| YPN USA (61) | How to Stand Out as a Loan Officer in a Slow Market (51) | unchanged | unchanged |
| /blog/is-buying-mortgage-leads-worth-it | Is Buying Mortgage Leads Worth It? \| Loan Officer Math \| YPN USA (64) | Is Buying Mortgage Leads Worth It? \| Loan Officer Math (54) | unchanged | unchanged |
| /blog/linkedin-for-loan-officers-how-to-build-referral-partnerships | LinkedIn for Loan Officers: How to Build Referral Partnerships (62) | LinkedIn for Loan Officers: Build Referral Partnerships (55) | unchanged | unchanged |
| /blog/maximizing-mortgage-loan-success-with-innovative-tools-2 | Maximizing Mortgage Loan Success with Innovative Tools \| YPN USA (64) | Maximizing Mortgage Loan Success with Innovative Tools (54) | unchanged | unchanged |
| /blog/mortgage-lead-sources-by-loan-type | Best Mortgage Lead Sources by Loan Type (FHA, VA, DSCR) \| YPN USA (65) | Best Mortgage Lead Sources by Loan Type (FHA, VA, DSCR) (55) | unchanged | unchanged |
| /blog/stop-waiting-on-realtors-mlo-owned-demand | Stop Waiting on Realtors: How MLOs Build Owned Mortgage Demand (62) | Stop Waiting on Realtors: How MLOs Build Owned Demand (53) | unchanged | unchanged |
| /blog/va-loan-fresno-ca-zero-down-payment | VA Loan Fresno, CA \| Zero Down Payment for Veterans \| YPN USA (61) | VA Loan Fresno, CA \| Zero Down Payment for Veterans (51) | unchanged | unchanged |
| /blog/what-ai-lead-follow-up-should-do-before-handoff | What AI Follow-Up Should Do Before a Loan Officer Handoff \| YPN USA (67) | What AI Follow-Up Should Do Before a Loan Officer Handoff (57) | unchanged | unchanged |
| /blog/what-to-check-before-buying-mortgage-leads-in-a-zip-code | What to Check Before Paying for Mortgage Leads in a ZIP Code \| YPN USA (70) | What to Check Before Paying for Mortgage Leads in a ZIP Code (60) | unchanged | unchanged |
| /contact | Contact \| YPN USA (17) | Contact YPN USA: Questions About ZIP Codes & Cerebro (52) | unchanged | unchanged |
| /dallas-tx-mortgage-loan-officer | Mortgage Loan Officer in Dallas, TX — Exclusive Leads with YPN USA (66) | Dallas, TX Loan Officers: Exclusive ZIP Code Leads \| YPN USA (60) | unchanged | unchanged |
| /features/ai-lead-follow-up | AI Lead Follow-Up \| YPN USA (27) | AI Lead Follow-Up for Mortgage Loan Officers \| YPN USA (54) | unchanged | unchanged |
| /features/analytics-dashboard | Analytics Dashboard \| YPN USA (29) | Lead Analytics Dashboard for Loan Officers \| YPN USA (52) | unchanged | unchanged |
| /features/niche-lead-magnets | Niche Lead Magnets \| YPN USA (28) | Niche Mortgage Lead Magnets for Loan Officers \| YPN USA (55) | unchanged | unchanged |
| /houston-tx-mortgage-loan-officer | Mortgage Loan Officer in Houston, TX — Exclusive Leads with YPN USA (67) | Houston, TX Loan Officers: Exclusive ZIP Code Leads (51) | unchanged | unchanged |
| /licensing-disclosures | Licensing & Disclosures \| YPN USA (33) | unchanged | 84 | NMLS #787257 and California DRE #01852847 licensing, Equal Housing Opportunity and fair lending disclosures for YPN Inc. and the YPN USA platform. (146) |
| /loan-types | Loan Type Leads for Loan Officers: FHA, VA, DSCR, Jumbo & Refinance (67) | Loan Type Leads for Loan Officers: FHA, VA, DSCR & Jumbo (56) | 105 | Mortgage leads by loan type for loan officers: FHA, VA, DSCR, jumbo, HELOC and refinance guides, each paired with an exclusive ZIP code and Cerebro. (148) |
| /loan-types/conventional-loan-leads | Conventional Loan Leads for MLOs \| YPN USA (42) | unchanged | 107 | Conventional loan leads for loan officers: hold an exclusive ZIP code, get a local page, and let Cerebro answer and qualify buyers and refinancers 24/7. (152) |
| /loan-types/dscr-loan-leads | DSCR Loan Leads — Investment Property MLO \| YPN USA (51) | unchanged | 99 | DSCR loan leads for loan officers: hold an exclusive ZIP code, reach local real estate investors, and let Cerebro qualify rental property inquiries 24/7. (153) |
| /loan-types/fha-loan-leads | FHA Loan Leads for Mortgage Loan Officers \| YPN USA (51) | unchanged | 98 | FHA loan leads for loan officers: hold an exclusive ZIP code, get a local page for first-time buyers, and let Cerebro answer FHA questions 24/7. (144) |
| /loan-types/jumbo-loan-leads | Jumbo Loan Leads for Mortgage Loan Officers \| YPN USA (53) | unchanged | 104 | Jumbo loan leads for loan officers: hold an exclusive ZIP code in a high-price market and let Cerebro answer and qualify jumbo borrowers 24/7. (142) |
| /loan-types/probate-inherited-property-leads | Probate & Inherited Property Leads for Loan Officers \| YPN USA (62) | Probate & Inherited Property Leads for Loan Officers (52) | unchanged | unchanged |
| /loan-types/va-loan-leads | VA Loan Leads for Mortgage Loan Officers \| YPN USA (50) | unchanged | 97 | VA loan leads for loan officers: hold an exclusive ZIP code, get a local page for veteran buyers, and let Cerebro answer VA loan questions 24/7. (144) |
| /markets | Mortgage Markets for Loan Officers \| Exclusive Local Demand (59) | unchanged | 100 | Mortgage markets for loan officers: pick a metro, check which ZIP codes are open for free, and own local borrower demand under your own name. (141) |
| /markets/boston-ma | Boston, MA Mortgage Leads & Marketing for Loan Officers \| YPN USA (65) | Boston, MA Mortgage Leads & Marketing for Loan Officers (55) | unchanged | unchanged |
| /markets/grand-rapids-mi | Grand Rapids, MI Mortgage Leads & Marketing for Loan Officers (61) | Grand Rapids, MI Mortgage Leads & Loan Officer Marketing (56) | unchanged | unchanged |
| /markets/toledo-oh | Toledo, OH Mortgage Leads & Marketing for Loan Officers \| YPN USA (65) | Toledo, OH Mortgage Leads & Marketing for Loan Officers (55) | unchanged | unchanged |
| /markets/winston-salem-nc | Winston-Salem, NC Mortgage Leads & Marketing for Loan Officers (62) | Winston-Salem, NC Mortgage Leads & Loan Officer Marketing (57) | unchanged | unchanged |
| /mlo-growth-engine | MLO Growth Engine: Exclusive ZIP Code Territory for Loan Officers (65) | MLO Growth Engine: Exclusive ZIP Codes for Loan Officers (56) | unchanged | unchanged |
| /mlo-marketing | MLO Marketing Hub — Exclusive Mortgage Lead Generation Guides (61) | MLO Marketing Hub: Mortgage Lead Generation Guides \| YPN USA (60) | unchanged | unchanged |
| /mlo-marketing/mortgage-lead-generation-for-loan-officers-the-complete-guide | Mortgage Lead Generation for Loan Officers — The Complete Guide (63) | Mortgage Lead Generation for Loan Officers: Complete Guide (58) | unchanged | unchanged |
| /mortgage-loans/bank-statement | Bank Statement Loans for Self-Employed Borrowers · Mortgage Loans · YPN USA (75) | Bank Statement Loans for Self-Employed Borrowers \| YPN USA (58) | unchanged | unchanged |
| /mortgage-loans/life-events/downsizing-in-retirement | Mortgage in Retirement: Social Security and Pensions \| YPN USA (62) | Mortgage in Retirement: Social Security and Pensions (52) | unchanged | unchanged |
| /mortgage-loans/life-events/getting-married | Buying a House as a Couple: Credit Scores and Gifts \| YPN USA (61) | Buying a House as a Couple: Credit Scores and Gifts (51) | unchanged | unchanged |
| /mortgage-loans/life-events/growing-family | Buying a Bigger Home: Parental Leave and Two Mortgages \| YPN USA (64) | Buying a Bigger Home: Parental Leave and Two Mortgages (54) | unchanged | unchanged |
| /mortgage-loans/life-events/inherited-home | Inherited a House With a Mortgage? Your Loan Options \| YPN USA (62) | Inherited a House With a Mortgage? Your Loan Options (52) | unchanged | unchanged |
| /mortgage-loans/life-events/relocating-for-work | Mortgage With a Job Offer Letter: Relocating for Work \| YPN USA (63) | Mortgage With a Job Offer Letter: Relocating for Work (53) | unchanged | unchanged |
| /mortgage-payment-calculator | Mortgage Payment Calculator \| Free Monthly Payment Estimator — YPN USA (70) | Mortgage Payment Calculator \| Free Monthly Payment Estimator (60) | unchanged | unchanged |
| /platform/lead-intelligence | Lead Intelligence: AI Lead Scoring for Loan Officers \| YPN USA (62) | Lead Intelligence: AI Lead Scoring for Loan Officers (52) | unchanged | unchanged |
| /platform/mortgage-pos-intake | A Digital Front Door for Every Borrower Conversation \| YPN USA (62) | A Digital Front Door for Every Borrower Conversation (52) | unchanged | unchanged |
| /predictive-lead-gen | Predictive Lead Gen for Loan Officers \| Owned Demand + AI Intake (64) | Predictive Lead Gen for Loan Officers: Owned Demand + AI (56) | unchanged | unchanged |
| /privacy-policy | Privacy Policy \| YPN USA (24) | unchanged | 104 | How YPN Inc. collects, uses, shares and protects information on ypnus.com and the YPN USA platform, your privacy rights, and text message preferences. (150) |
| /rate-sheets | Rate sheet and lock desk directory for loan officers \| YPN USA (62) | Rate sheet and lock desk directory for loan officers (52) | unchanged | unchanged |
| /research | Central Valley Mortgage Market Report 2024 for Loan Officers \| YPN USA (70) | Central Valley Mortgage Market Report 2024 for Loan Officers (60) | unchanged | unchanged |
| /self-employed-mortgage | Self-Employed Mortgage Options in California's Central Valley (61) | Self-Employed Mortgage Options in the Central Valley, CA (56) | unchanged | unchanged |
| /self-employed-mortgage/san-joaquin-county-ca | Bank Statement and DSCR Loans in San Joaquin County, CA \| YPN USA (65) | Bank Statement and DSCR Loans in San Joaquin County, CA (55) | unchanged | unchanged |
| /self-employed-mortgage/stanislaus-county-ca | Bank Statement and DSCR Loans in Stanislaus County, CA \| YPN USA (64) | Bank Statement and DSCR Loans in Stanislaus County, CA (54) | unchanged | unchanged |
| /tampa-fl-mortgage-loan-officer | Mortgage Loan Officer in Tampa, FL — Exclusive Leads with YPN USA (65) | Tampa, FL Loan Officers: Exclusive ZIP Code Leads \| YPN USA (59) | unchanged | unchanged |
| /terms-of-service | Terms of Service \| YPN USA (26) | unchanged | 68 | The terms of service for ypnus.com and the YPN USA platform: accounts, subscriptions and free trials, cancellation, acceptable use, AI and SMS terms. (149) |
| /territory/phoenix-az-mortgage-loan-officer | Mortgage Loan Officer in Phoenix, AZ — Exclusive Leads with YPN USA (67) | Phoenix, AZ Loan Officers: Exclusive ZIP Code Leads (51) | unchanged | unchanged |
| /tools/equity | Home Equity Snapshot \| YPN USA (30) | unchanged | 99 | Free home equity calculator: estimate equity, loan-to-value and an illustrative cash-out ceiling from values you enter. A starting point, not a loan offer. (155) |
| /vs/zillow-flex | YPN USA vs Zillow Flex: What Loan Officers Should Know (2026) (61) | YPN USA vs Zillow Flex: What Loan Officers Should Know (54) | unchanged | unchanged |

Full per-page data for all 414 URLs: `GROWTH-AUDIT-PAGES.csv`.

## File-by-file changes

| File | Change |
|---|---|
| `src/lib/homepage-copy.ts` | Coded H1 sentence → "Own your ZIP code instead of buying shared leads." |
| `src/app/page.tsx` | Hero: violet H1 sentence, new subhead, trust row (3 items), "Start free, no card required" link; new "Before you check your ZIP code" section with 3 objection cards and one "Check my ZIP code" button; FAQ "Is YPN USA a lender?" (also in FAQPage JSON-LD) |
| `src/app/not-found.tsx` | 404 buttons: Check my ZIP code (`/claim-territory`), See pricing, Back to YPN USA; dashboard link demoted to a text line |
| `src/lib/seo.ts` | New `fitTitle()`; `pageTitle()` adds the " \| YPN USA" suffix only when the result stays ≤ 60 and drops a trailing brand that alone overflows; social titles use the same rule |
| `src/lib/seo.test.ts` | Tests for both rules |
| `src/app/blog/[slug]/page.tsx` | `metaTitle` goes through the same 60-char rule |
| `src/content/wp-import/pages.json` | `seoTitle` for 17 imported pages; `description` for 7 loan-type/hub pages |
| `src/content/wp-import/posts.json` | `metaTitle` for 3 posts |
| `src/app/mortgage-loans/bank-statement/page.tsx` | Absolute title (the section template made it 75 chars) |
| `src/content/self-employed-loans.ts` | Hub `metaTitle` shortened to 57 chars |
| `src/app/{accessibility-statement,terms-of-service,privacy-policy,licensing-disclosures,tools/equity}/page.tsx` | Meta descriptions only (named app.ypnus.com, 64-104 chars); page copy untouched |
| `REPO-MAP.md`, `GROWTH-AUDIT.md`, `GROWTH-AUDIT-PAGES.csv`, `GROWTH-REPORT.md`, `SELF-REVIEW.md`, `content-drafts/` | Docs only; not served by the site |

## CRO: before / after and why

| Area | Before | After | Why |
|---|---|---|---|
| H1 | "Want more time to close loans? Meet your own AI assistant." | "Own your ZIP code instead of buying shared leads. Cerebro answers your borrowers 24/7." | The old H1 did not say what YPN USA sells or how it differs; the ZIP code is the reason to act now |
| Subhead | Cerebro answers 24/7, captures details, drafts follow-up | Cerebro answers and qualifies day and night, hands ready borrowers to you; leads stay yours if you switch brokerages | Adds the lead-ownership point from the FAQ, which shared-lead buyers care about |
| Trust row | none | 1 loan officer per ZIP code within YPN USA · 15-day free trial on paid plans · ZIP code locks at your first payment (on phones it sits under the ZIP code card, so the card stays near the top) | States the terms before the visitor types a ZIP code; all three are existing /pricing terms |
| Secondary CTA | none in hero (header only) | "Start free, no card required" text link | Gives non-ready visitors a next step without competing with the ZIP code button |
| Objections | spread across the page | 3 cards right after "How it works", one "Check my ZIP code" button | Answers shared leads / CRM / rates-and-credit before the ask |
| FAQ | no lender question | "Is YPN USA a lender?" | Compliance clarity and an AI-answer target |
| 404 | "Back to YPN USA" + "Go to dashboard" | Check my ZIP code, See pricing, Back to YPN USA | Lost visitors were sent to a sign-in wall |

Not changed: ZIP code check flow (already one field, one button, inline errors, loading state, nearby open
ZIP codes, prefill from URL/session, 48 px+ targets); pricing page (Pro already "Most popular", 10-question
FAQ, ZIP code check at the top, Free plan explained); hero video (David asked to keep it).

## Performance: before / after

No performance regressions: the new hero row and objection section are static server-rendered HTML with
no images and no new JavaScript. The LCP element (hero poster) is unchanged and still preloaded with
width/height. Lighthouse could not run here (see Definition of Done). Last measured field value: mobile
LCP 5.2 s on Nov 17, before the Nov 25 inline-CSS change; re-measure on live after deploy.

## What I did not change, and why

- **Pricing, trial terms, plan features, ZIP code locking rules, refund policy, legal page body copy:** hard rule.
- **ZIP code availability logic, checkout, Stripe, database, .env, production config:** hard rule.
- **Five new articles:** all five topics are already published at 2,400-4,250 words. New pages would
  compete with them for the same keywords. See `content-drafts/README.md`.
- **Comparison pages:** each already opens with a plain-language intro, a sourced side-by-side, an FAQ
  with schema, a "not a lender" note and related links. Adding verdicts about competitors needs sourced
  facts I could not check today.
- **robots.txt:** already blocks `/api/`, `/admin/`, `/dashboard/`, `/embed/`, `/analytics`; there is
  no `/checkout` route (Stripe hosts it). I did not add `?utm_` blocking: every page has a
  self-canonical, and blocking crawl hides that canonical from Google.
- **Header CTA, trial wording, 301 merges:** decisions for David (approvals below).
- **Brand, logo, colors, fonts; hero video:** untouched.
- **New trackers:** none added.

## Top 7 approvals needed before deploy

1. **Homepage headline.** Before: "Want more time to close loans? Meet your own AI assistant." After:
   "Own your ZIP code instead of buying shared leads. Cerebro answers your borrowers 24/7."
   If a headline was set from /admin, that live override still wins over the coded one.
2. **Homepage subhead and trust row** (exact copy): "Cerebro, your AI assistant, answers and qualifies
   borrowers day and night and hands the ready ones to you. Leads stay yours, even if you switch
   brokerages." · "1 loan officer per ZIP code within YPN USA" · "15-day free
   trial on paid plans" · "ZIP code locks at your first payment".
3. **Objection card "Works with your CRM":** "On paid plans, new leads can go to your CRM through Zapier
   or any webhook, and every borrower Cerebro captures for you is yours to export." Based on
   `/portal/crm` and the Pro plan's "CRM mirroring" line. Confirm it is live for paying customers.
4. **Header button:** keep "Start free", or change it to "Check my ZIP code" site-wide (the brief's
   primary CTA). Not changed.
5. **Trial wording:** the brief says "15-day paid trial"; the site, Stripe trial and terms say "15-day
   free trial" (card charged after day 15). Kept the site's wording. Confirm which is right.
6. **Two 301 merges:** `/blog/exclusive-zip-territory-vs-shared-mortgage-leads` →
   `/topics/exclusive-mortgage-leads`; `/blog/how-mlos-capture-exclusive-ai-mortgage-leads` →
   `/blog/where-to-get-exclusive-mortgage-leads`. Not done.
7. **Imported WordPress claims:** remove or source "65%–82%" contact rates and similar numbers in
   imported posts, the "The average loan officer takes 47…" line on `/features/ai-lead-follow-up`, and fix
   a cost table whose "$" signs were lost on import (",500 – ,000+"). Not changed: they need your call or a
   source.

## Blockers and TODOs for David

- Testimonials or reviews: none in the repo, so none were added. Real ones with permission would help most.
- Google Business Profile: still unclaimed; sitemap resubmit in Search Console still yours.
- Real photos of you or your office for the About page and local pages, if you have them.
- The award you mentioned on Nov 17 is not on the site yet.

## Next 10 tasks

1. Approve or edit the 7 items above, then merge (one go-live).
2. Run PageSpeed Insights on live home and /pricing; record scores.
3. Do the two 301 merges if approved.
4. Clean the unsourced figures and broken "$" table in imported posts.
5. Rewrite the 3 short blog metas (102-109 chars).
6. Decide whether `/check-zip` belongs in the sitemap.
7. Refresh the mortgage lead cost post with dated sources.
8. Add a "How YPN USA sends leads to your CRM" section to `/best-crm-for-loan-officers`.
9. Split `trial_start` from `checkout_started` in GA4 if you want trial and pay-now counted apart.
10. A/B the new hero against the old one for two weeks (the old H1 can be restored from /admin).

## PR description

See the pull request on GitHub; it mirrors this TL;DR and the approvals list.
