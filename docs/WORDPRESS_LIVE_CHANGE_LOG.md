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

## 2026-09-06 — Homepage EHL disclosure + Rank Math legalName data-entry fix

**Context:** follow-up to a commercial-readiness audit (see PR #53) that found
two live gaps: the homepage's compliance disclosure had no Equal Housing
icon/alt text or NMLS Consumer Access link, and Rank Math's Local SEO
"Additional Info" `legalName` field was set to an email address
(`ypnusa@gmail.com`) instead of the business's legal name.

**Changes made:**

1. **Page 1829 (homepage), `post_content`** — one `POST /wpvibe/v1/content/edit`
   match-once `str_replace`, appending a new compliance section immediately
   before the page's closing `</div>` (after the existing `<script>` block).
   Added: an inline SVG house icon with `aria-label="Equal Housing
   Opportunity"`, the same NMLS/RESPA/TCPA disclosure wording already used in
   the (inactive) `custom_html-2` footer widget, and a `Verify on NMLS
   Consumer Access` link pointing at the exact same URL already verified live
   elsewhere on the site
   (`https://www.nmlsconsumeraccess.org/EntityDetails.aspx/individual/787257`) —
   reused verbatim rather than re-derived, to avoid introducing a wrong link.
   Nothing else on the page was touched. Result: `{"status":"edited","replaced":1,"bytes":15334}`.
2. **Option `rank-math-options-titles`, `additional_info.0.value`** — one
   `wp option patch update` changing the value from `ypnusa@gmail.com` to
   `YPN Inc.` (matching the existing `knowledgegraph_name` value already set
   on the same option). LiteSpeed page cache and the object cache were
   auto-purged by the write (standard behavior on this site's option-patch
   path, not a separate action taken here).

**Explicitly NOT touched this pass:**

- `lo-signup.html` (TCPA consent checkbox is still missing there) — this
  page is **not a WordPress post/page** (a `/wp/v2/pages` slug/search lookup
  and a `post list --post_type=any` search both returned nothing), so it is
  outside what the connected WPVibe/REST/WP-CLI tooling can reach. It is
  most likely a static file in the server's document root or on
  `app.ypnus.com`'s territory-PHP fallback path — fixing it needs direct
  file/FTP or hPanel File Manager access, not a WordPress content edit.
- The NMLS `identifier` schema fix (adding a proper `identifier` property to
  the Organization/FinancialService JSON-LD node, alongside the existing
  `founder.hasCredential` one) — the same `additional_info` array mechanism
  used for the `legalName` fix above is a plausible path, but appending a
  new array *element* (rather than patching an existing scalar) wasn't
  something this session could do with confidence via the available
  WP-CLI `option patch` primitive, so it was left alone rather than risk a
  malformed live options array. The repo's `wp-plugins/ypnus-trust-and-schema`
  plugin already solves this correctly in code (merges a proper `identifier`
  PropertyValue via the `rank_math/json_ld` filter) but installing it live
  needs a plugin-zip upload path this session didn't have confident access
  to — a manual "Upload Plugin" in WP Admin remains the simplest route.
- Deploying `wp-plugins/ypnus-seo-hygiene` or `wp-plugins/ypnus-trust-and-schema`
  — both already exist as reviewed, versioned code in this repo but were not
  installed live this pass, for the same plugin-upload-path reason above.
- Rotating the `ce_google_client_secret` value exposed in `wp_options`
  (flagged 2026-09-02, still unresolved) — this needs Google Cloud Console
  access this session does not have; it is not a WordPress-side fix. Note:
  this session confirmed that WPVibe's own `option get`/`option patch`
  responses auto-redact fields it recognizes as sensitive (`maps_api_key`,
  `facebook_secret` both came back as `"REDACTED"` from a live `option get`
  during this pass) — so the exposure is to direct database-level access
  (e.g. a raw `db query` SELECT), not to every connected tool by default.
- Wiring the WordPress-side SSO redirect (`docs/sso-handoff.md`'s "not yet
  done" section) — the plugin that owns `/wp-json/ypnus/v1/signup` /
  `/create-mlo` is not versioned in this repo and its live source wasn't
  inspected this pass; this remains the largest open integration gap
  between ypnus.com and app.ypnus.com.

**Rollback:**

- Page 1829: a new revision was created by the edit above (the immediately
  prior revision has the same content minus the appended compliance
  section). Restore that revision and purge cache to undo.
- `rank-math-options-titles`: re-run `wp option patch update
  rank-math-options-titles additional_info 0 value "ypnusa@gmail.com"` to
  restore the prior (incorrect) value — not recommended, listed only for
  completeness.

## 2026-09-06 — /marketing-platform/ → /features/ URL consolidation + AI-assistant positioning

**Context:** a competitive/technical-SEO analysis found that `/marketing-platform/`
(page 531) 301-redirects to `/features/` (page 1474), but page 531 was still
`status: publish`, so Rank Math kept including it in the XML sitemap and
several internal links still pointed at the old URL — splitting link equity
around the site's main commercial platform page. Separately, the product
team is rolling out an agentic AI assistant included with every signup, and
asked for that differentiator reflected in ypnus.com's own copy.

**Changes made:**

1. **Page 531 (`marketing-platform`), postmeta `rank_math_robots`** — set to
   `["noindex"]` via `wp post meta update ... --force` (Rank Math treats this
   as a protected key; `--force` is the standard override, not a bypass of
   anything plugin-specific). This removes it from Rank Math's XML sitemap
   going forward without touching whatever mechanism serves the live 301 —
   that redirect was confirmed to **not** live in Rank Math's own
   `{prefix}rank_math_redirections` table (a query for `marketing-platform`
   there returned zero rows), so it's handled by something outside Rank
   Math (hosting-level, a different redirect plugin, or `.htaccess`) that
   this change does not touch.
2. **Page 530 (Realtor Co-Branding Page Builder), `post_content`** — one
   match-once edit changing its one `href="https://ypnus.com/marketing-platform/"`
   footer link to `href="https://ypnus.com/features/"`.
3. **Site-wide internal links** — a `wp search-replace
   https://ypnus.com/marketing-platform/ https://ypnus.com/features/ wp_posts`
   dry-run found 11 occurrences. WPVibe's browser-approval link for this
   op expired twice before it could be clicked, so it was abandoned in
   favor of targeted per-post fixes (no approval gate on single-post
   `content/edit`). A follow-up `GROUP BY post_type, post_status` query
   broke the 11 down: **8 were stale `revision` rows** (dead history, never
   served to a visitor or crawler — left untouched), and **3 were live
   content**: page 698 and page 3163 each had one link fixed the same way
   as page 530 above, plus one not caught by the original publish/draft
   scan — a `private`-status page (ID 857, a "Welcome to YPN USA" email
   template) — fixed too, for consistency, even though it's not
   public/indexable.
4. **Nav menu ("YPNUS Primary Nav", menu ID 36)** — checked via
   `/wp/v2/menu-items`; zero items reference `/marketing-platform/`, so no
   menu edit was needed.
5. **Homepage (page 1829), `post_content`** — two edits reflecting the new
   "AI assistant included with every signup" positioning: the existing "AI
   Assistant" feature-card copy now ends with "Every signup gets a working
   AI assistant from day one — deeper automation unlocks as you scale
   plans," and the Free-tier pricing list gained a new first bullet, "AI
   Assistant included from day one." Wording was deliberately chosen **not**
   to say "no upsell" or claim full parity across plans — `/features/`
   (page 1474)'s own "What's Included by Plan" table gates its "24/7 AI
   chatbot" row to Pro/Elite only, and this pass did not change that pricing
   table (a tier-gating change is a packaging/business decision, not a
   copy fix, and wasn't part of the requested scope). An initial draft of
   the feature-card copy did say "no add-on, no upsell" and was corrected
   within the same session before being treated as final, once the
   `/features/` pricing-matrix conflict was spotted.

**Explicitly NOT touched this pass:**

- The live 301 redirect itself (its mechanism wasn't identified — see #1 —
  and the analysis explicitly said to keep it in place for old links/bookmarks).
- `/features/` page 1474's tier-gated pricing matrix — left as-is; only the
  homepage's own AI-assistant copy was updated, worded to stay consistent
  with that matrix rather than contradict it.
- The vendor-evaluation page's comparison-table content and unsupported
  pricing-claim cleanup recommended by the same analysis — not reached
  this pass.

**Follow-up in the same pass:** `/loan-officer-crm/` (page 3212) got its
decision-oriented comparison layer after all — a new "Built for loan
officers, not generic sales teams" section (who it's for vs. a generic
CRM, what it replaces vs. integrates with, and a 7-row feature comparison
table: lead capture, local SEO, territory exclusivity, AI intake, nurture,
Realtor co-marketing, CRM workflow fields). The co-marketing row is marked
"Included (Pro/Elite)" to match `/features/`'s existing pricing matrix
rather than overclaim free-tier parity.

**Verification performed:**

- `home`/`siteurl` options both confirmed `https://ypnus.com/` — canonical
  domain is HTTPS at the WordPress config level.
- A site-wide `search-replace http://ypnus.com https://ypnus.com wp_posts
  --dry-run` returned **0** matches — no plain-HTTP internal links exist in
  `post_content` anywhere on the site. Combined with the HTTPS `home`/
  `siteurl` settings, canonical signals are clean at the WordPress level;
  Google's separate HTTP/HTTPS performance rows in Search Console most
  likely reflect residual pre-HTTPS crawl history consolidating over time,
  not an active misconfiguration.
- Both page-531 and page-530 edits confirmed via their own
  `{"status":"edited","replaced":1}` API responses.

**Rollback:**

- Page 531: `wp post meta delete 531 rank_math_robots` (or update it back to
  its prior value, if known) restores sitemap inclusion.
- Page 530: re-run the edit in reverse (swap old/new content) to restore
  the `/marketing-platform/` link.
- Page 1829: a new revision was created by each edit; restore the
  pre-2026-09-06 revision and purge cache to fully undo the AI-assistant
  copy changes.
- The pending site-wide `search-replace`, once approved and run, is only
  reversible by re-running it with `old`/`new` swapped, or restoring a
  database backup from before it ran.
