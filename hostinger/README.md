# Hostinger deploy notes — ypnus.com + app.ypnus.com

## Deploy app.ypnus.com (current method)

`next build` can't finish inside Hostinger's LVE (memory/thread caps), so the
app is built on GitHub and only the finished bundle is installed on the server:

1. Merge to `main`. `.github/workflows/release-build.yml` runs the tests, builds
   the standalone bundle on Node 20, injects `hostinger/server-preamble.js`
   (persistent data dir + `YPN-ENV-LOADER` for `app/.env`) into its `server.js`
   with `scripts/inject-server-preamble.mjs`, and publishes it as release
   `app-build-<sha7>` (asset `app-build.tar.gz` + `.sha256`).
2. On the server, run `bash scripts/hostinger-install-release.sh` (fetch it from
   the repo's raw URL, or keep a copy in `app/hbuilds/`). It verifies the
   checksum, installs to `hbuilds/versions/build-<ts>-<sha7>/nodejs` (copying the
   preamble from the live build only if a bundle lacks it), keeps the previous
   build's hashed chunks for CDN-cached HTML, switches `hbuilds/current`,
   recycles the LiteSpeed worker, and rolls back automatically unless
   `/api/health` reports the new `build.commit`.
3. Confirm: `curl https://app.ypnus.com/api/health` shows `build.commit`.

Never deploy app.ypnus.com through hPanel's Node.js "Deploy"/"Rebuild",
Hostinger's Node.js Builds API, or an uploaded archive: on 2026-09-26 that
replaced the live app with an old bundle (no compliance pages, no `app/.env`
loader) and deleted the installed releases.

If GitHub Actions can't run, build locally the same way the workflow does and push
`app-build.tar.gz` + `.sha256` to the orphan branch `deploy/app-build`, then run the
installer with
`YPNUS_BUILD_URL=https://raw.githubusercontent.com/davidjmoorembaypn/ypnusa/deploy/app-build`.

Secrets stay in `app/.env` (outside the web root); nothing secret ships in the bundle.
After editing `app/.env`, re-run the installer: it restarts the worker, which reads
the file at startup.

## Current production shape

| Host | Role | Stack |
| --- | --- | --- |
| `https://ypnus.com` | Marketing, signup, Cerebro, Rank Math SEO | WordPress on Hostinger |
| `https://app.ypnus.com` | Territory product / ZIP inventory | Next.js standalone on LiteSpeed Node (Passenger-compatible), Node 20 |

## Critical live bugs found (and fixed)

1. **`app.ypnus.com/` 301 → `ypnus.com/`**  
   Cause was an `.htaccess` rule (`RewriteRule ^$ https://ypnus.com/`) in the app
   document root — not Cloudflare alone. Removed by
   `node scripts/deploy-hostinger.mjs fix-htaccess`, which strips only that rule
   if it ever reappears.

2. **~70k URLs in `app.ypnus.com/sitemap.xml`**  
   Giant programmatic city/ZIP inventory. Matches the GSC “Not indexed” spike on the brand.

3. **WordPress `page-sitemap.xml` includes media URLs**  
   Attachment/image URLs are leaking into the page sitemap via Rank Math — waste crawl budget.

## app.ypnus.com document root

`/home/u853154979/domains/ypnus.com/public_html/app/` holds only `.htaccess`, and
`hostinger/app-ypnus/.htaccess` is a byte-for-byte copy of it (2026-10-01). Edit the
live file in place and keep the copy in sync:

- Its last lines (`PassengerAppRoot …/hbuilds/current/nodejs` and the rest) start the
  Node app. The installer only switches the `current` symlink, so they never change;
  a file without them takes the app offline.
- Its `Content-Security-Policy` replaces the app's own. A new third-party script,
  frame or API origin has to be added there first. GA4 on the app would need
  `https://*.googletagmanager.com` in `script-src`, `https://*.google-analytics.com
  https://*.analytics.google.com https://*.googletagmanager.com` in `connect-src`,
  and `NEXT_PUBLIC_GA_ID` at build time.
- Never put an `index.html` or `robots.txt` in that folder: LiteSpeed would serve
  it instead of the app's own `/` and `/robots.txt`.

## WordPress SEO hygiene (ypnus.com)

Upload `wp-plugins/ypnus-seo-hygiene.zip` (or the folder) as a normal plugin and activate it:

- Excludes attachments from Rank Math sitemaps
- noindexes thin utility endpoints that should not compete for indexing
- Documents the marketing vs app host split in `robots.txt`
- Registers `rank_math_title` / `rank_math_description` as REST-editable fields on
  pages and posts, so the app's Website Autopilot can propose and apply Rank Math
  SEO title/description changes via `/wp-json/wp/v2/pages/{id}`

Then in Rank Math:

- Turn **off** “Attachments” in sitemap settings if still enabled
- Review `/markets/` and near-duplicate city LO pages; noindex or consolidate thin ones
- Keep conversion URLs: `/check-zip.html`, `/lo-signup.html`, `/pricing-plans/`

## WordPress Stripe webhook (ypnus.com)

Upload `wp-plugins/ypnus-stripe-webhook.zip` as a normal plugin and activate it. Configure the
signing secret and Payment Link / Price ID tier maps directly in `wp-config.php`; never commit or
paste live Stripe secrets into chat. The complete event list and sandbox verification sequence are
documented in `wp-plugins/ypnus-stripe-webhook/README.md`.

## Next.js app on Hostinger Cloud (Node.js web app)

This repo is the **product app** for `https://app.ypnus.com` on a Hostinger
**Cloud** plan. WordPress stays on `ypnus.com` for marketing/SEO. Paths below are
under `/home/u853154979/domains/ypnus.com/`.

| Setting | Value |
| --- | --- |
| Runtime | LiteSpeed Node via the Passenger lines in `public_html/app/.htaccess`; Node 20 (`/opt/alt/alt-nodejs20`) |
| App root | `app/hbuilds/current/nodejs` (the symlink the installer switches) |
| Startup file | `server.js` from the `output: "standalone"` build |
| Persistent data | `app/persistent-data` (`LOANPILOT_DATA_DIR`, set by the preamble) |
| Secrets | `app/.env`, loaded at startup by the preamble |
| `NEXT_PUBLIC_SITE_URL` | `https://app.ypnus.com` (code default) |
| `NEXT_PUBLIC_MARKETING_SITE_URL` | `https://ypnus.com` (code default) |
| `YPNUS_WP_API_BASE` | `https://ypnus.com/wp-json/ypnus/v1` (code default) |

`NEXT_PUBLIC_*` values are baked in when GitHub Actions builds the bundle, so
`app/.env` can't change them; set them in `release-build.yml` if one ever has to.

### If `npm run build` fails on Hostinger with an out-of-memory / RLIMIT_AS error

Cloud Startup (and other shared/LVE-based) hosting caps each account's virtual
address space (`RLIMIT_AS` / `ulimit -v`), separate from physical RAM and PHP's
`memory_limit`. Node/V8 reserves a large virtual address range at build time
regardless of how much it actually uses, so `next build` can hit that ceiling
even though the account has "enough" RAM on paper. This can't be raised from
SSH or any PHP-facing setting — it's an account-level LVE restriction.

Fix: never build on Hostinger. GitHub Actions builds the bundle and
`scripts/hostinger-install-release.sh` installs it (see "Deploy app.ypnus.com"
at the top of this file). Do not use Hostinger's Node.js Builds API in any form
(`deploy-next`, `deploy-prebuilt`, hPanel Deploy/Rebuild): on 2026-09-26 a
prebuilt upload through it replaced production with an old bundle and deleted
the installed releases. Those script commands are now disabled.

Runtime variables in `app/.env`:

| Variable | Value |
| --- | --- |
| `LOANPILOT_DATA_DIR` | leave out: the preamble sets `app/persistent-data` before `app/.env` loads, so a value here is ignored |
| `SESSION_SECRET` | random 32+ byte string — signs the `ypnus_session` cookie |
| `YPNUS_SSO_SHARED_SECRET` | random secret shared with the WordPress SSO handoff (see `docs/sso-handoff.md`) |
| `ADMIN_TOKEN` / `CRON_SECRET` | optional bearer secrets for machine-only endpoints (`/api/webhooks/leads`, `/api/automation/process`); `/api/analytics/summary` and `/api/revenue/summary` also accept either one **or** a valid `ypnus_session` cookie |

Stripe billing lives entirely on `ypnus.com` — see "WordPress Stripe webhook" below. There is
no `STRIPE_*` env var on this app; an earlier app-side webhook (`/api/billing/checkout`,
`/api/webhooks/stripe`) was removed in favor of it.

## Session / SSO architecture

`ypnus.com` is public marketing + MLO lead-capture only. Authenticated sessions and
dashboard routes (`/dashboard`, `/portal`, `/analytics`, `/admin`) live exclusively on
`app.ypnus.com`, gated by `src/proxy.ts` and a host-only `ypnus_session` cookie that is
never shared with `ypnus.com`. Full handoff contract: `docs/sso-handoff.md`.

## Marketing lead capture (ypnus.com → app.ypnus.com)

`ypnus.com`'s marketing forms should post directly to **`app.ypnus.com/api/demo-request`**
(CORS-enabled for `https://ypnus.com`, `OPTIONS` preflight included) rather than a new
endpoint — it already validates, rate-limits, checks territory availability, and persists
the lead. There's no need for a separate `/api/webhooks/mlo-leads`; that would just
duplicate this logic.

## Stripe billing — lives on WordPress, not this app

`ypnus.com`'s **`ypnus-stripe-webhook`** plugin (`wp-plugins/ypnus-stripe-webhook.zip`) is
the real Stripe receiver: `POST https://ypnus.com/wp-json/ypnus/v1/stripe-webhook`. It
verifies signatures, atomically claims events (idempotent under Stripe retries), resolves
the tier from Payment Link/Price metadata, provisions a WordPress user, and stores
`ypnus_tier` / `ypnus_paid_access` / `ypnus_stripe_*` on that user. See
`wp-plugins/ypnus-stripe-webhook/README.md` for the full setup (webhook secret and tier
maps go in `wp-config.php` — never in chat or source control).

An earlier app-side Stripe webhook (`/api/webhooks/stripe`, `/api/billing/checkout`) was
removed to avoid two systems processing the same Stripe events with different entitlement
state. If a future need arises for app.ypnus.com to know a user's paid tier (e.g. to gate a
dashboard feature), pass `tier` / `subscription_status` through as claims on the SSO
handoff (`docs/sso-handoff.md`) rather than re-deriving it from a second webhook.

## Not in use: Render blueprint

[`render.yaml`](../render.yaml) describes a Render.com service for this app.
Production is Hostinger: moving `app.ypnus.com` is a DNS change for the owner to
approve, and the blueprint's `/tmp` data dir doesn't keep leads across restarts.
