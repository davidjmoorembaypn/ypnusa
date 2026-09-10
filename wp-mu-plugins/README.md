# WordPress mu-plugins — prepared, NOT deployed

Everything in this directory is a **prepared artifact**, written and tested from within the
`ypnusa` app repo. **None of it has been uploaded to the live `wp-content/mu-plugins/` directory
on ypnus.com.** ChatGPT is handling the live WordPress side this round — these files exist so
that work has an exact, reviewed starting point instead of being re-derived from scratch or
guessed at live.

Each file corresponds 1:1 to a same-named file already live at
`wp-content/mu-plugins/<name>.php` on ypnus.com, confirmed present via a live filesystem read
during the commercial-readiness audit. Diff before uploading — do not assume the live file is
still byte-identical to what was read.

## Files

| File | Replaces (live) | What changed |
|---|---|---|
| `ypnus-lo-account-bridge.php` | *(new — does not exist live)* | Links each `wp_ypnus_lo_accounts` row to one `wp_users` row via a new nullable `wp_user_id` column, so a Stripe purchase has a code path back to the account the buyer actually logs in with. |
| `ypnus-app-sso.php` | live v1.x (5-field signature, hardcoded `role='mlo'`) | Signs the new 8-field message (adds `tier`/`subscriptionStatus`/`trialEndsAt`), resolves real role via the bridge. app.ypnus.com already accepts both signature formats, so deploy order vs. the app doesn't matter. |
| `ypnus-brand-config.php` | live v2.2.0 | `ypn_pricing_tiers()` gains Growth, Pro/Elite prices corrected to $199/$299, `paid_stripe_trial_days` corrected 0→15, the old 14-day free-preview mechanism retired, the `<th>Growth</th>`→`<th>Pro</th>` landmine removed. |
| `ypnus-commercial-optimize.php` | live v2.1.0 | Pricing-page CTA banner now renders from `ypn_pricing_tiers()`/`ypn_stripe_urls()` instead of its own hardcoded (and already-stale) copy of tier names/prices/Stripe links. |
| `ypnus-supabase-signup.php` | live v1.1.0 | `/signup-config`'s `intake_page_url` now points at `https://app.ypnus.com/embed/intake` instead of the legacy static page. The legacy page is left reachable, not deleted or redirected. |

## Deployment order that avoids breaking live login

1. `ypnus-lo-account-bridge.php` first (new file, inert on its own — nothing calls it yet).
2. `ypnus-app-sso.php` (safe immediately: falls back to the old hardcoded-role, no-entitlement
   behavior if the bridge somehow isn't present, and app.ypnus.com accepts either signature
   format already).
3. `ypnus-brand-config.php`, `ypnus-commercial-optimize.php`, `ypnus-supabase-signup.php` — any
   order, no interdependency between these three beyond `ypnus-commercial-optimize.php`
   requiring `ypn_pricing_tiers()`/`ypn_stripe_urls()` to already be defined (both mu-plugins
   load every request, so load order within `mu-plugins/` doesn't actually matter — PHP just
   needs the functions defined before they're called at request time, which `add_filter`'s
   deferred execution guarantees regardless of file load order).

None of this requires a matching app.ypnus.com deploy first or after — the app already accepts
both old and new SSO signature formats specifically so these two sides can ship independently.

## Known gap this round does not close

**A real Stripe Payment Link for the Growth tier does not exist yet.** `ypn_stripe_urls()['growth']`
is intentionally left as `''` — create the Payment Link in the Stripe Dashboard (`ypnus_tier=growth`
metadata, see `wp-plugins/ypnus-stripe-webhook/README.md`) and set it via the `ypnus_stripe_urls`
option (or a `wp-config.php` override) before Growth can actually be purchased. No file in this
directory invents that URL.
