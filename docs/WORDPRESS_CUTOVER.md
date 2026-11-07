# Moving ypnus.com off WordPress (Nov 2026)

Status: **code ready on this branch, nothing applied.** Every live step below needs the
owner's yes first. WordPress stays live and untouched until step 6.

## What the app now owns

| Was WordPress | Now in this app |
| --- | --- |
| Login / signup (`ypnus/v1` + SSO handoff) | Emailed one-time sign-in links: `/login` → `/api/auth/email-link` → `/login/verify` → `/api/auth/email-link/verify`. No passwords stored or migrated. |
| User creation on checkout | Stripe webhook (`/api/webhooks/stripe`) creates the account for the paying email. |
| Tier / subscription status | `src/lib/accounts.ts` `entitlementForEmail`, read from the Stripe-fed subscription ledger at sign-in. |
| ZIP territory ledger | `TERRITORY_SOURCE=local` makes `/api/territory/check` (and Cerebro) answer from the app's paid ledger (active + trialing). |

The WordPress SSO callback (`/api/auth/callback`) keeps working during the switch and maps
WordPress's old tier names to the new lineup.

## Plans (Stripe)

Done in PR 120: the November 2026 Payment Links (Pro $99, Growth $199, Exclusive $299) are the
checkout defaults in `src/lib/checkout.ts`, and `src/lib/stripe-webhook.ts` maps their tier names.
Tier ids stay stable (`growth` = Pro, `pro` = Growth, `elite` = Exclusive).

## Accounts and ZIP claims

Nothing to migrate: the owner confirmed on Nov 7 that WordPress holds no customer accounts and no
claimed ZIPs. New accounts are created by the Stripe webhook or on first sign-in.

## Cutover steps (each needs a yes)

The new server itself (fresh EC2, Elastic IP, certificates) is built by
`aws/bootstrap/new-server.sh` (PR 122). These steps run on that server.

1. **Stripe:** done in PR 120 (new Payment Links are live defaults).
2. **Server settings:** add to `/etc/ypnusa/app.env`, then `systemctl restart ypnusa`:
   ```
   RESEND_API_KEY=...            # sign-in emails; without it /login answers "email unavailable"
   RESEND_FROM_EMAIL=YPN USA <login@ypnus.com>
   ADMIN_EMAILS=<owner email>
   STRIPE_WEBHOOK_SECRET=whsec_... # from the new Stripe endpoint in step 6
   TERRITORY_SOURCE=local
   ```
3. **Copy media** while WordPress still answers (read-only; 151 files the app links to):
   ```
   cd /opt/ypnusa/current && sudo node scripts/copy-wordpress-media.mjs           # dry run, lists files
   cd /opt/ypnusa/current && sudo node scripts/copy-wordpress-media.mjs --apply   # into /var/www/ypnus-uploads
   ```
   Check `/var/www/ypnus-uploads/manifest.json` shows no failures.
4. **Serve media locally:** in `/etc/httpd/conf.d/zz-ypnus-com.conf`, replace the two
   `/wp-content/` proxy lines with:
   ```
   Alias /wp-content/uploads/ /var/www/ypnus-uploads/
   <Directory /var/www/ypnus-uploads>
       Require all granted
       Options -Indexes
       Header set Cache-Control "public, max-age=31536000, immutable"
   </Directory>
   ```
   then `apachectl configtest && systemctl reload httpd`.
5. **Deploy and check:** install this branch's release (`scripts/aws-install-release.sh`) and
   confirm `/api/health`, a ZIP check, a test sign-in email and one image under `/wp-content/uploads/`.
6. **Stripe webhook:** add the endpoint `https://ypnus.com/api/webhooks/stripe` in Stripe
   (events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`), put its signing
   secret in `STRIPE_WEBHOOK_SECRET`, then disable the old WordPress endpoint.
7. **Point ypnus.com at the app** (DNS), remove the remaining WordPress routes from the front door,
   and keep a WordPress backup offline for 30 days before deleting it.

## Known limits

- Sessions last 12 hours and carry the plan read at sign-in; an upgrade shows after the next sign-in.
- The store is still the single-writer JSON file, so the app must stay at one server process.
- Sign-in link requests are limited per email (5 an hour), not yet per IP.
