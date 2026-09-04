# WordPress Autopilot (`src/lib/wordpress.ts`)

The WordPress-specific extension of the [Website/Profile Autopilot](ai-assistant.md#websiteprofile-autopilot-srclibaiwebsite-autopilotts): instead of only persisting proposed copy changes inside the app, this foundation lets YPNUS eventually act as a done-for-you operator that reads and writes ypnus.com's actual WordPress content via its REST API — proposing, classifying, and (once explicitly enabled) applying safe changes directly, rather than handing the MLO a list to implement by hand.

## Current status tonight: dry-run / proposal mode only

- **No deployment, no Hostinger changes, no live WordPress changes, and no webhook work happened as part of this.**
- `WORDPRESS_AUTOPILOT_ENABLED` and `WORDPRESS_AUTOPILOT_AUTO_APPLY_LOW_RISK` both default to `false`/unset.
- With either flag off, `applyWordPressAutopilotPlan()` never calls the WordPress REST API to write anything — every change comes back `status: "proposed"`. Nothing is published to ypnus.com today, even if code calls this function.

## Architecture

`src/lib/wordpress.ts` is a thin REST client + safety gate layered on top of the existing planner in `src/lib/ai/website-autopilot.ts` — it introduces no duplicate types or persistence model:

- Operates on the same `WebsiteAutopilotChange` / `WebsiteAutopilotPlan` types from `src/lib/types.ts` and `src/lib/ai/website-autopilot.ts`.
- `classifyWordPressChangeRisk(changeType, afterText)` delegates directly to `website-autopilot.ts`'s exported `classifyRisk` — one risk-classification rulebook, reused rather than reimplemented.
- Exports:
  - `getWordPressAutopilotStatus()` — reports whether the required env vars are configured and whether the two enable flags are on, without making a network call.
  - `fetchWordPressContent(ref)` — read-only GET of a page/post via `wp-json/wp/v2`, by numeric id or slug. Returns `null` on missing config, a missing ref, or any request failure — never throws.
  - `conditionallyUpdateWordPressContent(ref, change)` — the single place that can perform a write. Refuses (no network call at all) unless `WORDPRESS_AUTOPILOT_ENABLED` is `true`, credentials are configured, and a numeric content id is supplied.
  - `applyWordPressAutopilotPlan(plan, ref?)` — walks a `WebsiteAutopilotPlan`'s changes and, per change, decides `auto_applied` / `needs_approval` / `proposed` using the rules below.
- Credentials (`WORDPRESS_AUTOPILOT_USERNAME` / `WORDPRESS_AUTOPILOT_APP_PASSWORD`) are read from env, base64-encoded into a Basic auth header at call time, and never logged or thrown in an error message under any code path.

## Risk classification

| Risk | Examples | Behavior |
| --- | --- | --- |
| **Low** (auto-appliable once explicitly enabled) | Headline clarity, CTA wording, section copy, buyer/seller/refinance positioning, local market wording, lead form helper text, chatbot intro copy, typo fixes, SEO title/meta drafts | Auto-applied only when both env flags are `true` and a content ref is supplied; otherwise held as a proposal |
| **High** (always `needs_approval`) | Rate/APR language, loan-approval promises, guaranteed-savings claims, legal/compliance disclosures, NMLS/license fields, plugin/theme/server/DNS settings, paid ad copy, live publishing, SMS/email sending | Never auto-applied, regardless of flags |

A defensive keyword scan (shared with `website-autopilot.ts`'s `classifyRisk`) upgrades a nominally low-risk change to at least `medium` if its generated text touches rate/APR, guarantee, approval, NMLS, or license language — risk is never decided purely by category name.

## Env vars

| Var | Default | Purpose |
| --- | --- | --- |
| `WORDPRESS_SITE_URL` | unset | Base URL of the WordPress site the REST client targets |
| `WORDPRESS_AUTOPILOT_USERNAME` | unset | WordPress Application Password username |
| `WORDPRESS_AUTOPILOT_APP_PASSWORD` | unset | WordPress Application Password value |
| `WORDPRESS_AUTOPILOT_ENABLED` | `false` | Master switch — while `false`, no WordPress REST write call is ever made |
| `WORDPRESS_AUTOPILOT_AUTO_APPLY_LOW_RISK` | `false` | Second switch — must also be `true` for a low-risk change to auto-apply |

**Safety invariant:** a change is only ever written to WordPress when *all* of the following hold — `WORDPRESS_AUTOPILOT_ENABLED=true`, `WORDPRESS_AUTOPILOT_AUTO_APPLY_LOW_RISK=true`, the change's risk classifies as `low`, and an explicit `WordPressContentRef` (numeric id) is supplied to `applyWordPressAutopilotPlan`. Missing any one of these keeps the change at `proposed` or `needs_approval` — never applied.

See `.env.example` for the copy-pasteable variable block and inline comments.

## What still requires a human

- Anything classified `needs_approval` (all high/medium-risk changes).
- Enabling `WORDPRESS_AUTOPILOT_ENABLED` and `WORDPRESS_AUTOPILOT_AUTO_APPLY_LOW_RISK` in the first place — this is an explicit opt-in decision, not a default.
- Any change type not covered by `classifyWordPressChangeRisk`'s known categories.

## Never touched by this foundation

- The Meow Apps / AI Engine + OpenAI public chatbot on ypnus.com — unrelated, not modified.
- Hostinger server, DNS, or plugin/theme settings.
- Any deployment pipeline.

## Related

- [`docs/ai-assistant.md`](ai-assistant.md) — the broader AI assistant foundation, including the app-only Website/Profile Autopilot this extends.
- [`.env.example`](../.env.example) — the copy-pasteable env var block.
