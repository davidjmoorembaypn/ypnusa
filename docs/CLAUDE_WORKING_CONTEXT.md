# Claude working context (read before starting new work)

- **PR #41 is merged into `main`** (squash commit `4112287`). The
  app.ypnus.com AI Assistant foundation (`src/lib/ai/`, `/api/assistant/chat`,
  `/assistant` preview page), invizo WordPress MCP setup, and Vercel cleanup
  are all now on `main`. **No deployment was performed** — main was only
  fast-forwarded locally; nothing was pushed to Hostinger/production. See
  `docs/ai-assistant.md` for architecture detail.
- **Public ypnus.com chatbot stays Meow Apps / AI Engine + OpenAI on
  WordPress.** Do not add a second public chatbot widget there.
- **app.ypnus.com uses the new custom YPNUS AI Assistant first** for its own
  surfaces (MLO dashboard, lead qualification). It does not replace Meow on
  ypnus.com yet — that's a future decision, not part of this foundation.
- The user can be walked through small, guided, low-risk tasks with AI help,
  but avoid steering them into risky manual setup.
- Do **not** ask the user to manually configure webhooks, Hostinger
  deployment, DNS, env vars, or server settings unless it's genuinely
  unavoidable for the task at hand.
- **Explicit approval is required before**: any deployment, Hostinger change,
  WordPress/Meow chatbot change, webhook setup, database migration, or
  production env var change.
- When user action is unavoidable, give a short **User Action Card** (what to
  do, where, why) instead of multi-step manual instructions.

See `docs/HANDS_OFF_OPERATIONS.md` for the full operating model this context
is a summary of.

## Latest completed task: CRM/borrower-lead handoff

- **Files changed:** `src/lib/ai/chat-agent.ts` (new `linkQualifiedLead`,
  called from `runAssistantTurn`), `src/lib/ai/chat-agent.test.ts` (5 new
  tests).
- **What it does:** once a `lead_qualification` session reaches
  `status: "qualified"`, it's linked once into the existing deterministic
  `appendBorrowerLead`/`appendCrmLead` store (via `crm.ts`'s
  `logCrmActivity`, the only path that already pairs the two correctly) by
  building a minimal `BorrowerAnswers`/`QualificationSummary` snapshot from
  the chat's own captured fields/summary/score — not fabricated financial
  data. `ChatSessionRecord.borrowerLeadId`/`crmLeadId` are set once and guard
  against ever creating a second lead for the same session.
- Tests: 180/180 passing (`npm test`), clean `tsc`/`lint`.

## Latest completed task: surface linked lead in the /assistant preview UI

- **Files changed:** `src/lib/ai/chat-agent.ts` (`AssistantTurnResult` now
  includes `borrowerLeadId`/`crmLeadId`, passed through automatically by
  `/api/assistant/chat`'s existing `...result` spread), `src/lib/ai/chat-agent.test.ts`
  (asserts both are `undefined` for a fresh, unqualified session),
  `src/components/assistant/assistant-chat.tsx` (renders a "Lead linked"
  confirmation with lead type + id in the lead_qualification captured-fields
  panel, only when the API actually returns an id — no error shown
  otherwise).
- Tests: 180/180 passing (`npm test`), clean `tsc`/`lint`. No UI/component
  test runner exists in this repo (no React Testing Library/jsdom in
  `package.json`), so UI coverage is at the API-response-shape level only.
- **Next safe app-only task:** none currently pending — awaiting the next
  instruction. A reasonable candidate: add a link from the CRM/borrower lead
  IDs shown in the UI to wherever the MLO pipeline is viewed today, once
  that route is confirmed.

## Post-merge status

- `main` is at `4112287` (merged PR #41). No deploy/Hostinger/WordPress
  action was taken as part of the merge — production is untouched until
  someone explicitly deploys.
- Next safe app-only tasks (pick one, none started): (1) link shown
  borrower/CRM lead IDs to the MLO pipeline view, (2) add streaming support
  to `AnthropicProvider.generate`, (3) inject live CRM/pipeline context into
  `mlo_dashboard` prompts — see `docs/ai-assistant.md` TODOs.

## Latest completed task: Website/Profile Autopilot foundation (branch `feature/website-profile-autopilot`)

- **Product direction:** YPNUS is designed to *do the work* for MLOs — not
  hand them a list of suggestions. MLOs are not expected to manually edit
  websites/profiles; the assistant applies safe changes itself and holds
  risky/compliance-sensitive ones for review.
- **Files changed:** `src/lib/types.ts` (`WebsiteAutopilotChange` + related
  types, `websiteAutopilotChanges` on `DbShape`), `src/lib/db.ts`
  (`listWebsiteAutopilotChanges`/`saveWebsiteAutopilotChange`, existing
  file-backed store — no new persistence model), `src/lib/ai/website-autopilot.ts`
  (new: deterministic `generateWebsiteAutopilotPlan` + persisting
  `runWebsiteAutopilot`), `src/lib/ai/chat-agent.ts` (mlo_dashboard trigger
  phrases run the autopilot as an operator, before any AI provider call),
  `src/components/assistant/assistant-chat.tsx` (starter prompt + Website
  Autopilot result block), `src/lib/ai/website-autopilot.test.ts` (new),
  `src/lib/ai/chat-agent.test.ts` (+2 tests), `docs/ai-assistant.md`.
- **Safe YPNUS-controlled content can be auto-applied:** headline, CTA,
  chatbot greeting, lead form helper text, buyer/seller/refinance
  positioning, local market wording, SEO title/meta drafts, profile
  completeness copy, trust copy (never touching license/legal claims).
- **Requires approval:** rate/APR language, guaranteed-savings language,
  loan-approval language, compliance disclosures, NMLS/license changes,
  brand-claim changes, live WordPress publishing, paid ad copy, SMS/email
  sending. A keyword scan also defensively upgrades any change whose
  generated text touches these terms, regardless of its category.
- **No deployment or WordPress changes were made.** The autopilot only
  classifies and persists change records inside the app; nothing is
  published live.
- Tests: 189/189 passing (`npm test`), clean `tsc`/`lint`.
- **Next safe app-only task:** none pending — awaiting instruction. A
  reasonable candidate: a simple approval UI/endpoint for `needs_approval`
  changes (accept/reject), still with no live publishing wired up.

## Latest completed task: WordPress Autopilot foundation (branch `feature/wordpress-website-autopilot-foundation`)

- **Product direction:** extends the Website/Profile Autopilot so YPNUS can
  eventually act as a done-for-you operator directly on ypnus.com's WordPress
  content, not just inside the app — proposing, classifying, and (once
  explicitly enabled) applying safe copy changes via the WordPress REST API.
- **Files changed:** `src/lib/wordpress.ts` (new: WordPress REST client +
  safety gate — `getWordPressAutopilotStatus`, `fetchWordPressContent`,
  `conditionallyUpdateWordPressContent`, `classifyWordPressChangeRisk`,
  `applyWordPressAutopilotPlan`), `src/lib/wordpress.test.ts` (new),
  `.env.example` (new `WORDPRESS_SITE_URL` /
  `WORDPRESS_AUTOPILOT_USERNAME` / `WORDPRESS_AUTOPILOT_APP_PASSWORD` /
  `WORDPRESS_AUTOPILOT_ENABLED` / `WORDPRESS_AUTOPILOT_AUTO_APPLY_LOW_RISK`
  block), `docs/WORDPRESS_AUTOPILOT.md` (new reference doc), `docs/ai-assistant.md`
  (short subsection pointing at it). `src/lib/types.ts`
  (`WebsiteAutopilotChange` and related types), `src/lib/ai/website-autopilot.ts`
  (`classifyRisk` exported for reuse), `src/lib/ai/chat-agent.ts`, and
  `src/components/assistant/assistant-chat.tsx` were extended earlier this
  session by the orchestrating session, not as part of this doc/env task.
- **What was completed:** `src/lib/wordpress.ts` reuses `classifyRisk` from
  `website-autopilot.ts` (no duplicate risk rules) and operates on the same
  `WebsiteAutopilotChange`/`WebsiteAutopilotPlan` types (no duplicate
  persistence model). Every write path fails safe to a no-op unless
  `WORDPRESS_AUTOPILOT_ENABLED=true` AND
  `WORDPRESS_AUTOPILOT_AUTO_APPLY_LOW_RISK=true` are both set, and even then
  only low-risk changes with an explicit WordPress content ref are ever
  auto-applied — medium/high-risk changes always go to `needs_approval`.
- **Dry-run-only status:** both flags default to `false`/unset, so nothing
  was written to WordPress tonight. No deployment, no Hostinger changes, no
  live WordPress changes, and no webhook work happened as part of this task.
- **Next safe app-only task:** a simple approval UI/endpoint for
  `needs_approval` changes (accept/reject), still with no live publishing
  wired up — same candidate as the prior entry, still not started.

## Latest completed task: Website Autopilot Command Center (branch `feature/website-autopilot-command-center`)

- **Product direction:** makes the Website/Profile/WordPress Autopilot
  foundations usable inside the app tonight, app-only and dry-run only — an
  MLO can generate and see a preview plan, nothing is deployed or published.
- **Files changed:** `src/app/api/autopilot/plan/route.ts` (new, session-gated
  + rate-limited POST route calling only `generateWebsiteAutopilotPlan` and
  the read-only `getWordPressAutopilotStatus`), `src/app/api/autopilot/plan/route.test.ts`
  (new: asserts no WordPress write/network helper is referenced, session gate
  present, dashboard nav link present), `src/components/autopilot/autopilot-panel.tsx`
  (new client form + result panel), `src/app/dashboard/autopilot/page.tsx`
  (new, session-gated page using the existing `DashboardShell`), `src/app/dashboard/page.tsx`
  (added a "Website Autopilot" nav card), `docs/ai-assistant.md`.
- **No deployment, Hostinger, live WordPress, or Meow/OpenAI change.** No DB
  persistence either — the route is a pure preview: it never calls
  `runWebsiteAutopilot`, `fetchWordPressContent`, or
  `applyWordPressAutopilotPlan`. `WORDPRESS_AUTOPILOT_ENABLED` and
  `WORDPRESS_AUTOPILOT_AUTO_APPLY_LOW_RISK` remain off by default.
- **Next safe app-only task:** approval-gated deployment/publishing (turning
  an accepted plan into a real persisted/published change) — still not
  started, still requires explicit approval before being built.

## Latest completed task: Website Autopilot Run History / Change Log (branch `feature/website-autopilot-run-history`)

- **Product direction:** MLOs shouldn't manage website work — they should see
  a simple history: "YPNUS improved these items for you." This adds that
  history log on top of the Command Center, still fully dry-run/app-only.
- **Files changed:** `src/lib/types.ts` (`AutopilotRunRecord` +
  `AutopilotRunChangeSummary`, `autopilotRuns` on `DbShape`), `src/lib/db.ts`
  (`listAutopilotRuns`/`saveAutopilotRun`, same file-backed store, bounded to
  100 runs/user via `MAX_AUTOPILOT_RUNS_PER_USER`), `src/lib/ai/website-autopilot.ts`
  (`buildAutopilotRunRecord` — pure, turns a generated plan into a run
  record), `src/app/api/autopilot/plan/route.ts` (now also logs a run via
  `saveAutopilotRun`), `src/app/api/autopilot/runs/route.ts` (new, read-only
  `GET` for history), `src/components/autopilot/run-history-panel.tsx` (new),
  `src/components/autopilot/autopilot-panel.tsx` (renders it, refreshes
  after each new plan), tests in `src/lib/ai/website-autopilot.test.ts` and
  `src/app/api/autopilot/plan/route.test.ts`, `docs/ai-assistant.md`.
- **No deployment, Hostinger, live WordPress, or Meow/OpenAI change.** No
  migration — `autopilotRuns` is a new array field defaulting to `[]`, same
  additive pattern every other `DbShape` field already uses. The route still
  never calls `runWebsiteAutopilot`, `fetchWordPressContent`, or
  `applyWordPressAutopilotPlan`; every run is logged `dryRun: true` with
  `wordpressLive` reflecting `WORDPRESS_AUTOPILOT_ENABLED` (off).
- **Next safe app-only task:** approval-gated deployment/publishing (turning
  an accepted plan into a real persisted/published change) — still not
  started, still requires explicit approval before being built.

## Latest completed task: Predictive homepage engine (branch `feature/ga4-predictive-homepage-engine`, PR #49 — merged into `main` as squash commit `e9e3f5e`)

- **Product direction:** a client-side-only equivalent of GA4's predictive
  metrics (purchase/churn probability) for the app homepage — micro-
  interaction scoring drives a self-selection funnel, an interactive
  pre-qualification slider, and a once-per-session exit-intent trap. No data
  leaves the browser; no server-side tracking was added.
- **Files changed:** `src/lib/analytics-behavior.ts` (new, pure/DOM-free
  scoring + classification engine), `src/lib/analytics-behavior.test.ts`
  (new, 17 tests), `src/lib/hooks/useBehaviorTracking.ts` (new, the only
  DOM-touching piece — wires real listeners + `localStorage`, same SSR-safe
  hydration pattern as `useContentPatterns.ts`), `src/components/homepage/`
  (new: `SelfSelectCards`, `DynamicHero`, `InteractiveCalculator`,
  `ChurnExitModal`, `PredictiveHomepageEngine`), `src/app/page.tsx` (adds
  `<PredictiveHomepageEngine />` additively into the hero), `.env.example`
  (documents `NEXT_PUBLIC_PREDICTIVE_HOMEPAGE_ENABLED`).
- **Off by default / dry-run safe:** gated on
  `NEXT_PUBLIC_PREDICTIVE_HOMEPAGE_ENABLED === "true"` (same off-by-default
  precedent as `WORDPRESS_AUTOPILOT_ENABLED`); with it unset the component
  renders `null` and the homepage HTML is byte-for-byte unchanged (verified
  via a local `next dev` smoke test). No WordPress, Hostinger, or Meow/OpenAI
  chatbot changes — everything is client-side React state + `localStorage`
  in this Next.js app. No network calls in the behavior engine itself.
- **Checks:** `npx tsc --noEmit` clean, `npm run lint` clean (same 2
  pre-existing unrelated warnings in `flows.ts` as prior PRs), `npm test`
  231/231 passing, `npm run build` succeeds. PR #49 carries the same
  pre-existing account-level `Vercel` check failure documented on #41/#48
  (unrelated to this diff — confirmed via local `npm run build` success);
  left in draft pending that.
- **No deployment was performed.** No Hostinger, live WordPress, or
  Meow/OpenAI chatbot change of any kind.
- **Next safe app-only task:** wire real `/api/funnel`/`/api/personalize`
  telemetry into the behavior engine's self-selected intent (still additive,
  still flag-gated) — not started, not part of this task.
