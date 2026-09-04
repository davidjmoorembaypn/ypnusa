# YPNUS Trust & Schema

Ships several items from the commercial-readiness audit as code instead of manual
dashboard edits — useful when WordPress REST/application-password access isn't
available for a live edit, or just to keep this configuration in version control.

## Install

Upload this folder (or `wp-plugins/ypnus-trust-and-schema.zip`) as a normal plugin
in WP Admin → Plugins → Add New → Upload Plugin, then activate it. No configuration
needed — everything below is derived from `home_url()` and the constants at the top
of the file.

## What it does

1. **JSON-LD schema** — Organization, ProfessionalService (Central Valley, CA),
   WebSite, and SoftwareApplication (on `/pricing-plans/`). Merges into Rank Math's
   own schema graph via the `rank_math/json_ld` filter when Rank Math is active, so
   it won't be stripped on save or fight Rank Math's generated schema. Falls back to
   a raw `<script type="application/ld+json">` in `wp_head` if Rank Math isn't active.
2. **NMLS footer disclosure** — B2B framing (licensed loan officers, not consumer
   borrowers) via `wp_footer`, so it renders on every front-end template regardless
   of the active theme or page builder.
3. **Scoped CORS** — allows `https://app.ypnus.com` to call the `ypnus/v1` REST
   namespace (e.g. `zip-check`) client-side. Scoped to that one namespace and that
   one origin only; nothing else on the REST API is affected.
4. **HSTS** — `Strict-Transport-Security` on every HTTPS front-end response, as a
   belt-and-suspenders alongside the hPanel "Force HTTPS + HSTS" toggle. Mirrors the
   header already enforced at the `app.ypnus.com` Next.js origin.
5. **Canonical host redirect** — 301s any request on a host that doesn't match
   WordPress's own configured `home_url()` to the canonical host, in whichever
   direction (www vs non-www) WordPress is actually configured for. It reads the
   site's own setting rather than hardcoding a direction, so it can't fight
   whatever's already configured in Settings → General.

## Overrides

Define these in `wp-config.php` before this plugin loads if the defaults need to
change:

- `YPNUS_TRUST_NMLS_ID` (default `787257`)
- `YPNUS_TRUST_LEGAL_NAME` (default `YPN INC`)
- `YPNUS_TRUST_APP_ORIGIN` (default `https://app.ypnus.com`)

## What this does NOT replace

- Cookie consent banner (install Complianz or CookieYes — real consent logging
  needs a dedicated plugin, not a hand-rolled one).
- Privacy Policy / Terms of Service page content.
- LiteSpeed Cache / CWV dashboard toggles.
- DNS, SSL certificate issuance, and Cloudflare redirect-rule cleanup.
- Stripe Dashboard webhook event subscription and Payment Link tier metadata.

See the readiness blueprint for those — they're dashboard-only by nature.
