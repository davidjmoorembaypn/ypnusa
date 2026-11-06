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
Tier ids stay stable (`growth` = Pro, `pro` = Growth, `elite` = Exclusive), so WordPress records
import without renaming.

## Cutover steps (each needs a yes)

1. **Stripe:** done in PR 120 (new Payment Links are live defaults).
2. **Email:** set `RESEND_API_KEY` (and `RESEND_FROM_EMAIL`) so sign-in links send; set
   `ADMIN_EMAILS` to the owner's email.
3. **Export from WordPress (read-only).** Needs WordPress's database to be reachable; it was
   reported down on Nov 5, so this may have to run against a Hostinger backup restored first:
   `wp eval-file scripts/wordpress-export-accounts.php --path="$HOME/domains/ypnus.com/public_html" > ypnus-wp-export.json`
4. **Import into the app:** on the app server, with the app's `LOANPILOT_DATA_DIR`:
   `npx tsx scripts/import-wordpress-accounts.ts ypnus-wp-export.json` (dry run), review warnings,
   then add `--apply`. Delete the export file afterwards.
5. **Switch the ZIP source:** set `TERRITORY_SOURCE=local`, deploy this branch's release
   (`scripts/aws-install-release.sh`), and confirm `/api/health`, a ZIP check and a test sign-in.
6. **Point ypnus.com at the app** (DNS + certificate on the AWS host), then retire the WordPress
   Stripe webhook endpoint in Stripe so only `https://ypnus.com/api/webhooks/stripe` remains.
   Keep WordPress backed up and offline for 30 days before deleting it.

## Known limits

- Sessions last 12 hours and carry the plan read at sign-in; an upgrade shows after the next sign-in.
- The store is still the single-writer JSON file, so the app must stay at one server process.
- Sign-in link requests are limited per email (5 an hour), not yet per IP.
