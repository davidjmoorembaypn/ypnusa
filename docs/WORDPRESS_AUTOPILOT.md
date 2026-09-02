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

## Unattended runner foundation (`src/lib/ai/autopilot-runner.ts`)

The Command Center and its Run History log (`docs/CLAUDE_WORKING_CONTEXT.md`) both require an MLO to click "generate." `runWebsiteAutopilotForConfiguredSites()` is the same idea running without anyone at a keyboard — the foundation for YPNUS to check and improve ypnus.com on its own schedule later (e.g. a future Hostinger cron hitting `npm run autopilot:run`). **No Hostinger schedule is configured tonight** — this only adds the reusable function and a manual CLI entry point.

- **Default is off.** `WEBSITE_AUTOPILOT_UNATTENDED_ENABLED` defaults to `false`/unset — while off, the runner returns immediately having generated no plan, persisted no run, and made no WordPress call of any kind.
- **When enabled, it's still dry-run only.** It never calls `fetchWordPressContent`, `conditionallyUpdateWordPressContent`, or `applyWordPressAutopilotPlan` — every run it logs carries `dryRun: true`, unconditionally. `getWordPressAutopilotStatus()` is used only to read env vars for the `wordpressLive` display field, exactly as elsewhere in this doc.
- **A second, independent flag governs auto-applied logging.** `WEBSITE_AUTOPILOT_AUTO_APPLY_LOW_RISK` (default `false`) is distinct from `WORDPRESS_AUTOPILOT_AUTO_APPLY_LOW_RISK` above — that one gates a *live* WordPress write (still requires `WORDPRESS_AUTOPILOT_ENABLED` too); this one only decides whether an unattended run's low-risk changes are logged as `auto_applied` or downgraded to `proposed` (`applyAutoApplyGate`, pure). Medium/high-risk changes — rate/APR, loan-approval promises, guarantees, compliance disclosures, NMLS/license changes, and plugin/theme/server/DNS (`platform_settings_change`) — are never auto-applied by either flag; they always classify `needs_approval` via the same `classifyRisk` rules used everywhere else in this foundation.
- **Configured targets are a static allowlist**, not a live crawl: `getConfiguredAutopilotTargets()` currently returns one entry, the ypnus.com homepage, with hand-maintained placeholder copy/SEO fields — adding a page later is a config change to that list, not a new live-fetch capability.
- Each run persists one `AutopilotRunRecord` per target via the existing `saveAutopilotRun` (same history the Command Center's Run History panel reads), and the runner returns a simple aggregate summary: *"YPNUS checked your website and prepared/improved N items across M pages."*
- **CLI entry**: `npm run autopilot:run` (`scripts/run-website-autopilot.ts`) calls `runWebsiteAutopilotForConfiguredSites()` and prints its summary/JSON — meant for manual runs tonight and a future Hostinger scheduled task later. No Hostinger schedule is configured as part of this change.
- No manual MLO website work is required for this to eventually run — that's the point of the unattended path — but it stays fully off/dry-run until both an explicit `WEBSITE_AUTOPILOT_UNATTENDED_ENABLED=true` opt-in and (separately, still not done tonight) a real Hostinger schedule and WordPress write path are approved.

## Related

- [`docs/ai-assistant.md`](ai-assistant.md) — the broader AI assistant foundation, including the app-only Website/Profile Autopilot this extends.
- [`.env.example`](../.env.example) — the copy-pasteable env var block.
