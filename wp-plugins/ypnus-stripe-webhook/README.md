# YPNUS Stripe Webhook

Installable WordPress plugin for the single Stripe webhook receiver at:

`POST https://ypnus.com/wp-json/ypnus/v1/stripe-webhook`

The plugin verifies Stripe signatures against the raw request body, rejects signatures outside a
five-minute window, stores atomic event and lifecycle records, provisions WordPress subscribers,
and restricts paid access when a subscription becomes delinquent or canceled.

## Install

1. Upload `ypnus-stripe-webhook.zip` in **WordPress → Plugins → Add Plugin → Upload Plugin**.
2. Activate **YPNUS Stripe Webhook**. Activation creates:
   - `{prefix}_ypnus_stripe_events`
   - `{prefix}_ypnus_stripe_lifecycle`
   - `{prefix}_ypnus_territory_locks`

   On a site where the plugin was already active before this table existed, an `init` hook
   creates it on the next page load — no deactivate/reactivate needed.
3. Add configuration to `wp-config.php` above the “stop editing” comment.
4. Add the webhook endpoint in Stripe and select the events listed below.
5. Complete a sandbox Payment Link checkout before enabling the live endpoint.

## `wp-config.php`

Never paste real Stripe secrets into source control, WordPress options, or chat.

```php
define( 'YPNUS_STRIPE_WEBHOOK_SECRET', 'whsec_REPLACE_IN_WP_CONFIG' );

define(
	'YPNUS_STRIPE_PAYMENT_LINK_TIERS',
	array(
		'plink_REPLACE_STARTER' => 'starter',
		'plink_REPLACE_PRO'     => 'pro',
		'plink_REPLACE_ELITE'   => 'elite',
	)
);

define(
	'YPNUS_STRIPE_PRICE_TIERS',
	array(
		'price_REPLACE_STARTER' => 'starter',
		'price_REPLACE_PRO'     => 'pro',
		'price_REPLACE_ELITE'   => 'elite',
	)
);
```

During a Stripe signing-secret rotation, configure both secrets temporarily:

```php
define(
	'YPNUS_STRIPE_WEBHOOK_SECRETS',
	array(
		'whsec_CURRENT',
		'whsec_NEXT',
	)
);
```

Remove the retired secret after Stripe's rotation grace period.

## Stripe metadata

Each Payment Link must include:

```text
ypnus_tier = starter | pro | elite
```

For a Payment Link that intentionally starts with no payment because of a trial, also include:

```text
ypnus_trialing = true
```

Unknown tiers, one-time payment sessions, missing customer/subscription identifiers, and unverified
payments fail closed.

To lock an exclusive ZIP territory to the buyer at the moment of payment, pass the ZIP either as
Payment Link metadata:

```text
ypnus_zip = 90210
```

or as the Checkout Session's `client_reference_id` (metadata takes priority if both are present).
A session with no recognizable 5-digit ZIP is provisioned normally; territory locking is simply
skipped for it.

## Required Stripe events

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.paid`

## Entitlement metadata

The plugin stores these fields on the WordPress user:

- `ypnus_tier`
- `ypnus_stripe_customer_id`
- `ypnus_stripe_subscription_id`
- `ypnus_subscription_status`
- `ypnus_paid_access` (`1` only for `active` or `trialing`)

Downstream account authorization must check `ypnus_paid_access`; the WordPress `subscriber` role
alone does not represent a paid entitlement.

## ZIP territory locking

On a paid `checkout.session.completed` (or its async-payment-succeeded follow-up) that carries a
ZIP, the plugin claims that ZIP exclusively for the buyer in `{prefix}_ypnus_territory_locks`. The
table's `UNIQUE KEY` on `zip_code` is the lock itself — the first webhook delivery to insert a row
for a ZIP wins it; a concurrent delivery for the same ZIP gets zero affected rows instead of an
error. Re-delivery of an event already claimed by the same user is a no-op (idempotent under
Stripe retries).

Outcomes are stored on the user:

- `ypnus_locked_zip` — the ZIP this user successfully locked.
- `ypnus_territory_conflict` — set instead of `ypnus_locked_zip` when the ZIP was already locked to
  a different user. Payment has already moved via Stripe by this point, so a conflict is never
  auto-resolved; it needs a manual refund or reassignment, same as an `account_mapping_conflict`.

Availability can be checked without exposing who holds a ZIP:

```
GET /wp-json/ypnus/v1/territory-status?zip=90210
```

```json
{ "zip": "90210", "available": false }
```

## Verification

```bash
php -l wp-plugins/ypnus-stripe-webhook/ypnus-stripe-webhook.php
php wp-plugins/ypnus-stripe-webhook/tests/ypnus-stripe-webhook.test.php
```

The harness covers signature rotation, replay rejection, invalid signatures, tier resolution,
unknown-tier failure, atomic event claims, lock release, paid checkout provisioning, trial
provisioning, payment failure, cancellation, paid-access restriction, and ZIP territory locking
(claim, idempotent re-claim, conflict, race-losing conflict, and the availability endpoint).
