# Launching ypnus.com on the app server

Status (2026-11-05): **code ready in PR 120, nothing live.** WordPress is still serving
ypnus.com. Every step marked **YES** changes something real and needs David's explicit go-ahead
in the ypnus channel first. Steps marked *repo* are already done in PR 120.

## How it fits together

```
ypnus.com ──DNS──▶ AWS host 18.223.107.93 (i-0ad200fc61f4d39f5, us-east-2)
                    Apache front door  (aws/apache/zz-ypnus-com.conf.tmpl)
                    ├─ /wp-json/, /wp-admin/, /wp-content/, /wp-login.php,
                    │  lo-*.html, check-zip.html, pricing.html, onboarding.html ──▶ WordPress (Hostinger, kept running)
                    └─ everything else ──▶ Next.js app on 127.0.0.1:3000 (the same app as app.ypnus.com)
```

Keeping `/wp-json/` on WordPress during launch means signups, the Stripe webhook, the ZIP
ledger and logins keep working exactly as today, **as long as WordPress is up**. On 2026-11-05
WordPress on Hostinger was reported down: then those WordPress routes return errors after the
switch, checkout still works (buttons go straight to Stripe), ZIP checks fall back to the app's
own data, and new subscribers are charged but get no login until WordPress is back or phase 2
(PR 119) lands. Stripe keeps the subscription either way.
Moving those into the app is phase 2 (PR 119), done afterwards with no DNS change.

## What PR 120 already does (*repo*)

| Item | Where |
| --- | --- |
| 4 new pages: `/agents/david-j-moore-mba`, `/editorial-policy`, `/research-methodology`, `/ypn-usa-partner-suite` | `src/content/wp-import/pages.json`, `src/app/agents/[slug]` |
| 23 upgraded pages: 10 comparisons, founder pages, CRM wording, hand-fixed pricing | same |
| Author box + Person / Article / FAQPage / WebPage JSON-LD; "Keep exploring" links on 49 pages | `src/components/wp-imported-page.tsx` |
| Old plan names and prices in imported pages and posts → Free $0 / Pro $99 / Growth $199 / Exclusive $299 (0 left) | `src/content/wp-import/*.json` |
| 63 more 301 redirects (attachment pages, old URLs) | `src/content/wp-import/redirects.json` |
| Repeatable sync from the rebuild | `cd sites/ypnus-com && npm ci && node scripts/export-to-app.js` |

## Open items before go-live

| # | Item | Owner | Blocks launch? |
| --- | --- | --- | --- |
| 1 | ~~Native pages show old prices~~ **done in PR 120**: home, `/pricing`, schema offers, OG image and claim page show Pro $99 / Growth $199 / Exclusive $299. Tier ids are unchanged (id `growth` = Pro, `pro` = Growth, `elite` = Exclusive) so existing subscriptions keep working. | *repo* | — |
| 2 | ~~Stripe links charge old prices~~ **done**: new monthly Payment Links (15-day trial, `ypnus_tier` + `pricing=2026-11`) are the default checkout targets in `src/lib/checkout.ts`; the webhook maps their names to tier ids (`src/lib/stripe-webhook.ts`). | *repo* + Stripe (done 2026-11-05) | — |
| 3 | **New-subscriber logins.** Today WordPress creates the account when Stripe pays. That keeps working at launch because `/wp-json/` stays on WordPress. Only when WordPress is retired must the app take over (PR 119: Stripe webhook + emailed sign-in links). | Phase 2 | No |
| 4 | **ZIP territory ledger** stays in WordPress (`/wp-json/ypnus/v1/zip-check`, already proxied). Phase 2 moves it with PR 119's export/import scripts. | Phase 2 | No |
| 5 | **Media** (`/wp-content/uploads`) is proxied to WordPress. Copy to the server or S3 only before WordPress is shut down. | Phase 2 | No |
| 6 | **Home page design.** David likes the staging.ypnus.com home page; it isn't reachable from the build environment, so it isn't ported yet. Point to its source (repo/branch/host) and it becomes a follow-up. | David | No (current app home page is used) |
| 7 | **WordPress origin IP** (Hostinger) for the front door's `/etc/hosts` pin. Read it from hPanel or `dig +short ypnus.com` *before* DNS changes. | David / read-only lookup | Yes |
| 8 | DNS: where ypnus.com's DNS is hosted (Hostinger is assumed) and current TTL. | Read-only lookup | Yes |

## Go-live steps (in order)

Each step says what it changes. Stop and roll back at any failed check.

1. **Merge PR 120** (YES). *Changes:* main branch only. `release-build.yml` publishes release
   `app-build-<sha7>`. Nothing live changes.
2. **Deploy the release to the AWS host** (YES). On the host via SSM Session Manager:
   ```bash
   curl -fsSL -o aws-install-release.sh https://raw.githubusercontent.com/davidjmoorembaypn/ypnusa/main/scripts/aws-install-release.sh
   bash aws-install-release.sh
   curl -s https://app.ypnus.com/api/health
   ```
   *Changes:* app.ypnus.com runs the new build (auto-rollback if health fails). ypnus.com is untouched.
3. **Install the front door without traffic** (YES). On the host, from a checkout of `aws/apache/`:
   ```bash
   sudo bash install-front-door.sh <wordpress-origin-ip>
   curl -ksI --resolve ypnus.com:443:127.0.0.1 https://ypnus.com/
   ```
   *Changes:* adds the ypnus.com Apache vhost (self-signed placeholder cert) and an `/etc/hosts`
   pin. No DNS change; app.ypnus.com's vhost is not touched; restores itself if `configtest` fails.
4. **Smoke test through the front door before DNS** (no change). From the host:
   ```bash
   for p in / /pricing /vs/bonzo /editorial-policy /agents/david-j-moore-mba /blog /wp-json/ypnus/v1/zip-check/93291 /lo-signup.html /sitemap.xml /robots.txt; do
     printf '%s ' "$p"; curl -ks -o /dev/null -w '%{http_code}\n' --resolve ypnus.com:443:127.0.0.1 "https://ypnus.com$p"; done
   curl -ksI --resolve ypnus.com:443:127.0.0.1 https://ypnus.com/old-wordpress-slug/ | head -3   # expect 301/308
   ```
   Expect 200 on pages, 301/308 on old URLs, WordPress JSON on `/wp-json/...`.
5. **Lower DNS TTL** to 300 seconds a day ahead (YES). *Changes:* TTL only.
6. **Point DNS at the AWS host** (YES). Set `A ypnus.com → 18.223.107.93` and `www` (A or CNAME to
   ypnus.com). Leave MX and email records alone. *Changes:* public traffic for ypnus.com moves to the app.
7. **Issue the real certificate** right after DNS resolves to the host (YES):
   ```bash
   sudo bash issue-cert.sh <wordpress-origin-ip>
   ```
   *Changes:* Let's Encrypt cert for ypnus.com + www. Until this runs (a few minutes), browsers
   see a certificate warning, so run it immediately after step 6 propagates.
8. **Live smoke test** (no change): repeat step 4 against `https://ypnus.com` without `--resolve`,
   plus a test signup on the free plan and a ZIP check. Watch `/var/log/httpd/ypnus-com-error.log`.
9. **Search Console** (no change to the site): submit `https://ypnus.com/sitemap.xml`.

## Rollback

- **Fast (DNS):** point `ypnus.com` and `www` back to the WordPress (Hostinger) IP noted in item 7.
  WordPress kept running the whole time, so it serves again as soon as DNS updates (TTL 300 = ~5 min).
- **App only:** `bash aws-install-release.sh app-build-<previous-sha7>` reinstalls the previous build.
- **Front door only:** `install-front-door.sh` keeps timestamped backups of `/etc/hosts`; delete
  `/etc/httpd/conf.d/zz-ypnus-com.conf` and `systemctl reload httpd` to remove the vhost.

## Phase 2: retire WordPress (after launch is stable)

Follow `docs/WORDPRESS_CUTOVER.md` from PR 119: new Stripe prices with `ypnus_plan` metadata,
sign-in email (Resend), export/import accounts and ZIP locks, `TERRITORY_SOURCE=local`, point the
Stripe webhook at `https://ypnus.com/api/webhooks/stripe`, copy `/wp-content/uploads`, then remove
the WordPress routes from the front door. Keep a WordPress backup offline for 30 days.
