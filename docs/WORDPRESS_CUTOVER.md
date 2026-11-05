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

Free $0 · Pro $99 · Growth $199 · Exclusive $299, each with one protected ZIP and a 15-day trial.
New Stripe prices should carry `metadata.ypnus_plan` = `pro` | `growth` | `exclusive` on both the
price and the Payment Link. Older links tagged `metadata.ypnus_tier` still resolve, by price
point: growth $99.99 → Pro, pro $199.99 → Growth, elite $299.99 → Exclusive.

## Cutover steps (each needs a yes)

1. **Stripe:** create the three new monthly prices + Payment Links (with `ypnus_plan` metadata
   and a 15-day trial). Put the link URLs in `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO|GROWTH|EXCLUSIVE`
   and price ids in `STRIPE_PRICE_ID_PRO|GROWTH|EXCLUSIVE`.
2. **Email:** set `RESEND_API_KEY` (and `RESEND_FROM_EMAIL`) so sign-in links send; set
   `ADMIN_EMAILS` to the owner's email.
3. **Export from WordPress (read-only):**
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
