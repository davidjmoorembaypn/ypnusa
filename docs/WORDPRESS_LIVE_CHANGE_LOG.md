# WordPress live-site change log

Every entry here documents a change made directly to the live `ypnus.com`
WordPress site (not this repo's Next.js app) via the connected WPVibe/Novamira
MCP tooling. Entries are append-only, newest last is fine — the point is a
durable record of what changed, why, and how to undo it.

## 2026-09-02 — Homepage (page 1829) CSS/layout stabilization

**Reported symptom:** live `https://ypnus.com` homepage looked visually
malformed (possible CSS/layout/theme issue).

**Root causes found (both on the live homepage, page ID 1829 — `home`, the
confirmed `page_on_front`):**

1. **LiteSpeed's combined/minified CSS asset was 404ing at the hosting
   level.** The page's `<head>` referenced
   `wp-content/litespeed/css/0fb3e04b31382eae6478e6ff65ab977a.css`; fetching
   it returned Hostinger's own "This Page Does Not Exist" error page instead
   of CSS — a stale cache reference to a combined file that no longer existed
   on disk.
2. **The page's own inline `<style>` block (the `.ypn-b` design-system CSS
   embedded directly in `post_content`) was corrupted by WordPress's
   `wpautop` filter.** At some earlier edit, raw HTML/CSS was saved into
   `post_content` without being protected in a Custom HTML/`wp:html` block,
   so `wpautop` injected literal `</p>`, `<p>`, and `<br />` fragments
   directly into the CSS source — including right after the very first
   rule — breaking CSS parsing for a large share of the homepage's custom
   styling (hero, buttons, cards, pricing, FAQ, bio section, etc.).

**Fix applied (scoped to page 1829 only):**

1. Captured the exact before-state of `post_content` (`content.raw` via
   `GET /wp/v2/pages/1829?context=edit`) before making any change.
2. Extracted the single `<style>...</style>` block (12,441 chars) and
   stripped every `<br />` (123 occurrences), `</p>` (1), and `<p>` (1)
   token from *only that block* — nothing else in the block was touched
   (no CSS rules added, removed, or reordered).
3. Applied the fix via `POST /wpvibe/v1/content/edit` (a match-once
   server-side `str_replace` of `old_content` → `new_content` on
   `post_content`) rather than a full-content overwrite — this fails safely
   (no match, no write) if the stored content doesn't exactly match what was
   captured, rather than risking silent corruption. Result:
   `{"status":"edited","replaced":1,"bytes":32010}`.
4. Purged the LiteSpeed page/CSS cache for the site (`wp cache purge`) to
   force regeneration of the combined CSS file.
5. Everything else in `post_content` — all copy, all `<div>`/`<section>`
   markup (including its own pre-existing, cosmetically-stray `</p>` tags
   from the same wpautop history — those are outside `<style>`, browsers
   silently recover from them per normal HTML5 parsing, and they were left
   untouched per the approved scope), all Stripe payment links, all
   internal/external links — is byte-for-byte identical to before. Verified
   programmatically (prefix/suffix diff around the edited span).

**What was explicitly NOT touched:** draft page 5340 (has a separate,
unrelated PHP fatal-error issue — not investigated or changed this pass),
`WP_DEBUG_LOG` (left off), the `ypnus-lead-integration-deactivated` plugin
hygiene issue (flagged, not acted on), any other plugin or WordPress setting,
Hostinger, DNS, theme files, the Meow Apps/AI Engine (OpenAI) public chatbot,
webhooks, or the Next.js app deployment.

**Verification performed:**

- Re-fetched `post_content` (`context=edit`) after the edit — the `<style>`
  block contains zero `<br />`/`<p>`/`</p>` occurrences; everything outside
  the style block is unchanged.
- Re-fetched the live rendered `<body>` — confirms the clean style block is
  what's actually served.
- Re-fetched the previously-404ing CSS URL (now with a new `?ver=` cache-bust
  the purge generated) — it now returns real CSS (142,700 bytes), not
  Hostinger's error page.
- `GET /wp/v2/settings` — `page_on_front: 1829`, `show_on_front: "page"`,
  unchanged before and after.
- No plugin list, plugin status, theme, or setting was modified by this
  change (`site_info`/`plugin list` were only read, never written to,
  outside of the one `cache purge` action).

**Rollback:**

- WordPress automatically created revision **5305** (dated
  2026-08-31T00:43:55, the last save before this fix) as part of its normal
  revision history — this is the exact pre-fix `post_content`, confirmed to
  contain the original corrupted `<style>` block. To roll back: restore page
  1829 from revision 5305 (`wp post revert` equivalent, or
  `PUT /wp/v2/pages/1829` with revision 5305's `content.raw`), then purge
  cache again.
- No plugin, setting, or DB schema change was made, so rollback is a single
  `post_content` restore — nothing else needs to be undone.

**Follow-ups intentionally left for a separate, explicitly-approved task:**

- Draft page 5340's PHP fatal error (needs `WP_DEBUG_LOG` enabled
  temporarily to diagnose — not approved yet).
- `ypnus-lead-integration-deactivated` plugin reporting as `active` despite
  its folder name — plugin hygiene, not approved to touch yet.
- The many cosmetic (but likely harmless) stray `</p>` tags in page 1829's
  body markup, outside the `<style>` block — out of this task's approved
  scope; browsers recover from them via standard HTML5 parsing rules, so
  they were left as-is.

## 2026-09-02 — Homepage (page 1829) CTA/link fixes + copy simplification

**Reported symptom:** homepage still "doesn't look good," CTAs seemed to not
go where expected, messaging didn't clearly say what the product does.

**CTA/link audit (all 17 links on the page checked by fetching each target's
`<title>`):** every single link on the homepage — `mlo-site-demo/`,
`pricing-plans/`, `territory/`, `contact/`, `lo-signup.html`,
`mlo-marketing-automation/`, `refinance-strategies/`, `blog/` + 3 blog
articles, 4 comparison pages, `about/`, `free-property-analyzer/`, plus the 3
Stripe checkout links — resolved to a real, correctly-titled, on-topic page.
**Nothing was actually broken.** The one real gap: **no link to
`app.ypnus.com` existed anywhere on the page** — "Login" wasn't a broken
link, it was a missing one.

**Changes made (5 targeted `POST /wpvibe/v1/content/edit` patches, each a
match-once `str_replace` on `post_content`, each verified `replaced: 1`
before moving to the next):**

1. Hero eyebrow line changed from "AI Lead Engine + Hyper-Local SEO — Now
   Live" to **"AI-Powered Lead Growth for Mortgage Loan Officers"**.
2. Hero sub-copy now explicitly says the AI Assistant "qualifies buyer,
   seller, and refinance leads" (previously generic "AI intake, scoring,
   and follow-up").
3. **Added a Login link** (`Already have an account? Login →`) pointing to
   `https://app.ypnus.com`, placed under the hero CTA row.
4. Platform Features grid: renamed the "AI Lead Engine" card to **"AI
   Assistant"** (copy now describes qualifying buyer/seller/refinance
   leads) and the "AI Content Writer" card to **"Website Autopilot"**
   (copy now matches the real product feature — reviews the site/profile
   and keeps headlines/CTAs/local content current automatically).
5. **Removed the unstyled, duplicate-CTA trailing block** that sat outside
   the page's `.ypn-b` design-system wrapper (a plain default-WordPress
   "Get Started Today" button, a hard-coded blue "Scale Your Mortgage
   Pipeline" box, and a "Schedule a Demo Today" button — all three
   duplicating CTAs already present, properly styled, earlier on the page)
   and replaced it with a single clean "Compare & Learn More" section
   (the same 4 comparison-page links + About + Free Property Analyzer),
   re-wrapped in `class="ypn-b"` so it inherits the page's existing color/
   typography variables instead of falling back to default theme styling.
   No shortcodes used — plain HTML with inline styles matching the
   existing palette, consistent with the rest of the page.
6. Purged LiteSpeed cache after all edits.

**Explicitly NOT touched:** Stripe/payment links (verified all 3 present,
unchanged), NMLS/DRE license text, the Meow Apps/AI Engine chatbot, draft
page 5340, `wp_options`, any plugin, WP_DEBUG_LOG, Hostinger, DNS, theme
files, and app deployment. No shortcodes introduced.

**Verification performed:**

- Re-fetched `post_content` (`context=edit`) — all 5 changes present exactly
  as written; everything else in the 32,010→31,694-byte content is
  unchanged (net smaller, since the trailing block shrank).
- Re-fetched live rendered `.yb-features` section — confirms "AI Assistant"
  and "Website Autopilot" cards render correctly.
- `GET /wp/v2/settings` — `page_on_front: 1829` unchanged.
- Fetched live rendered `<body>` — no critical-error page, style block
  still clean, no duplicate chatbot markup (`mwai` appears 0 times outside
  head config, i.e. no extra widget instance was introduced).
- `buy.stripe.com` appears the same number of times as before (3 checkout
  buttons + schema references) — payment links untouched.

**Rollback:**

- Five new revisions were created, one per edit: **5348** (06:37:33, before
  any of today's changes — this is the pre-task rollback point), 5349,
  5350, 5351, 5352 (06:40:15, after the trailing-block cleanup — the
  current live state). To fully roll back today's CTA/copy work, restore
  page 1829 from revision **5348** and purge cache again. (The earlier CSS/
  cache fix from the prior entry is untouched by a rollback to 5348 — that
  fix was already baked into 5348's content.)

**Deferred, not part of this task:**

- **Rotate the Google OAuth client secret** found exposed in `wp_options`
  during an earlier audit pass this session (`ce_google_client_secret`,
  Code Engine plugin) — flagged for the site owner to do in Google Cloud
  Console; not acted on here per explicit instruction.
- Orphaned `wp_options` cleanup (`aioseo_*`, `astra_*`/`ast-block-templates-*`/
  `bsf_*`, `cky_*`, `_wp_convertkit_settings`) — identified, not deleted,
  per explicit instruction to stop that work.
- Draft page 5340's PHP fatal error and the
  `ypnus-lead-integration-deactivated` plugin naming — still deferred from
  the prior entry.
