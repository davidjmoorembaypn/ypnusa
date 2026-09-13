# Architecture, DbShape, and cross-host routing audit

Snapshot of the app's data collections and its relationship to the WordPress
marketing/billing host, for use when drafting DNS, reverse-proxy,
cookie-boundary, and crawl-budget rules. Evidence is cited as
`path:line`. Nothing here changes app behavior — it's a reference inventory.

## Collections in `DbShape`

`src/lib/types.ts:235-247`

```ts
export interface DbShape {
  loanOfficers: LoanOfficerRecord[];
  sessions: IntakeSessionRecord[];
  borrowerLeads: BorrowerLeadRecord[];
  crmLeads: CrmLeadRecord[];
  loAlerts: LoAlertRecord[];
  followUps: ScheduledFollowUpRecord[];
  appointments: AppointmentRecord[];
  analyticsEvents: AnalyticsEventRecord[];
  demoRequests: DemoRequestRecord[];
  propertyEvaluations: PropertyEvaluationRecord[];
  revenueSubscriptions: RevenueSubscriptionRecord[];
}
```

All 11 collections live in the single file-backed store (`data/store.json`,
auto-created on first write — see `AGENTS.md`).

The health endpoint exposes persistence mode without leaking disk paths to
clients that don't need them:

`src/lib/db.ts:354-360`

```ts
export function storageMode(): { persistent: boolean; dir: string; error?: string } {
  hydrate();
  return {
    persistent: diskWritable,
    dir: dataDir(),
    error: lastStorageError,
  };
}
```

## External / authoritative systems

| System | Role | Evidence |
| --- | --- | --- |
| WordPress zip-check API | Live territory lock ledger | `src/lib/live-territory.ts:44` |
| WordPress Stripe webhook plugin | Billing / entitlements (not this app) | `wp-plugins/ypnus-stripe-webhook/README.md:5` |
| Supabase schema (optional, future) | `supabase-leads-schema.sql` — not wired into the app | `supabase-leads-schema.sql:1-26` |
| `INTAKE_EXTERNAL_WEBHOOK_URL` | Optional Zapier-style intake mirror | `src/lib/external-webhook.ts:28-32` |

Local territory scarcity merges seed ZIPs, demo requests, and revenue
subscriptions; it does **not** sync Stripe claims live from WordPress:

`src/lib/territory.ts:68-72`

```
 * ZIP scarcity must reflect paid, durable claims ...
 * Stripe billing/entitlement is owned
 * by ypnus.com's ypnus-stripe-webhook plugin, not this local store
```

## WordPress-side routes & plugins (ypnus.com)

### REST API (in-repo plugins)

| Endpoint | Plugin | Evidence |
| --- | --- | --- |
| `POST /wp-json/ypnus/v1/stripe-webhook` | `ypnus-stripe-webhook` | `wp-plugins/ypnus-stripe-webhook/ypnus-stripe-webhook.php:104-113` |

### REST API (documented, not implemented in this repo)

Confirmed live and registered via a direct `GET /wp-json/ypnus/v1` index fetch on
2026-09-13 — not implemented in this repo, but not vaporware either:

- `GET /wp-json/ypnus/v1/zip-check/{zip}` — `src/lib/live-territory.ts:44`; functionally
  tested against ZIP 93720, returned real demand data
- `POST /wp-json/ypnus/v1/login`, `/request-reset`, `/reset-password`, `/profile`, `/create-mlo` — `docs/sso-handoff.md:78-79`;
  registered and live, but the `/login` handler's actual signed-redirect behavior
  (HMAC contract in `docs/sso-handoff.md`) wasn't verified — that needs either the
  plugin source or a real end-to-end login test

### Marketing HTML paths referenced (WordPress / static, not Next.js)

`/lo-signup.html`, `/check-zip.html`, `/pricing-plans/` — `src/components/site-footer.tsx:47-49`

### SEO hygiene plugin

Documents the host split directly in the WordPress `robots.txt`:

`ypnus-seo-hygiene.php:39-42`

```
$note .= "# Marketing host = ypnus.com (this file)\n";
$note .= "# Product/territory host = https://app.ypnus.com/\n";
$note .= "# Do not mirror app.ypnus.com's 70k ZIP sitemap here.\n";
```

## Deployment, Apache, Cloudflare, reverse-proxy

No Nginx/Caddy configs are checked in; the README only mentions the option
generically (`README.md:145-146`).

### Hostinger Apache (`.htaccess`) — app.ypnus.com

`hostinger/app-ypnus/.htaccess:1-20` routes Next.js (Passenger) plus legacy
territory PHP routes:

```
RewriteRule ^territories/?$ territory.php?view=hub [L,QSA]
RewriteRule ^states/([a-zA-Z]{2})/?$ territory.php?view=state&state=$1 [L,QSA]
RewriteRule ^cities/([a-zA-Z]{2})/([a-z0-9-]+)/?$ territory.php?view=city&state=$1&city=$2 [L,QSA]
RewriteRule ^zips/([0-9]{5})/?$ territory.php?view=zip&zip=$1 [L,QSA]
RewriteRule ^feed\.xml$ territory.php?view=feed [L]
```

Programmatic SEO paths get `X-Robots-Tag: noindex` (`.htaccess:22-28`,
`BEGIN YPNUS-NOINDEX-PROGRAMMATIC` block).

The legacy static fallback homepage calls the WP zip-check API directly:
`hostinger/app-ypnus/index.html:107`.

### Known production incidents (documented)

| Issue | Mitigation in repo | Evidence |
| --- | --- | --- |
| `app.ypnus.com/` 301 → `ypnus.com/` | `.htaccess` fix script | `hostinger/README.md:12-16`, `scripts/deploy-hostinger.mjs:324-344` |
| ~70k URLs in app sitemap | App sitemap trimmed to `/` only | `src/app/sitemap.ts:5-8`, `hostinger/README.md:18-19` |
| Cloudflare redirect rules | `scripts/fix-cloudflare-redirect.mjs` | `scripts/fix-cloudflare-redirect.mjs:3-7` |

### Package scripts

`package.json:8-18`

```json
"dev": "next dev",
"build": "next build",
"start": "next start -H 0.0.0.0 -p ${PORT:-3000}",
"lint": "eslint",
"test": "tsx --test src/**/*.test.ts",
"deploy:hostinger:list": "node scripts/deploy-hostinger.mjs list",
"deploy:hostinger:next": "node scripts/deploy-hostinger.mjs deploy-next",
"deploy:hostinger:status": "node scripts/deploy-hostinger.mjs status",
"deploy:hostinger:fix-htaccess": "node scripts/deploy-hostinger.mjs fix-htaccess",
"deploy:cloudflare:list": "node scripts/fix-cloudflare-redirect.mjs list"
```

## Repo-root static artifacts (not Next.js routes)

These exist in the repo but are not registered App Router pages — a routing
plan must decide whether each is deployed on WordPress, the app host, or
retired:

| File | Notes |
| --- | --- |
| `ypn-ai-borrower-intake.html` | Legacy standalone intake, verified live at `https://ypnus.com/ypn-ai-borrower-intake.html` (200, content matches this file). Deliberately left reachable — see the `YPNUS_LEGACY_INTAKE_PAGE_URL` comment in `wp-mu-plugins/ypnus-supabase-signup.php`. Do not delete without first wiring a redirect. |
| `hostinger/app-ypnus/index.html` | Emergency static app homepage |

The actual `https://ypnus.com/` homepage is **not** any file in this repo — it's
authored directly as a `wp:html` block on the WordPress "Home" page (post ID
1829), edited in place via WPVibe/Novamira, with zero connection to this git
history. Three files previously listed here (`ypn-ai-landing.html`,
`borrower-intake-widget.html`, `dashboard.html`) were checked against their
presumed live URLs and all returned 404 — dead, unreferenced by any deploy
path, and pending removal from the repo.

## Cross-host traffic flows

- `ypnus.com` (WordPress) issues a 302 + HMAC signature and mints the
  `ypnus_session` cookie for `app.ypnus.com` (Next.js).
- The browser calls `app.ypnus.com`'s zip-check proxy, which fetches
  `ypnus.com/wp-json/ypnus/v1/zip-check/{zip}` server-side.
- Marketing lead capture posts CORS `POST` requests directly from
  `ypnus.com` to `app.ypnus.com/api/demo-request` (`README.md:96-99`).
- Stripe webhooks land only on `ypnus.com` (`POST /wp-json/ypnus/v1/stripe-webhook`).
- SSO session mint happens at `app.ypnus.com/api/auth/callback` (`src/lib/sso.ts:10`).

## Risks, unknowns, and routing-plan gaps

| # | Risk / unknown | Severity | Evidence |
| --- | --- | --- | --- |
| 1 | `us.ypnus.com` undefined — no DNS, routes, or docs in repo | High if planned | Zero grep matches |
| 2 | SSO not live on WordPress — **Partially resolved.** `POST /wp-json/ypnus/v1/login`, `/request-reset`, `/reset-password`, `/create-mlo`, `/profile` are registered and live on ypnus.com (confirmed via a live REST index fetch). **Still unverified:** whether `/login` actually performs the signed redirect to `app.ypnus.com/api/auth/callback` per `docs/sso-handoff.md`'s exact HMAC contract — plugin source wasn't readable from this check, and testing requires a real login | Medium (down from High) | `docs/sso-handoff.md:75-82`; live route confirmation 2026-09-13 |
| 3 | ~~`/dashboard` 404 after SSO~~ — **Resolved.** `src/app/dashboard/page.tsx` now exists and calls `requireSession` | ~~Medium~~ | `src/app/dashboard/page.tsx` |
| 4 | ~~Auth is proxy-only~~ — **Resolved.** Every protected page calls `requireSession`/`requireAdminSession`; APIs behind proxy-gated pages call `requireAdminSessionOrSecret` | ~~Medium–High~~ | `src/lib/auth.ts:52-79` |
| 5 | ~~Admin/cron APIs open by default~~ — **Resolved.** `requireSecret` now denies when neither secret is configured | ~~High~~ | `src/lib/http.ts:46-56` |
| 6 | `REVIEW_REQUEST_API_SECRET` optional in non-production; required in prod | Medium | `src/app/api/reviews/request/route.ts:8-9` |
| 7 | ~~Stale Hostinger README Stripe env vars~~ — **Resolved.** `hostinger/README.md` already documents the removal accurately (no `STRIPE_*` env var expected on this app) | ~~Medium~~ | `hostinger/README.md:120-122,139-150` |
| 8 | Dual stack on app.ypnus.com — Next.js + legacy PHP territory routes in `.htaccess`; `territory.php` not in repo | Medium | `hostinger/app-ypnus/.htaccess:14-19` |
| 9 | Local SEO canonical vs hosting mismatch — pages built on app, canonicals on ypnus.com; reverse-proxy not configured in repo | High for SEO routing | `src/lib/local-seo.ts:203-204`, `README.md:85-90` |
| 10 | File store is instance-local — `/tmp/ypnus-data` on Hostinger/Render; multi-instance sessions need `SESSION_SECRET` | High at scale | `hostinger/README.md:82`, `src/lib/session.ts:29-31` |
| 11 | Rate limits in-memory only — not shared across instances | Medium | `src/lib/rate-limit.ts:4-7` |
| 12 | Live production state — **Partially resolved.** ypnus.com (WordPress) confirmed live, correct plugin set active, functional REST responses. **Still unknown:** app.ypnus.com (Next.js/Hostinger) — this session's network egress to `app.ypnus.com` and `developers.hostinger.com` is blocked, so current deploy commit / env vars / DNS can't be checked from here | Unknown (app.ypnus.com only) | Live WordPress checks 2026-09-13; `hostinger/README.md:8` |
| 13 | Cloudflare / DNS / TLS — scripts exist but no committed zone config | Unknown | `hostinger/README.md:26-27` |
| 14 | ~~WordPress zip-check / MLO toolkit unverified~~ — **Resolved (behavior confirmed live).** `GET /wp-json/ypnus/v1/zip-check/93720` returns real, correctly-shaped data (`{"available":true,"city":"Fresno","demand":{...}}`), not a stub. Route source still isn't versioned in this repo (owned by `ypnus-mlo-toolkit` on WordPress) | Low (down from Unknown) | Live test 2026-09-13; `src/lib/live-territory.ts:25-27` |
| 15 | ~~Render health check uses `/` not `/api/health`~~ — **Resolved.** | ~~Low~~ | `render.yaml:17` |
| 16 | CORS on `/api/demo-request` locked to a single marketing origin — no staging origin support | Low | `src/app/api/demo-request/route.ts:16-20` |

## Suggested routing matrix (evidence-backed targets)

| Traffic | Target host | Backend | Notes |
| --- | --- | --- | --- |
| Marketing, blog, signup HTML | `ypnus.com` | WordPress | `hostinger/README.md:7-8` |
| Product app, intake, dashboards, APIs | `app.ypnus.com` | Next.js Node (standalone) | `hostinger/README.md:67-68` |
| Local SEO pages (canonical on marketing) | `ypnus.com` URL → proxy to Next.js | Reverse-proxy `/mortgage-broker/*`, `/zip/*`, `/local-seo-sitemap.xml` | `README.md:85-90` |
| Stripe webhooks | `ypnus.com` only | WP plugin | `wp-plugins/ypnus-stripe-webhook/README.md:5` |
| SSO session mint | `app.ypnus.com/api/auth/callback` | Next.js | `src/lib/sso.ts:10` |
| ZIP availability API (authoritative) | `ypnus.com/wp-json/ypnus/v1/zip-check/{zip}` | WordPress | `src/lib/live-territory.ts:44` |
| Legacy programmatic territory URLs | `app.ypnus.com/zips/*`, `/cities/*`, etc. | Apache → `territory.php` (if present) | `hostinger/app-ypnus/.htaccess:14-19` |
| `us.ypnus.com` | Undefined | — | No repo evidence |

This inventory is sufficient to draft DNS, reverse-proxy, cookie-boundary,
and crawl-budget rules without further code changes.
