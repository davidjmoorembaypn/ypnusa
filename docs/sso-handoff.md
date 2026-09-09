# SSO handoff: ypnus.com → app.ypnus.com

## Architecture

`ypnus.com` (WordPress) is the public marketing and MLO lead-capture site. It should not
issue or hold its own dashboard session — `app.ypnus.com` (this repo) is the only host
that sets or reads the app's session cookie (`ypnus_session`, host-only, `httpOnly`,
never shared with `ypnus.com` via a cookie `domain`).

WordPress remains the identity source (its existing `ypnus/v1` login / signup / password
reset / MLO account creation endpoints keep doing credential verification). What moves is
the *session*: after WordPress verifies who someone is, it redirects the browser to
app.ypnus.com's SSO callback instead of setting its own logged-in state.

```
Browser → ypnus.com/wp-json/ypnus/v1/login (verify credentials)
        → 302 to https://app.ypnus.com/api/auth/callback?...&sig=...
        → app.ypnus.com verifies the signature, mints ypnus_session, 302 to /dashboard
```

## Contract WordPress must implement

After a successful login, signup, or MLO account creation, redirect the browser to:

```
GET https://app.ypnus.com/api/auth/callback
  ?email=<user email, urlencoded>
  &sub=<stable WordPress user id>
  &role=mlo|admin
  &iat=<unix seconds when the token was issued>
  &next=<optional relative path into the app, defaults to /dashboard>
  &tier=<free|starter|growth|pro|elite, optional>
  &subscriptionStatus=<active|trialing|past_due|canceled|none, optional>
  &trialEndsAt=<ISO timestamp, optional — only meaningful when subscriptionStatus=trialing>
  &sig=<base64url HMAC-SHA256, see below>
```

`tier`/`subscriptionStatus`/`trialEndsAt` are the entitlement claim — how app.ypnus.com
learns a user's paid tier without a second Stripe webhook (see "Billing" below). They're
optional on the URL, but **part of the signed message even when omitted** (as empty
strings) — an entitlement claim must be exactly as forgery-resistant as the identity
claim, since it gates paid capability. Omitting them is always safe (app.ypnus.com's
`resolveEntitlement` treats "no claim" as `free`); it is never safe to send them unsigned.

`sig` is computed over the pipe-joined string
`email|sub|role|iat|next|tier|subscriptionStatus|trialEndsAt` (empty string for any
omitted field) with a secret shared between both hosts:

```php
$message = implode('|', [$email, $sub, $role, $iat, $next, $tier, $subscription_status, $trial_ends_at]);
$sig = rtrim(strtr(base64_encode(hash_hmac('sha256', $message, $shared_secret, true)), '+/', '-_'), '=');
// $tier, $subscription_status, $trial_ends_at are '' (empty string) when not applicable —
// never omit them from the signed message itself, only from the query string.
```

The token is valid for 5 minutes from `iat` — treat it as a one-time redirect, not a
durable credential.

### Where WordPress gets `tier`/`subscriptionStatus`/`trialEndsAt`

Directly from the same user meta the `ypnus-stripe-webhook` plugin already writes on
every Stripe event: `ypnus_tier`, `ypnus_subscription_status`
(`ypnus-stripe-webhook.php`'s `ypnus_stripe_apply_entitlement`). No new data to compute
or store — just read those three fields (`trialEndsAt` isn't currently stored by that
plugin; add it alongside `ypnus_tier` if/when trial-end display is wanted server-side,
or omit it and let Stripe's own trial email reminders cover that) when building the
redirect.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `YPNUS_SSO_SHARED_SECRET` | Both hosts | HMAC secret for the handoff. Until this is set on app.ypnus.com, `/api/auth/callback` refuses every handoff (fails closed — there is no insecure fallback). |
| `SESSION_SECRET` | app.ypnus.com | Signs the `ypnus_session` cookie. If unset, a random per-process secret is used (fine for local dev; sessions won't survive a restart or work across multiple instances, so set this explicitly in production). |

## What's already built on app.ypnus.com

- `src/lib/session.ts` — signed session token (HMAC-SHA256, host-only cookie), now
  carrying `tier`/`subscriptionStatus`/`trialEndsAt` alongside identity.
- `src/lib/auth.ts` — `createSession` / `destroySession` / `getSession` (server-only),
  plus `getEntitlement()` — the current request's resolved entitlement.
- `src/lib/sso.ts` — verifies the handoff token described above, including the
  entitlement claim.
- `src/lib/entitlements.ts` — `resolveEntitlement(session)`, tier-capability checks
  (`tierAtLeast`, `hasZipCapacity`, `automationDailyLimitFor`,
  `canReceivePaidLeadDelivery`), and page/API gates (`requireTier`,
  `requireTierOrError`). Fails closed to `free` for any session with no verified claim —
  see that file's own doc comment for the full reasoning.
- `src/proxy.ts` — optimistic gate on `/dashboard`, `/portal`, `/analytics`, `/admin`;
  redirects unauthenticated visitors to `/login`.
- `GET /api/auth/callback` — the SSO callback; now also seeds the session's entitlement
  claim from the handoff.
- `POST /api/auth/logout`, `GET /api/auth/session`.
- `POST /api/auth/dev-login` — local-dev-only session issuer (404s when
  `NODE_ENV=production`), now accepting optional `tier`/`subscriptionStatus` in its
  request body so the dashboard's tier-gated features can be exercised with
  `npm run dev` without a live WordPress handoff.

## Billing

Stripe billing/entitlement is handled entirely by `ypnus.com`'s `ypnus-stripe-webhook`
plugin (see `hostinger/README.md`) — it is not part of this handoff, and app.ypnus.com
has no Stripe SDK, checkout-session, or webhook code of its own (by design — see
`src/lib/checkout.ts`'s doc comment). The `tier`/`subscription_status` extra claims on
the SSO handoff (above) are how app.ypnus.com learns a user's paid tier without a
second webhook. **This is now implemented app-side and ready** — the only remaining
step is WordPress actually sending those two fields on the redirect (see "Not yet done"
below); once it does, every `entitlements.ts` check activates with no further app code
change.

## Not yet done (needs a live WordPress change)

The WordPress side (`ypnus-mlo-toolkit` plugin, which currently registers
`/wp-json/ypnus/v1/login`, `/request-reset`, `/reset-password`, `/profile`,
`/create-mlo`) has not been changed. It still owns credential verification; it does not
yet redirect into the callback above. Wiring that redirect is a production change to a
live, active plugin and should happen as its own reviewed step once `YPNUS_SSO_SHARED_SECRET`
is set on both hosts.

Also not yet deployed: `wp-plugins/ypnus-stripe-webhook/ypnus-stripe-webhook.php` was
updated in this repo to allow the new `growth` tier
(`YPNUS_STRIPE_ALLOWED_TIERS`), but that change only takes effect once the updated
plugin file is re-uploaded to the live WordPress site — this repo change alone does
not touch production. Until it's deployed, a Stripe Payment Link tagged
`ypnus_tier = growth` will fail closed (`tier_unresolved`) on the live webhook.
