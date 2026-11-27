# Adversarial self-review (branch `growth-final-2026-11-27`)

## 1. Compliance

- **Removed or weakened a disclosure?** No. Searched the built HTML of `/` and `/pricing` after the
  changes; all of these are still present on both:
  - "Marketing technology only — not a commitment to lend" (footer)
  - "Equal Housing Opportunity", "NMLS #787257", "California DRE #01852847" (footer and founder card)
  - "Exclusivity applies within YPN USA; other lenders can still market in your area" (homepage FAQ,
    comparison note, and now the "Not shared leads" card)
  - "What Cerebro never does: Offer or lock rates · Make credit decisions…" (homepage guardrails, unchanged)
  - "Cerebro never quotes rates or makes credit decisions" (pricing FAQ, unchanged)
  - "not a lender" (new homepage FAQ answer; compare and metro pages unchanged)
- **Added a guarantee or lender claim?** No. The new FAQ says YPN USA is *not* a lender. No lead, loan
  or ranking promise was added. The pricing FAQ "Are leads or loans guaranteed? No." is unchanged.
- **Found and fixed during review:** my first draft of the lender FAQ said YPN USA "does not take loan
  applications". The site has borrower intake pages, so that wording could read as contradicting them;
  it now uses only the compare page's existing wording plus "not a commitment to lend".

## 2. CRO

- **Two competing CTAs in one viewport?** Homepage hero: one button (Check my ZIP code, in the card) and
  two text links. The sticky header's amber "Start free" button is also visible, as before this branch;
  that is approval 4 in the report. The new objection section has one button. Pricing plan cards keep
  their per-plan buttons, which are the purchase step itself.
- **Primary CTA visible on mobile without scrolling?** My first version added the trust row and links
  above the ZIP code card, which by line-count estimate pushed the card's input below the fold on a
  375 × 667 phone (about 680 px of copy before the card, against about 510 px before the branch).
  **Fixed:** the trust row and links now sit after the card on phones (CSS grid order, one copy in the
  DOM) and under the copy on desktop, and the subhead and violet H1 sentence were shortened. Estimated
  card top on a 375 px phone is back to about where it was before. Not verified in a real browser: no
  Chrome in this environment. Check on a phone before approving.

## 3. SEO

- **Duplicate title/meta/H1?** None: 0 / 0 / 0 across 414 sitemap URLs after the change.
- **Keyword stuffing?** The H1 uses "ZIP code" and "shared leads" once each; the meta and title of the
  homepage were not changed. New loan-type metas each name the loan type once.
- **Thin page created?** No new pages. Five requested articles were deliberately not written because
  the topics are already live at 2,400-4,250 words (see `content-drafts/README.md`).
- **Risk in the central title change:** titles of 51-55 characters no longer get " | YPN USA" appended
  (it pushed them to 61-65). The brand still shows as the site name in Google. Two tests cover it.

## 4. Performance

- No new JavaScript, images, fonts or third-party scripts. The new markup is server-rendered text.
- The LCP image (hero poster) and its preload are unchanged.
- The hero grid now has a second row on desktop; the ZIP code card spans both rows and is centered, so
  no layout shift is introduced (all content is in the first HTML response).
- Lighthouse not run (no Chrome here). Recorded as FAILED in the report.

## 5. Truth: every claim added, and its source

| Claim added | Where | Source in repo |
|---|---|---|
| "Own your ZIP code instead of buying shared leads." | H1 | Offer: `src/lib/pricing.ts` (1 included exclusive ZIP code), homepage comparison table |
| Cerebro answers and qualifies borrowers day and night and hands the ready ones to you | Hero subhead | Homepage `CEREBRO_TODAY` list and FAQ "What is Cerebro?" |
| Leads stay yours, even if you switch brokerages | Hero subhead | Homepage FAQ "Do I keep my leads if I switch brokerages?" |
| 1 loan officer per ZIP code within YPN USA | Trust row | Homepage ZIP code section, pricing FAQ |
| 15-day free trial on paid plans | Trust row | `src/lib/pricing.ts` features, pricing FAQ |
| ZIP code locks at your first payment | Trust row | Pricing FAQ, ZIP code card note |
| Inquiries route to you; you never compete with another YPN USA lender for them | "Not shared leads" card | Homepage FAQ "How does the exclusive ZIP code territory model work?" |
| On paid plans, new leads can go to your CRM through Zapier or any webhook; captures are yours to export | "Works with your CRM" card | `src/app/portal/crm/page.tsx`, Pro feature "Calendar booking + CRM mirroring", pricing FAQ "Do I keep my leads if I cancel?" |
| Cerebro never quotes or locks rates or makes credit decisions; follows up with borrowers who agreed to be contacted | Third card | Homepage guardrails list, How it works step 3 |
| YPN USA is not a lender, does not quote or lock rates or make credit decisions; not a commitment to lend | FAQ | `src/components/compare/compare-page.tsx`, footer |
| Loan-type and hub meta descriptions (FHA, VA, DSCR, jumbo, conventional, loan types, markets) | Meta tags | The pages' own content: exclusive ZIP code, local page, Cerebro |
| Legal page meta descriptions | Meta tags | The pages' own section headings |

No testimonial, statistic, review, lead count, rating or ZIP code availability was added anywhere.
