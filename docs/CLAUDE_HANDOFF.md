# Handoff — AWS consolidation + first 3 paying customers

Written 2026-10-23. No secrets or customer data in this file.
Branch `claude/sleepy-cray-ehu9r8`, code commit `fd52c74` (on top of `main` `41bb240`). Nothing merged, deployed, or changed in
production, DNS, Stripe or WordPress. The server still runs build `8a64872`.


## UPDATE 2026-10-23 — Stripe change made (owner-approved, verified)
The owner approved: "require a card on the 3 stripe links". Done and read back from Stripe (live): the Growth, Pro and Elite
Payment Links used by ypnus.com/pricing.html now have `payment_method_collection: always` (was `if_required`, i.e. NO card at
trial signup). IDs: `plink_1UJ3V9BuaeDJIFLwyKgLnn5T` (growth), `plink_1UJ3VBBuaeDJIFLwnJyHsO2a` (pro),
`plink_1UJ3VCBuaeDJIFLwMowhffxL` (elite). URLs, 15-day trial, `ypnus_tier` metadata unchanged. Undo = set the same field back to
`if_required`. Older duplicate tier links (plink_1UDlW*/1UDlU*) were NOT changed and are not used by the pricing page.
Evidence it was needed: lo-signup.html is a free no-card signup (never touches Stripe); both historical trial subscriptions ended
`paused` / `trial_end_without_payment_method`.
Expectation: a trial started today is first charged 15 days later, so verified payments cannot appear before ~15 days after the
first real signups. Still 0 of 3 verified conversions. Steps 4(a)/5 in the approval list above are no longer needed for the
existing site; step 4(b) (native webhook endpoint) is still needed for `/api/revenue/conversions` to see payments.
Growth outreach drafts (PR #110 tool) are prepared but NOT approved or sent; recommended to send only after this fix (now done).

## Objective status: 0 of 3 verified paid conversions
Stripe (live, read-only check): the account has had **2 subscriptions ever, both `paused`** (card-less trial ended with no
payment method). **No live payment has ever succeeded for a YPN USA subscription.** Nothing here may be reported as a
conversion until `GET /api/revenue/conversions` (see below) shows it.

## Root causes found in the revenue journey
1. The tiered Payment Links (growth/pro/elite, `ypnus_tier` set) have a **15-day trial with the card NOT required**
   (`payment_method_collection: if_required`). A signup is a trial start, not a payment, and the first charge is >= 15 days away.
2. Pricing CTAs go to `ypnus.com/lo-signup.html`, a **free, no-card** signup. Free signups do not count.
3. The Next app has **no live Stripe webhook endpoint** (both `app.ypnus.com/api/...` endpoints in Stripe are disabled). Only
   WordPress hears payments; paid access reaches the app only through WordPress's signed SSO claim.
4. Follow-ups were marked "sent" through a `demo` provider when no email/SMS provider is configured (fixed in code).

## Completed and verified (all on this branch)
| Change | Verification |
| --- | --- |
| Paid-conversion ledger `src/lib/conversions.ts` + `GET /api/revenue/conversions`: counts only live, paid (> $0), subscription invoices, deduped by invoice/event, **and** fulfilled (active) in the app; excludes test mode, $0 trials, duplicates, existing customers (`CONVERSION_EXCLUDE_CUSTOMERS`) and payments before `CONVERSION_COUNT_FROM` | 5 new tests pass; endpoint returns 401 unauthenticated (smoke test) |
| Stripe webhook returns 500 on internal failure (Stripe retries); handles `invoice.paid` | route tests pass |
| Store durability: fsync, rolling `store.json.bak`, corrupt file quarantined + restored (was: next write overwrote it) | 3 new tests pass |
| Follow-ups: Resend delivery; production never marks an undelivered follow-up "sent" | 3 new tests pass |
| Homepage hero video restored on the Next homepage (same files as WordPress; lazy, reduced-motion safe) | 2 tests; video element present in built HTML |
| `aws/ops`: hourly backup + restore, 5-min follow-up scheduler, read-only preflight, installer | backup script run against a scratch store: writes, checksums, refuses a corrupt store, prints no secrets. Restore/timers not run (need the server) |
| `scripts/aws-install-release.sh`: pre-deploy backup, health gate = new commit + non-degraded storage + `/`, `/pricing`, `/sitemap.xml` = 200, auto rollback | syntax-checked only; run on the server for the first time at deploy |
| `aws/apache` ypnus.com front door (WordPress keeps login/SSO/signup/Stripe webhook/ZIP ledger/uploads/hero media; app serves the rest; www->apex; http->https; ACME) | Real Apache run with fake origins: all routes correct, Stripe signature header + body arrive intact, origin TLS chain verified, sitemap 301s |
| `release-build.yml`: optional `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_{GROWTH,PRO,ELITE}` from repo variables | inert while unset |
| Lint error on `main` fixed | `npm run lint` clean |

Full checks on this branch: `npm run lint` clean, `tsc --noEmit` clean, `npm test` **414/414 pass**, `npm run build` succeeds,
built app smoke-tested (health OK, `/pricing` 200, hero video present).

## NOT verified / known gaps (do not claim otherwise)
- **AWS host never inspected**: AWS access (the AWS connector) needed re-login. Unknown: which env vars are set, whether any
  scheduler calls `/api/automation/process`, `NODE_ENV` in the unit, store counts. Run `aws/ops/ypnusa-preflight.sh` first.
- Real Stripe events have not hit the new `invoice.paid` code (no endpoint yet). Stripe `invoice` payload shape handled for
  both `parent.subscription_details` and legacy `subscription`; confirm with a real event.
- The Hostinger WordPress origin IP and its acceptance of requests from the AWS IP are unknown (front door needs both).
- WordPress is still the system of record for access. Fully retiring it needs native login + entitlement minting (not built).
- Offer copy was not rewritten; `docs/LAUNCH_CAMPAIGN.md` holds truthful DRAFT messages (nothing sent).
- Visits and checkout starts are measured by GA4 (`begin_checkout`, UTMs); paid + fulfilled by the new endpoint.

## Production actions awaiting your approval (one consolidated request)
1. **Merge** the PR for this branch to `main` (squash) and let CI publish `app-build-<sha7>`.
2. **Deploy** to the AWS host (Session Manager, `sudo bash aws-install-release.sh app-build-<sha7>`); auto-rollback on failure.
3. **Install the ops layer** on the host: `sudo bash aws/ops/install-ops.sh` (backups + follow-up timer; no app change).
4. **Stripe (live account)**: (a) create 3 Payment Links (Growth/Pro/Elite) that **require a card**, with `ypnus_tier`
   metadata and either no trial (charge today) or a card-required trial — **you choose**; (b) create a webhook endpoint
   `https://app.ypnus.com/api/webhooks/stripe` for `checkout.session.completed`, `invoice.paid`,
   `customer.subscription.created|updated|deleted`; set its signing secret as `STRIPE_WEBHOOK_SECRET` in
   `/etc/ypnusa/app.env` (never in chat).
5. **GitHub variables** `STRIPE_PAYMENT_LINK_GROWTH|PRO|ELITE` (the new link URLs), then rebuild.
6. **Server env**: `CONVERSION_COUNT_FROM=<go-live ISO time>`, `CONVERSION_EXCLUDE_CUSTOMERS=cus_UAeLcRUUcIyGuq`,
   `CRON_SECRET`, `RESEND_API_KEY` (+ verified sender domain) if not already set.
7. **Not part of this request** (separate approval later): DNS change / ypnus.com front door, disabling WordPress.

## Exact next commands (after approval)
```bash
# On the server (Session Manager), after the build is published:
sudo bash ypnusa-preflight.sh                       # read-only inspection first
sudo bash aws-install-release.sh app-build-<sha7>   # deploy, health-gated, auto-rollback
sudo bash install-ops.sh                            # backups + follow-up timer
# Count verified conversions at any time (secret from the server env, never pasted in chat):
curl -s -H "Authorization: Bearer $CRON_SECRET" https://app.ypnus.com/api/revenue/conversions
```
Stop condition: report **3** only when that endpoint shows `qualifyingConversions >= 3` AND each is confirmed in the Stripe
dashboard as a succeeded live payment from a real customer who is not you or an existing subscriber.
