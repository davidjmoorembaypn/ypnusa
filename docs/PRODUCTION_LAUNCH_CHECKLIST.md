# Production launch checklist — app.ypnus.com

Everything below is scoped to this repo (app.ypnus.com). WordPress-side items
(ypnus.com) are called out but not detailed — that's a separate codebase.

## 1. Secrets that fail closed until set

These routes reject every request (401/error) until the matching env var is
configured on Hostinger. Nothing here is optional if the feature is meant to
work in production.

| Env var | Gates | Consequence if unset |
| --- | --- | --- |
| `SESSION_SECRET` | Login/session cookie signing (`ypnus_session`) | Works, but a per-process fallback secret means sessions don't survive a redeploy and won't validate across multiple instances |
| `YPNUS_SSO_SHARED_SECRET` | ypnus.com → app.ypnus.com SSO handoff, and the signed tier/subscriptionStatus/trialEndsAt entitlement claim | Every SSO handoff request is rejected — no one can log in via the WordPress→app handoff at all |
| `ADMIN_TOKEN` / `CRON_SECRET` | `/api/webhooks/leads`, `/api/automation/process`, `/api/analytics/summary`, `/api/revenue/summary` | All rejected with 401 |
| `LAMBDA_FULFILLMENT_SECRET` | `/api/webhooks/fulfill` (Stripe fulfillment via the AWS Lambda) | Rejected with 401 — no Stripe checkout/cancellation event updates the revenue ledger |
| `TWILIO_AUTH_TOKEN` | `/api/voice/*` (AI assistant answering phone calls) | Both routes return a bare TwiML `<Reject/>` — safe no-op, but voice won't work until set |
| `REVIEW_REQUEST_API_SECRET` | `/api/reviews/request` | Required in production for the review-request webhook to fire |

## 2. Stripe → tier pipeline (read this before assuming fulfillment works)

**Actual MLO feature-gating reads only the signed SSO claim** (`tier` /
`subscriptionStatus` / `trialEndsAt`, see `docs/sso-handoff.md`) — that claim
is minted by WordPress, not by this app. Two independent Stripe integrations
exist and it's easy to assume the wrong one is "the" pipeline:

- **WordPress's own Stripe webhook** (`wp-plugins/ypnus-stripe-webhook.php`)
  — already receives Stripe events directly, resolves tier, writes WordPress
  user meta, and is what actually feeds the signed SSO claim. If this is
  live and configured, entitlements already work end-to-end.
- **This app's `/api/webhooks/fulfill`** (added this session, PR #52) — an
  AWS Lambda forwards verified Stripe events here. It's fully correct and
  tested (payment-status verification, per-subscription keying, event
  ordering), but it only updates `RevenueSubscriptionRecord`, which feeds
  **this app's own revenue-dashboard summary only** — it does **not** touch
  the SSO claim or gate any MLO feature.

Before relying on `/api/webhooks/fulfill` for anything user-facing, confirm
with whoever owns the WordPress side whether that plugin's pipeline is the
system of record (likely, given it's already built) or whether the Lambda is
meant to replace it (a larger integration than what exists today).

Required if using `/api/webhooks/fulfill`:

| Env var | Purpose |
| --- | --- |
| `LAMBDA_FULFILLMENT_SECRET` | Shared secret the Lambda sends as `x-internal-secret` |
| `STRIPE_PRICE_ID_STARTER` / `_GROWTH` / `_PRO` / `_ELITE` | Maps a Stripe price to a paid tier |
| `STRIPE_PRODUCT_ID_STARTER` / `_GROWTH` / `_PRO` / `_ELITE` | Fallback mapping by product instead of price |

## 3. Legal pages — resolved (PR #65)

~~No Privacy Policy or Terms of Service exists anywhere in this app~~ —
fixed. Four pages now exist and are linked from the footer
(`src/components/site-footer.tsx`) and the sitemap (`src/app/sitemap.ts`):

- `/privacy-policy` — GLBA-style financial-privacy language, CCPA/CPRA
  state-rights section, TCPA consent language for phone/SMS intake.
- `/terms-of-service` — "not a lender" disclaimer, Subscriber/billing/
  territory terms, Fair Housing/ECOA/TCPA acceptable-use rules, AI-output
  disclaimer.
- `/licensing-disclosures` — NMLS #787257 (individual record,
  `/individual/787257`, not the company path) / DRE #01852847 / Equal
  Housing Opportunity, with a link to NMLS Consumer Access.
- `/accessibility-statement` — WCAG 2.1 AA commitment.

**Still open, not code:** a mortgage-compliance attorney should review this
drafted content before it's treated as final — see the note in PR #65. Not
a blocker to deploying the pages themselves; the pages accurately describe
what the code does today (verified against `src/lib/crm.ts`'s actual
routing logic, not an aspirational claim).

## 4. Optional integrations (safe to launch without, work is dry-run/off by default)

| Env var(s) | Feature | Default behavior when unset |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | AI assistant chat modes | Routes/UI work, reply with a canned "not configured" message |
| `WORDPRESS_AUTOPILOT_*` | WordPress content autopilot | Proposal-only, never writes to WordPress |
| `WEBSITE_AUTOPILOT_UNATTENDED_*` | Scheduled autopilot runs | Fully off, no plan generated |
| `NEXT_PUBLIC_PREDICTIVE_HOMEPAGE_ENABLED` | Client-side behavior-scoring homepage engine | Renders nothing, homepage unchanged |
| `COUNTY_LOOKUP_API_URL` / `CENSUS_API_*` / `RENTAL_DEMAND_API_*` / `COUNTY_EVENTS_API_*` | Predictive lead-scoring data providers | Neutral placeholder data |
| `GBP_PLACE_ID` / `GBP_PROFILE_URL` / `GBP_REVIEWS_PROVIDER_*` | Google Business Profile reviews | No reviews shown |
| `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` | Maps embed | Map omitted |
| `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_*` | Direct-to-Stripe CTAs | CTA routes through ypnus.com's signup flow instead (current default, working) |
| `HOSTINGER_API_TOKEN` | Hostinger MCP tooling for this Claude session | N/A to end users |

## 5. Infrastructure — cannot be verified from this session

This session's sandbox network policy blocks outbound access to both
`ypnus.com` and `developers.hostinger.com` (confirmed via the agent proxy's
own status endpoint, not a transient failure), so none of the following can
be checked here. This still held in a later session where the Hostinger
hosting/DNS/domains/VPS MCP tools were attached and callable: every call
(`hosting_listWebsitesV1`, `domains_getDomainListV1`,
`DNS_getDNSRecordsV1`) came back `request blocked: no rule or allowlist
entry allows host "developers.hostinger.com"`, and
`/__agentproxy/status` recorded matching `connect_rejected` /
403-on-CONNECT entries — an organization egress-policy denial, not a tool
or credential problem, so it isn't something to retry or route around.
Verify directly on Hostinger (hPanel or a session with that host allowed):

- [ ] The Hostinger Node.js deployment for app.ypnus.com is actually running
      the latest `main` (currently `7e54d4b` as of this doc).
- [ ] All Section 1 secrets above are set in the Hostinger environment, not
      just documented in `.env.example`.
- [ ] DNS for `app.ypnus.com` resolves to the Hostinger Node.js app; DNS for
      `ypnus.com` resolves to the WordPress install.
- [ ] `LOANPILOT_DATA_DIR` points to a writable, persistent path on whatever
      host this runs on — the JSON data store is instance-local, so a
      serverless/ephemeral filesystem will silently lose data between cold
      starts (see the note in `.env.example`).
- [ ] The AWS Lambda (if the `/api/webhooks/fulfill` path is being used) is
      actually deployed and pointed at the correct Stripe webhook endpoint,
      and its secret matches `LAMBDA_FULFILLMENT_SECRET` here.

**Update:** the user pasted the actual generated `server.js` (and its
embedded `nextConfig` JSON) from the live `app.ypnus.com` Node.js deployment,
which answers part of the first item without needing Hostinger access:

- Confirms `output: "standalone"` is deployed as intended, `distDir: "./.next"`,
  and `configFileName: "next.config.ts"` — the live server is running a
  standalone build of *this* Next.js config, not something else.
- `repoRoot` / `outputFileTracingRoot` / `turbopack.root` all point at
  `/home/u853154979/domains/ypnus.com/app/hbuilds/current_backup`. This
  repo's own `scripts/deploy-hostinger.mjs` ships archives via Hostinger's
  official `POST .../nodejs/builds/settings/from-archive` API rather than
  managing directories itself, so `hbuilds/current_backup` is almost
  certainly Hostinger's own build-pipeline path, not evidence of a stale
  rollback — but that's an inference, not a verified fact. Worth a
  one-line confirmation from whoever has hPanel access that this is the
  *current* live slot and not a leftover backup.
- No env vars are inlined into `nextConfig` (`"env":{}`), consistent with
  Passenger injecting them via the hPanel Node.js panel rather than a
  committed `.env` — matches the intended setup.
- Caught one real, fixable gap from this: `poweredByHeader` was never set,
  so the default (`true`) means production was sending an
  `X-Powered-By: Next.js` header on every response. Fixed in
  `next.config.ts` (`poweredByHeader: false`) — minor hardening, no
  behavior change, verified with a clean `next build`.

## 6. Already fixed this session

- ✅ Two critical unauthenticated RCE vulnerabilities in Next.js
  (16.0.0–16.3.2 → 16.3.5) plus a high-severity `sharp` bug — `npm audit`
  now reports zero vulnerabilities.
- ✅ Three dead repo-root static HTML files removed (confirmed 404 live,
  unreferenced by any code path).
- ✅ Branded 404 page added (was falling back to Next.js's generic default).
- ✅ Privacy Policy, Terms of Service, Licensing & Disclosures, and
  Accessibility Statement pages added and linked from the footer/sitemap
  (see §3) — closes the launch-blocking legal-pages gap (PR #65).
- ✅ Render's `healthCheckPath` switched from `/` to `/api/health`
  (`render.yaml`) — checks the actual storage layer instead of rendering
  the full marketing homepage on every probe.

## 7. Regression sweep (this session)

Re-verified the whole repo end to end after a fresh `npm install`; no
regressions found and nothing needed fixing:

- ✅ `npm install` — 376 packages, **0 vulnerabilities**.
- ✅ `npm run lint` — 0 errors (2 pre-existing unused-arg warnings in
  `src/lib/flows.ts`, unrelated to launch readiness).
- ✅ `npm test` — **357/357 tests pass** across 81 suites, including the
  Stripe fulfillment idempotency/ZIP-claim-conflict tests
  (`src/app/api/webhooks/fulfill/route.test.ts`) and the WordPress
  autopilot Rank Math field-routing tests.
- ✅ `npm run build` — production build succeeds (all routes compile,
  including the dynamic `/api/webhooks/fulfill`, `/api/webhooks/leads`,
  and static legal/SEO pages added in PR #65).
- ✅ Spot-checked the in-repo WordPress plugins
  (`wp-plugins/ypnus-stripe-webhook`, `wp-mu-plugins/ypnus-supabase-signup`,
  `wp-mu-plugins/ypnus-lo-account-bridge`) for the usual commercial-readiness
  red flags (missing Stripe signature verification, unparameterized
  `$wpdb` queries, TODO/FIXME/placeholder markers) — none found; the Stripe
  webhook plugin verifies its HMAC signature (`ypnus_stripe_verify_signature`)
  before trusting any event and every `$wpdb->query`/`get_row` call with a
  variable value goes through `$wpdb->prepare`.
- No open PRs or issues in this repo as of this sweep — everything actionable
  from §§1–5 above is infrastructure/legal, not code, and stays open pending
  direct Hostinger/attorney access this session doesn't have.

## 8. Deeper audit + fixes (same day, follow-up pass)

Ran three parallel focused audits (WordPress plugins, every Next.js API
route, frontend compliance surfaces) and fixed everything that was safe to
fix without further product/legal input:

- ✅ **Timing-safe secret comparison.** `src/lib/http.ts`'s `requireInternalSecret`
  and `matchSuppliedSecret`, plus `src/app/api/reviews/request/route.ts`'s
  `isAuthorized`, compared secrets with plain `===`/`Array.includes` — a
  timing side-channel on `ADMIN_TOKEN`/`CRON_SECRET`/`LAMBDA_FULFILLMENT_SECRET`/
  `REVIEW_REQUEST_API_SECRET`. Added a shared `safeEqual()` (same
  `crypto.timingSafeEqual` pattern already used in `src/lib/sso.ts`,
  `src/lib/session.ts`, and `src/lib/voice/twilio.ts`) and switched all of
  them to it.
- ✅ **Missing rate limits.** `webhooks/leads`, `onboarding`, `agent`, and
  `funnel/optimize` wrote data with no rate limiting despite sibling routes
  with the same auth shape (`automation/process`, `personalize`,
  `funnel/track`) having one — added `enforceRateLimit`/`rateLimit` calls
  matching each route's existing auth pattern. (`cta`'s lack of a limiter is
  a deliberate, commented decision — pure/cheap in-memory computation — left
  as-is.)
- ✅ **TCPA consent gaps (frontend).** `src/components/territory-claim.tsx`
  (ZIP-reservation form) and `src/components/loanpilot-floating-assistant.tsx`
  (the borrower intake chat's contact-info step, used by both the floating
  widget and `/embed/intake`) collected a phone number for SMS/call follow-up
  with no consent checkbox at all — unlike `src/components/equity-snapshot.tsx`,
  which already had one. Added the same unchecked-by-default, required
  checkbox + submit-blocking pattern to both.
- ✅ **TCPA consent gap (WordPress backend).** `wp-mu-plugins/ypnus-supabase-signup.php`'s
  `/intake` REST route (the one `docs/WORDPRESS_LIVE_CHANGE_LOG.md:217`
  already flagged as missing a TCPA checkbox on the `lo-signup.html` static
  page) had no server-side consent enforcement either — added a
  `tcpa_consent`/`consent_at` column pair (versioned `dbDelta` migration,
  `YPNUS_INTAKE_DB_VERSION` bumped to `1.1.0`) and the route now rejects any
  submission missing `tcpa_consent=true`. **Still open:** the actual
  borrower-facing widget that POSTs to this endpoint is a static file outside
  this repo (per the change-log entry) — it needs to actually send
  `tcpa_consent` from a real checkbox, or every submission will now 400.
  This backend change is defense-in-depth, not a substitute for that.
- ✅ **Rank Math schema drift.** `wp-plugins/ypnus-trust-and-schema/ypnus-trust-and-schema.php`'s
  `SoftwareApplication.offers` listed Starter/Pro/Elite but omitted the
  canonical "Growth" tier — added it.
- ✅ **Embed disclosure.** `/embed/intake` (an iframe-embeddable,
  borrower-facing surface) rendered with no NMLS/Equal Housing text at all,
  unlike every other public page (via `SiteFooter`) — added a minimal
  one-line disclosure to `src/app/embed/intake/page.tsx`.

**Reviewed, deliberately not changed:**

- `SiteFooter` isn't rendered on internal dashboard/portal/onboarding/login
  routes — those are authenticated MLO-tool screens (per `references/ypnus.md`:
  "audience is mortgage loan officers, not consumers"), not consumer-facing
  loan touchpoints, so the consumer-disclosure rationale doesn't clearly
  apply the same way it does to `/embed/intake`. Flagging here rather than
  changing unilaterally — a product call, not a bug.
- Equal Housing Opportunity renders as text only, no logo — HUD advertising
  guidance treats the text statement alone as sufficient; not a compliance
  blocker.
- `privacy-policy`/`terms-of-service`/`accessibility-statement` don't cross-link
  to each other (only `licensing-disclosures` does) — cosmetic, all four are
  independently reachable from the footer and sitemap already.
- WP `territory_conflict`/`account_mapping_conflict` states (a paying
  customer stuck unprovisioned) log to a `wp_option` but never alert anyone —
  real gap, but fixing it means deciding on a notification channel/owner,
  not a safe unilateral code change.
- `wp-mu-plugins/ypnus-supabase-signup.php`'s `/intake` `lo_id` isn't
  validated against a real LO account before insert (leads can land against
  a bogus id) — same reasoning, needs a decision on failure behavior
  (reject vs. flag) before changing.

All of the above verified together: `npm run lint` (0 errors), `npm test`
(357/357), `npm run build` (clean), and `php -l` on every touched PHP file.

## 9. CodeRabbit review follow-ups (same PR)

CodeRabbit's automated review on PR #67 caught one real bug this session's
own testing missed, plus two items worth a documented decision rather than
a reflexive fix:

- ✅ **Fixed:** `loanpilot-floating-assistant.tsx`'s `clearConversation()`
  reset the conversation but not `contactDraft`/`contactConsent` — a user
  could reset mid-flow and submit new contact info without re-checking the
  consent box (the stale `true` survived the reset). Now cleared alongside
  the rest of the conversation state.
- ✅ **Fixed (partial, by design):** `/api/demo-request` — hit directly by
  ypnus.com's own marketing forms via CORS, not just `territory-claim.tsx` —
  now accepts and persists a `consent`/`consentAt` field when a caller sends
  one (and `territory-claim.tsx` now sends it, since it already gated
  client-side). **Deliberately not hard-rejecting** requests that omit it,
  unlike the WP `/intake` route in §8: this endpoint is called directly by
  external ypnus.com marketing-site forms this repo can't inspect from this
  session (network-blocked), and rejecting unconditionally risked silently
  breaking live lead capture with no way to verify the blast radius first.
  Same underlying gap as `wp-mu-plugins/ypnus-supabase-signup.php`'s
  `/intake` — someone with ypnus.com access needs to confirm those forms
  send consent before this can safely flip to hard-rejecting.
- **Noted, not changed:** `src/lib/http.ts`'s `safeEqual()` returns `false`
  on a length mismatch before calling `timingSafeEqual` — CodeRabbit flagged
  this (itself rated trivial/low-value) as leaking the configured secret's
  *length* via timing, not the secret itself. Left as-is: this is the exact
  pattern already used pre-existing in `src/lib/sso.ts`, `session.ts`, and
  `voice/twilio.ts`, so "fixing" it here alone would make this file
  inconsistent with three established call sites rather than close a real
  gap.
- **Noted, not changed:** `src/components/equity-snapshot.tsx` posts to
  `/api/property/evaluate` with the same pre-existing (not touched this
  session) consent-checkbox pattern that inspired the two fixes above, and
  that route doesn't persist a consent field either. Out of scope for this
  PR (untouched file, not flagged by the review since it's outside the
  diff) — worth the same `consent`/`consentAt` treatment as `demo-request`
  in a follow-up.

Re-verified after these fixes: `npm run lint` (0 errors), `npm test`
(357/357), `npm run build` (clean).

## 10. Production pass — 2026-09-24 (owner-approved, applied live)

**App (app.ypnus.com)** — live build is whatever `/api/health` reports as `build.commit`.

- Deploy: `next build` can't finish inside Hostinger's LVE, so bundles are built off-host and installed with `scripts/hostinger-install-release.sh` (checksum, `YPN-ENV-LOADER` preamble carried forward, previous chunks kept, worker recycled, auto-rollback). GitHub Actions jobs don't start on this account (billing/settings), so until that's fixed the bundle is published to the `deploy/app-build` branch and installed with `YPNUS_BUILD_URL` (see `hostinger/README.md`).
- Hostinger's CDN honors `s-maxage` and never purges on deploy: static pages now send `s-maxage=300, stale-while-revalidate=300` (root layout `revalidate = 300`, `expireTime: 600`). Copies cached before that carry a one-year TTL — flush the CDN once in hPanel.
- `public_html/app/.htaccess` no longer forces `X-Frame-Options: SAMEORIGIN`; the app sends DENY everywhere except `/embed/*` (MLO sites iframe the intake).
- `/api/health` no longer exposes the server data path; JSON store is multi-process safe.

**WordPress (ypnus.com)**

- Stripe: new Payment Links + $99.99/$199.99/$299.99 everywhere; webhook resolves tier from the current price (portal plan switches); price map in `ypnus_stripe_tier_by_price_id`; customer-portal login link now points at the live account.
- Compliance: TCPA checkbox on WPForms territory form, `lo-signup.html`, `/contact/`; `/signup` now stores `tcpa_consent`/`consent_at`/`consent_version`; NMLS/EHO/Consumer Access footer on static pages; `/welcome/` post-checkout page (noindex).
- Security: WP File Manager and Auto Affiliate Links removed; `DISALLOW_FILE_EDIT`; backups moved out of `public_html` to `~/backups/`; the duplicate WordPress install at `/loans/` is locked (403; `/loans/pricing.html` 301s to `/pricing.html`; original rules in `~/backups/2026-09-24/loans/`).
- SEO: duplicate redirects removed; redirected pages noindexed; author sitemap off (it exposed service-account usernames); sitemap crawl: 450/450 URLs resolve.

**Owner-only (not doable from code):** flush the hPanel CDN once; switch WP Mail SMTP from PHP `mail` to authenticated Hostinger SMTP and send a test; Stripe Dashboard (deactivate old $99/$199/$299/Starter links, after-payment redirect to `/welcome/`, portal return URL + legal links, tax registrations); fix GitHub Actions billing; attorney review of legal copy; decide whether to delete `/loans/`.
