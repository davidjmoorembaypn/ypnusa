# WordPress live-site change log — ypnus.com homepage

This log tracks the one approved, controlled live-WordPress action taken so
far: preparing a replacement homepage for review. **The live homepage has
not been switched.** ypnus.com still serves the original homepage today.

## Status: paused for your review — nothing live has changed yet

| | |
| --- | --- |
| Old (current, live) homepage | Page ID **1829**, slug `home`, title "Home" |
| New candidate homepage | Page ID **5340**, slug `ypnus-home-ai-lead-growth`, status **draft** (not public, not linked, not the homepage) |
| `page_on_front` setting | Still **1829** — unchanged |
| Live change made | **No** |

## What was done

1. Connected to ypnus.com via the WPVibe MCP tool (administrator access,
   confirmed live via `site_info`).
2. Captured the before-state: `GET /wp/v2/settings` → `page_on_front: 1829`;
   `GET /wp/v2/pages/1829` → slug `home`, title "Home", status `publish`.
3. Drafted a new page, **"YPNUS Home - AI Lead Growth"** (page ID 5340),
   covering the requested 10 sections (Hero, Problem, YPNUS Solution, Lead
   Types, AI Assistant, Website Autopilot, How It Works, Trust/Compliance,
   FAQ, Final CTA) with the requested headline/subheadline/CTA copy, using
   the `POST /wp/v2/pages` REST endpoint with `status: "draft"` — reversible
   and invisible to the public (no public link, not the homepage).
4. Did **not** publish it and did **not** change `page_on_front`. Stopped
   here for review — see "Open items" below.

## Why this stopped short of going live

The live homepage (ID 1829) already has an established, working structure
that the generic requested messaging would otherwise replace:

- **Exclusive ZIP-territory positioning** ("one loan officer per ZIP") is
  the site's core differentiator throughout its existing copy and pricing
  tiers — not present in the requested subheadline. I kept the requested
  subheadline verbatim in the hero, but added ZIP-exclusivity back into the
  "YPNUS Solution" section body so the new page doesn't misrepresent the
  product.
- **A live pricing table with real Stripe checkout links** (`buy.stripe.com/...`)
  lives in the current homepage content. The requested spec didn't ask for
  a pricing section, so the new page links out to `/pricing-plans/` instead
  of reproducing (or dropping) the Stripe links directly — touching payment
  content directly felt outside "homepage content only, no payment settings."
- I reused the real NMLS #787257 / DRE #01852847 / bio facts verbatim from
  the live page rather than inventing anything, and added one standard
  disclaimer line ("No commitment to lend; not a guarantee of loan
  approval") to the final CTA section — new wording, called out here since
  the hard rules said not to change legal/NMLS/license claims.
- **No browser/screenshot tool is available in this session.** I cannot
  visually verify "only one chatbot bubble appears" as requested — I can
  only confirm the Meow Apps / AI Engine chatbot plugins
  (`ai/ai.php`, `ai-engine/ai-engine.php`) are still installed/active and
  that nothing in this change touched plugin settings.
- Site's AI Engine plugin appears to auto-rewrite "YPNUS" → "YPN USA" in
  rendered output (visible in the new draft's `content.rendered` vs.
  `content.raw`) — a pre-existing site behavior, not something this change
  introduced.

## Open items (needs a decision before anything goes live)

- [ ] Review the draft at page ID 5340 (visible in wp-admin while signed
      in, or via `GET /wp/v2/pages/5340` — it is not publicly reachable
      while in draft status).
- [ ] Confirm the ZIP-exclusivity/pricing-link/disclaimer decisions above,
      or request edits.
- [ ] Confirm who verifies the single-chatbot-bubble requirement, since no
      browser tool was available this session.
- [ ] Explicit go-ahead to (a) publish page 5340, and (b) set it as the
      homepage (`PUT /wp/v2/settings {"page_on_front": 5340}`).

## Rollback instructions

**Nothing to roll back yet** — the live homepage was never changed.

If the page is later published and set as homepage, to fully revert:

1. Restore the old homepage: `PUT /wp/v2/settings` with
   `{"page_on_front": 1829}` (WPVibe `rest_api` PUT, or WordPress admin →
   Settings → Reading → "Your homepage displays" → select "Home").
2. Optionally move the new page (ID 5340) back to draft or trash it —
   trashing is non-destructive (WordPress moves to trash, not permanent
   delete).
3. No plugin, theme, DNS, Hostinger, payment, or chatbot setting was ever
   touched, so no other rollback is needed regardless of outcome.
