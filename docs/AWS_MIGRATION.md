# Moving ypnus.com + app.ypnus.com to AWS

Status: **infrastructure code only. Nothing here has been applied or deployed.**
Production deploys need explicit owner approval (see `AGENTS.md`).

## Target

| Piece | AWS service |
| --- | --- |
| app.ypnus.com (this Next.js app) | ECS Fargate, 1 task, image in ECR, behind an ALB with ACM TLS |
| App state (`store.json`) | EFS (encrypted) mounted at `/data`, daily AWS Backup, 35-day retention |
| Secrets | Secrets Manager, injected as env vars (values set out-of-band) |
| ypnus.com + www (marketing site) | The same Next.js app, as extra hostnames on the same ALB/certificate. WordPress is retired. |
| DNS | Route 53 (optional; `route53_zone_id` empty keeps your current DNS host) |

The app must stay at **one task**: the JSON store has a single writer. Scaling beyond one
task needs the Postgres migration (`migrations/001-003`) first.

## Deploy path (documented 2026-10-16)

See `aws/README.md` for the full runbook: host details, how to get a shell
(AWS SSM Session Manager — not blocked by the quarantine SCP below), and
`scripts/aws-install-release.sh` to install a new release with automatic
rollback. This section's "to fix it" steps below are now mostly done — the
host is `i-0ad200fc61f4d39f5` (us-east-2), reachable, and now running build
`5bd0cf5`, deployed via that script and verified against `/api/health`.

## Correction: where the app runs today (verified 2026-10-15)

`app.ypnus.com` was never on Vercel. Until about 2026-10-09 it ran on Hostinger (Passenger,
behind Hostinger's CDN). It now resolves to `18.223.107.93`, an AWS host answering as
`Apache/2.4.68 (Amazon Linux)` in front of the Next.js app. That host was set up outside this
runbook; it is not the ECS/ALB stack in `infra/aws`.

The AWS host runs build `08931f2` (2026-10-05) with `"persistent": true` and serves public
pages, but none of the settings from Hostinger's `app/.env` reached it:

| Variable | Evidence on AWS | Effect |
| --- | --- | --- |
| `YPNUS_SSO_SHARED_SECRET` | `/api/auth/callback` says "SSO handoff is not configured" | Sign-in from ypnus.com fails |
| `ANTHROPIC_API_KEY` | `POST /api/tools/marketing` returns 503 | Assistant, GBP Optimizer and Social Writer are down |
| `ADMIN_TOKEN` / `CRON_SECRET` | Hostinger's admin token gets 401 | Admin diagnostics and automation calls fail |
| `SESSION_SECRET` | Not checkable from outside; assume missing | Sessions fall back to a key file on the host |

The Hostinger install is intact and is the source for both settings and data:

- Settings: `/home/u853154979/domains/ypnus.com/app/.env` (9 variables).
- Data: `/home/u853154979/domains/ypnus.com/app/persistent-data/store.json`, last written
  2026-10-09T10:21Z. It holds 3 loan officers, 35 sessions, 3 revenue subscriptions,
  appointments and chat sessions. Anything written on AWS since the DNS switch exists only there.

To fix it you need access to the AWS host, for example through the AWS MCP connector:

1. Find the instance behind `18.223.107.93` and how it runs the app (process manager, env file).
2. Copy the variables server to server. Never paste values into chat, PRs or commits.
3. Merge `store.json`: Hostinger's copy plus any records created on AWS after the switch.
4. Restart the app, then verify:
   - `/api/auth/callback` (no params) says "Missing required SSO handoff parameters".
   - `/api/health/sso` (with `ADMIN_TOKEN`) shows the same SSO fingerprint as WordPress: the first 8 hex chars of `sha256(YPNUS_SSO_SHARED_SECRET)`.
   - `POST /api/tools/marketing` returns 200.
5. Write the host's deploy path here and in `AGENTS.md`.

## Decision: WordPress is retired

The owner does not want to keep WordPress. ypnus.com will be served by this Next.js app.
**ypnus.com itself must stay live and untouched until each item below is actually done — do
not flip DNS or disable the WordPress Stripe webhook as a side effect of this work.**
Remaining work before ypnus.com can cut over (tracked as follow-ups):

1. Export the 138 pages / 335 posts from WordPress to MDX (or the existing `src/content`) and
   generate a 301 redirect map from every old URL, so rankings survive. **Not done.**
2. ~~Make canonical URLs, sitemap and metadata host-aware~~ — **done.** `src/lib/request-host.ts`'s
   `getSiteOrigin()` reads the request's `Host` header and returns `ypnus.com` or
   `app.ypnus.com` accordingly; `src/app/sitemap.ts` and every page's `generateMetadata()`
   already use it.
3. Replace the `/wp-json/ypnus/v1` territory and signup calls with native routes — **partially
   done (2026-10-20).** `/api/territory/check` still prefers `ypnus.com`'s live ZIP ledger
   first (`src/lib/live-territory.ts`) and only falls back to the local store; that preference
   is intentionally left in place so ypnus.com stays the source of truth for now. What's new:
   a native Stripe-fulfillment pipeline (`src/lib/fulfillment.ts`, reached via
   `/api/webhooks/stripe`) now writes real ZIP claims into this app's own
   `RevenueSubscriptionRecord` store as events arrive — see item 4. Once that's been observed
   reliable for a stretch, flipping `/api/territory/check` to prefer the local ledger (and
   retiring the WP live-fetch) is the next step — not done yet, on purpose.
4. Move the WordPress Stripe webhook and SSO claim minting into the app, and re-point Stripe —
   **the mirror half is done (2026-10-20), the cutover half is not.** This app verifies Stripe's
   signature directly now (`/api/webhooks/stripe`, `STRIPE_WEBHOOK_SECRET`) and applies
   `checkout.session.completed` / `customer.subscription.created|updated|deleted` through
   `src/lib/fulfillment.ts` — tier resolved from each event's `metadata.ypnus_tier` (every live
   Payment Link/price already sets this) with `STRIPE_PRICE_ID_*`/`STRIPE_PRODUCT_ID_*` as
   fallback. A **second, additive** Stripe webhook endpoint was created pointing at
   `https://app.ypnus.com/api/webhooks/stripe` for exactly these event types —
   WordPress's existing endpoint (`https://ypnus.com/wp-json/ypnus/v1/stripe-webhook`) is
   untouched and still the only one the signed SSO claim (actual feature-gating) reads from.
   Not done: making this app's copy the system of record, or minting the SSO claim itself.
5. Replace WPForms and WP Mail SMTP with app routes plus an email provider. **Not done.**

## Order of operations (each step is reversible until DNS cutover)

1. `cd infra/aws && terraform init && terraform apply` (review the plan first).
2. Add ACM validation CNAMEs from `terraform output acm_validation_records` at the DNS host
   (skip when `route53_zone_id` is set).
3. Set every secret: `aws secretsmanager put-secret-value --secret-id ypnusa/<NAME> --secret-string '<value>'`.
   Copy the values from `app/.env` on Hostinger. Never commit them.
4. Push the image: run the **Deploy to AWS (manual)** workflow, or build and push to ECR yourself.
5. Copy current state **if a persistent copy exists** (see the correction above): upload it as
   `store.json` into the EFS `/ypnusa` directory before the first task start.
6. Verify on the ALB DNS name: `/api/health` returns `"persistent":true,"degraded":false`.
7. Lower the `app` record TTL to 300 a day ahead. At cutover, point `app.ypnus.com` at the ALB.
8. Keep the current hosts (the Hostinger app standby and Hostinger WordPress) running for at least 7 days as the rollback target.

## Open items that need an owner decision

- WordPress move and its backup (separate runbook, not part of this PR).
- Stripe: WordPress's webhook plugin is the system of record for entitlements; the AWS Lambda
  only feeds the revenue dashboard. Decide whether to consolidate.
- Terraform here was formatted but not validated against the AWS provider in the authoring
  sandbox (registry unreachable). Run `terraform validate` and `plan` before applying.
- The Docker image was not built in the authoring sandbox (no daemon); the Next.js standalone
  server was started directly and `/api/health` reported persistent storage.
