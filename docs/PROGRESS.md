# YPN USA build progress

Single place for any session (Claude Code, ChatGPT review, a person) to see where the
build stands and resume. Update it with every change that ships.

Last updated: 2026-11-07.

## Live

- Host: AWS EC2 `i-0fc561aea198051bb` (us-east-2), reached with SSM. See `aws/README.md`.
- Live build: `9e13647` (PR #127), installed 2026-11-07 with `scripts/aws-install-release.sh`.
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

## Built, waiting to go live (PR #128)

- Fix: `/onboarding` was redirected to an imported WordPress page, so free signup and
  "Activate Cerebro" never reached the wizard. A test now fails if any redirect covers
  an app route.
- Fix: `/register` now goes to the free-account sign-in (WordPress `lo-signup.html` is
  gone). Demo seed subscriptions never count as live in production.
- Loan officer profile at onboarding: name, NMLS ID, phone, company, headshot.
- Borrower intake asks for the property ZIP code (`?zip=` prefill) and routes the lead:
  officer page (`?lo=`) first, then the paid ZIP code owner, then the house account.
- Hosted page per loan officer at `/lo/[slug]`, shown only with a live paid plan and a
  locked ZIP code.
- Daily backup now also archives `officer-photos/`.
- Checks: `tsc` clean, `eslint src` 0 errors, `npm test` all pass, `npm run build` OK.

## Blockers

- Merging and deploying need David's explicit yes each time.

## Exact next step

1. On David's yes: merge PR #128, wait for release `app-build-<sha7>`, then on the
   server run `scripts/aws-install-release.sh app-build-<sha7>` and
   `bash aws/ops/install-ops.sh` (picks up the photo backup).
2. Smoke-test `/onboarding` (signed in), `/embed/intake?zip=93618`, and a `/lo/...` page
   for a test officer on a throwaway copy, as in the webhook test above.
3. Then: Cerebro-guided Google Business Profile setup (draft profile and step-by-step
   guide first, Google OAuth posting second).
