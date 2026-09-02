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
