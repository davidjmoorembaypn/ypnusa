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
