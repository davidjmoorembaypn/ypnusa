# Live WordPress snapshots

Byte-for-byte copies of production plugin files that have drifted from the
versions in this repo. Keep them until someone reconciles the two; don't deploy
from here.

| File | Live path | Drift |
| --- | --- | --- |
| `ypnus-stripe-webhook.live-2026-09-24.php` | `wp-content/plugins/ypnus-stripe-webhook(1)/ypnus-stripe-webhook.php` (v2.1.1) | Live has the LO-account-bridge hooks (`ypnus_lo_act_*`, `ypnus_lo_resolve_zip`), Starter removed from allowed tiers, and Payment Link trials detected by `no_payment_required` alone. The repo has `trial_ends_at` propagation that live lacks. Both carry the 2026-09-24 fix: the current price wins over Payment Link metadata when resolving a subscription tier. |
