# Native platform migration — prepared 2026-10-30

**Not deployed. Do not switch DNS yet.** The existing AWS host is documented in
`aws/README.md`. The ECS workflow in `.github/workflows/deploy-aws.yml` does NOT
target that EC2 instance. Use the existing release installer through SSM.

## Code in this change

- Native email login/account creation at `/login`, `/api/auth/email`, and
  `/api/auth/email/verify`. Single-use 15-minute tokens, hashes at rest, browser
  binding, same-origin POST verification, per-IP and per-email throttles. No
  passwords or public admin creation. Email must open in the requesting browser.
- Runtime gate `YPNUS_NATIVE_PLATFORM=true`; absent/false preserves the legacy
  WordPress login and territory API. `/register`, `/lo-signup.html`, and
  `/lo-dashboard.html` route into the native flow when enabled. Account creation
  does not itself buy a plan or claim a ZIP.
- `YPNUS_AUTH_ORIGIN` is the canonical HTTPS origin for email sign-in. Initially
  use `https://app.ypnus.com` for verification; after domain cutover, use
  `https://ypnus.com`. Keep account traffic on that origin (cookies are host-only).
- Native sessions re-read billing on each request, so cancellation revokes
  access without waiting for the signed cookie to expire. Only live Stripe
  records with payment confirmation (or unexpired trial dates) grant access.
- Trials cannot claim ZIPs or receive paid leads. Failed/incomplete payments
  no longer map to active billing. Native territory checks exclude seeded/demo
  scarcity and refuse to advertise inventory until
  `YPNUS_NATIVE_LEDGER_READY=true` is explicitly set after reconciliation.
- Literal public Stripe env references fix browser bundling of Payment Links.
- Login pages omit analytics. Security and billing mutations require durable
  storage rather than silently accepting in-memory-only state.
- `scripts/aws-recover-app.sh --check` diagnoses the installed app without
  printing secrets or customer data. `--restart` attempts one restart of the
  existing release and validates persistent-storage health.

## Required live work (blocked here by missing AWS/DNS access)

1. Reach EC2 `i-0ad200fc61f4d39f5`, us-east-2, through SSM. Run the recovery
   script read-only first; inspect private systemd/Apache logs to determine why
   the public endpoint returns 503. Recover the existing app before migration.
2. Back up WordPress database/uploads, current AWS store and environment,
   current release symlink, Apache configuration, and existing DNS records.
   Keep backups off-host. Do not print credentials in chat or logs.
3. Reconcile customer identity, active subscriptions, ZIP ownership, and data
   written on either host. Native accounts receive new IDs; existing user-owned
   onboarding/chat records need an explicit old-to-new identity mapping before
   users are moved. Do not infer an admin role from an email address. Verify
   tenant isolation and officer lead routing with the migrated identities.
4. Reconcile/replay live Stripe subscription, checkout and invoice state.
   Historical rows without `stripeLivemode`/`paymentConfirmed` do not grant
   native paid access. Ensure owner emails, requested ZIPs, trial end dates,
   canceled states and exclusive claims match Stripe and the WordPress ledger.
   Verify webhook event order and retries against actual customer records.
5. Configure `SESSION_SECRET`, `RESEND_API_KEY`, verified `RESEND_FROM_EMAIL`,
   `YPNUS_AUTH_ORIGIN`, and the existing Stripe webhook secret securely on the
   server. Keep the WordPress webhook running during verification. Check that
   `invoice.paid` is enabled along with checkout/subscription events. Build with
   the real public Growth/Pro/Elite Payment Links from repository variables.
6. On a private preview or controlled maintenance window, enable native mode
   and reconcile the ledger before setting its readiness flag. Test email
   delivery, signup, existing customer login, cancellation, trial expiry, first
   paid invoice, ZIP conflicts, intake persistence and actual officer routing.
   Verify paid plan metadata, 15-day trial terms, and return URLs in Stripe.
7. Complete WordPress content migration: rehost uploads, replace embedded
   WPForms/shortcodes and remaining `/wp-json/` calls, rewrite internal media
   links, test redirects and contact form delivery. Imported HTML alone does
   not replace interactive WordPress functionality.
8. Configure Apache and TLS to serve ypnus.com/www on this existing Node app;
   redirect app.ypnus.com to the chosen canonical host while retaining Stripe
   webhook POST delivery at its configured endpoint. Check domain ownership
   validation before certificates. Verify using a host override before DNS.
9. Switch DNS only after the checks above pass. Retain WordPress, its webhook,
   and the old DNS values for rollback until payment, identity, content and
   email checks are confirmed in production. Do not retire it merely because
   the homepage loads.

## Activation and rollback

This branch is a migration foundation, not certification of commercial readiness.
Do not enable the runtime switches on an unreconciled production store. Turning
native mode off restores legacy routing only while WordPress still exists at
its configured origin. After DNS cutover, rollback also requires restoring the
previous DNS/Apache route and environment and verifying writes made since cutover.
Never restore an older store over newly captured leads or paid subscriptions.
