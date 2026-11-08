# YPN USA build progress

Single place for any session (Claude Code, ChatGPT review, a person) to see where the
build stands and resume. Update it with every change that ships.

Last updated: 2026-11-08.

## Live

- Host: AWS EC2 `i-0fc561aea198051bb` (us-east-2), reached with SSM. See `aws/README.md`.
- Live build: `62124e8` (PR #128), installed 2026-11-08 by David with `scripts/aws-install-release.sh`.
- Plans (fixed, match Stripe): Pro $99/mo, Growth $199/mo, Exclusive $299/mo
  (internal tier ids `growth`, `pro`, `elite`). 15-day trial. One included ZIP code per
  paid plan. 5-year prepaid: $3,999 / $7,999 / $11,999, full refund within 30 days.
- ZIP code rule: a ZIP code locks only when the first real payment succeeds (trial
  never locks). Free accounts never lock a ZIP code or receive live leads. Exclusivity
  is described as exclusive within YPN USA.

## Verified working (2026-11-07, on the live server)

- Pages through Apache: `/`, `/pricing`, `/about`, `/check-zip`, `/claim-territory`,
  `/login`, terms, refund policy, sitemap, robots, `/api/health` all return 200.
  `/dashboard` redirects to sign-in when signed out.
- Pricing page shows pay-now buttons, 5-year plans and the payback calculator. Home
  shows the explainer video, book and "25+ years". Canonical is `https://ypnus.com`.
- Stripe webhook, using signed simulated events against a throwaway copy of the live
  build with a temp data dir (no real charges, no emails):
  - trial checkout: no ZIP code lock (pending only)
  - first $99 invoice: ZIP code locks
  - pay-now checkout: locks immediately
  - second buyer of a locked ZIP code: conflict recorded, no lock
  - 5-year checkout locks with a 2031 expiry; full refund cancels and releases it
  - forged signature: 400
  - metadata `ypnus_tier=pro` + `pricing=2026-11` maps to the $99 Pro plan

## Not yet verified

- A real card payment end to end (Stripe live checkout to dashboard).
- Sign-in email delivery through Resend after this release.
- Lead alert email to the ZIP code owner or house inbox.
- A live Cerebro reply on the dashboard.
- A real Stripe cancellation (`customer.subscription.deleted`) from the Stripe side.
- Browser console check on the new onboarding, intake and `/lo/[slug]` pages.

## Built, waiting to go live (optimization release)

- Hero: poster and videos served from this app (`public/assets/hero`). Videos re-encoded
  to about half size; phones get the poster only. Video starts after load and idle.
- 148 WordPress images rehosted in `public/media/uploads` (manifest with sizes in
  `src/content/wp-import/media-manifest.json`), lazy-loaded with width/height.
- Internal links in imported pages resolve to their final URL (posts under /blog, no
  redirect hops, no .html). Local crawl of 330 sitemap pages: 0 broken internal links.
- Floating Cerebro widget loads after the page is idle. Root `loading.tsx` moved to
  `/dashboard` so marketing pages aren't wrapped in a streaming fallback.
- Contrast fixes, WebPage JSON-LD on home, book block with Kindle $9.99 / Kindle Unlimited.
- Lighthouse, local production build, mobile: home 84 -> 91 (2.4 MB -> 371 KB, LCP
  3.8 s -> 3.2 s simulated; observed paint about 0.2 s), desktop 100. About 95, pricing 93,
  check-zip 95. Accessibility and SEO 100 on all public pages checked.

## Blockers

- Merging and deploying need David's explicit yes each time.

## Exact next step

1. On David's yes: merge the optimization PR, wait for release `app-build-<sha7>`, then on the
   server run `scripts/aws-install-release.sh app-build-<sha7>` and
   `bash aws/ops/install-ops.sh` (picks up the photo backup).
2. Smoke-test `/onboarding` (signed in), `/embed/intake?zip=93618`, and a `/lo/...` page
   for a test officer on a throwaway copy, as in the webhook test above.
3. Then: Cerebro-guided Google Business Profile setup (draft profile and step-by-step
   guide first, Google OAuth posting second).
