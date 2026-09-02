# AI assistant (YPN USA chatbot)

Foundation for an agentic chatbot with three modes, built on a
provider-agnostic interface so a different model host can be swapped in
without touching prompts, routing, or persistence.

## Modes

| Mode | Who talks to it | Auth | Notes |
| --- | --- | --- | --- |
| `public_site` | Anonymous marketing-site visitor | None | Answers product/program questions, invites into intake or a demo request. Never quotes rates/pricing specifics. |
| `mlo_dashboard` | Signed-in loan officer | Requires a valid `ypnus_session` cookie (`src/lib/session.ts`) | Session-scoped — a session can only resume its own transcript (`chat-agent.ts`'s `loadOrCreateSession`). |
| `lead_qualification` | Anonymous consumer (buyer / seller / refinance) | None | Runs a short slot-filling conversation and calls a structured-extraction tool every turn — see below. |

## Hosting & chatbot landscape (read this before touching deployment)

- **ypnus.com** (marketing) is WordPress on a Hostinger Cloud Server. Its
  public chatbot today is the **Meow Apps / AI Engine** plugin, backed by
  **OpenAI** — unrelated to this repo and not to be duplicated by it.
- **app.ypnus.com** (this repo) is a Node.js app on Hostinger Cloud
  (`hostinger/README.md`, `npm run deploy:hostinger:*`). There is **no
  Vercel deployment** for this project — an old `Vercel` GitHub commit
  status may still appear on PRs from a stale/disconnected integration;
  it is not real production deployment and should not block merging or
  be treated as a source of truth. Do not add Vercel config, env-var
  assumptions, or troubleshooting for it.
- This assistant (all three modes) is being stabilized inside
  **app.ypnus.com only**. Near-term: keep Meow/OpenAI running on
  ypnus.com unchanged; do not add a second public chatbot widget there.
  The bridge between the two is the existing generic lead-intake webhook,
  **`POST /api/webhooks/leads`** (`src/app/api/webhooks/leads/route.ts`,
  gated by `requireSecret` — `ADMIN_TOKEN` or `CRON_SECRET`) — WordPress
  (via a Meow Apps webhook/function if supported, a form plugin like
  WPForms/Gravity Forms/Fluent Forms, Zapier, or Make) or a direct POST
  can already send leads into app.ypnus.com through it. If you want the
  webhook secret decoupled from the admin/cron token, introduce a
  dedicated `YPNUS_LEAD_WEBHOOK_SECRET` and wire it into that route —
  not yet done, and no such secret exists yet. Future: once tested, this
  assistant's `public_site`/`lead_qualification` modes *may* replace
  Meow/OpenAI on ypnus.com — not yet, and not part of this foundation.
- This repo does not add any public-facing chatbot widget to ypnus.com or
  to any indexed app.ypnus.com page — `AssistantChat`/`AssistantPreviewTabs`
  are only mounted on `/assistant`, which is `robots: noindex, nofollow`.

## Architecture

```
src/lib/ai/
  provider.ts             AiProvider interface + getAiProvider() — the only
                           seam other code should import from.
  anthropic-provider.ts    @anthropic-ai/sdk-backed implementation.
  prompts.ts               Reusable system prompts per mode + the
                            capture_lead_qualification tool definition.
  chat-agent.ts            Orchestration: loads/creates the session, calls
                            the provider, merges structured output, persists.

src/app/api/assistant/chat/route.ts   POST { mode, message, sessionId? }
```

Nothing outside `provider.ts` / `anthropic-provider.ts` imports the Anthropic
SDK directly. To add another backend: implement `AiProvider` in a sibling
file and select it in `getAiProvider()` based on whatever env var you
introduce for it — `chat-agent.ts` and the route don't change.

### Persistence

Chat sessions are stored via `src/lib/db.ts` (`chatSessions` in `DbShape`,
`readChatSession` / `saveChatSession`) — the same file-backed JSON store
everything else in this app uses. There's no separate "if the database
exists" branch: the store is always present, and already degrades to
in-memory-only on read-only filesystems on its own (see `db.ts`'s
`flushToDisk`).

A `ChatSessionRecord` holds the full message transcript, `capturedFields`
(name/email/phone/city/state/leadType/urgency/consent), and — once the model
has enough signal — a `summary`, a 0-100 `leadScore`, and a
`recommendedAction` for the assigned loan officer. `mlo_dashboard` sessions
additionally carry the signed-in `userId` and are rejected on resume if a
different session subject supplies the same `sessionId`.

### Structured lead extraction

In `lead_qualification` mode, the request includes the
`capture_lead_qualification` tool (`prompts.ts`). The model is instructed to
call it after every turn with its cumulative best-known snapshot — including
fields it already knew, not just new ones — so `chat-agent.ts` can merge
without needing its own NLU. This keeps extraction machine-parseable
regardless of what conversational text comes back alongside it.

### Buyer / seller / refinance flows

`leadType` is a chat-native field (`buyer | seller | refinance | other`),
deliberately separate from the deterministic intake flow's
`BorrowerAnswers.purchaseRefiIntent` / `LoanProgram` — a seller isn't a
borrower, so it doesn't fit that model. `prompts.ts`'s
`LEAD_QUALIFICATION_INTRO` gives the model per-type follow-up angles (budget
and pre-approval for buyers, property/payoff status for sellers, rate/balance
and goal for refinance) rather than a rigid scripted flow, since the point of
using an LLM here is natural slot-filling instead of another fixed form.

## Setup (Hostinger Cloud / any Node host — no Vercel involved)

1. Get a key at <https://console.anthropic.com/settings/keys>.
2. Configure environment variables on the server (hPanel's Node.js app env
   vars, `.env.local` for local dev, or your process manager's env config —
   never commit a real key):
   - `ANTHROPIC_API_KEY` — required to enable real replies.
   - `ANTHROPIC_MODEL` — optional, overrides the default (`claude-opus-5`),
     e.g. `claude-sonnet-5` or `claude-haiku-4-5` for lower cost/latency once
     you've measured quality is acceptable.
   - `YPNUS_LEAD_WEBHOOK_SECRET` — **not yet wired up.** Reserved for a
     future dedicated secret on `/api/webhooks/leads`; that route currently
     authenticates via the existing `ADMIN_TOKEN`/`CRON_SECRET` (see
     `.env.example`) instead.
3. Run the production build with the existing package scripts
   (`npm run build`, `npm run start`, or `npm run deploy:hostinger:next` —
   see `hostinger/README.md`) and restart the app process so it picks up
   the new env vars (`getAiProvider()` memoizes per-process; see
   `resetAiProviderCache` for tests).
4. Confirm ypnus.com's reverse proxy / subdomain routing to app.ypnus.com is
   intact (Hostinger/Passenger config, not anything in this repo), and check
   server logs if the assistant doesn't come up after restart.

Nothing else needs to change — `/api/assistant/chat` and the chat UI already
handle both the configured and not-configured cases.

## TODOs / known foundation-level gaps

- **No streaming.** `AnthropicProvider.generate` uses a single
  non-streaming `messages.create` call. Fine for short chat replies; if
  responses start running long, switch to `messages.stream(...)` +
  `getFinalMessage()` and stream partial text to the client.
- **No RAG / live CRM context in `mlo_dashboard` mode.** The prompt tells the
  model it's looking at "the signed-in officer's own pipeline," but no lead
  data is actually injected into the request yet — wire the officer's
  assigned leads/CRM notes into the system prompt or as an additional tool
  once you decide how much context is worth the token cost.
- **No per-session rate limiting beyond the coarse per-IP limiter** in
  `rate-limit.ts` (30 requests/min/IP across all modes). Consider a
  per-session or per-user cap if abuse shows up.
- **Session IDs are bearer tokens for anonymous modes.** `public_site` and
  `lead_qualification` sessions have no auth boundary, so anyone holding a
  session's UUID can resume it. This mirrors how the existing intake flow's
  `sessionId` already works (`src/lib/intake-engine.ts`) and relies on the
  ID being an unguessable `crypto.randomUUID()` — don't log full session IDs
  anywhere client-visible.
- **CRM handoff is wired.** A qualified `lead_qualification` session now
  links once into `appendBorrowerLead`/`appendCrmLead` (`chat-agent.ts`'s
  `linkQualifiedLead`), setting `borrowerLeadId`/`crmLeadId`, surfaced in the
  `/assistant` preview UI.

## Website/Profile Autopilot (`src/lib/ai/website-autopilot.ts`)

**Product intent: YPNUS does the editing work, not the MLO.** MLOs are busy
with leads, processing, underwriting, and closings — the assistant should act
as a done-for-you growth operator, not hand back a list of suggestions for
the MLO to implement manually.

- `generateWebsiteAutopilotPlan(input)` is a deterministic (non-LLM), pure
  planner: given an MLO's current copy/SEO fields/market, it returns a list
  of `WebsiteAutopilotChange` items, each classified `low`/`medium`/`high`
  risk and a `status` of `auto_applied` / `needs_approval` / `proposed`.
  `runWebsiteAutopilot` wraps it to persist each change via
  `saveWebsiteAutopilotChange`/`listWebsiteAutopilotChanges` (`db.ts`,
  `websiteAutopilotChanges` in `DbShape` — same file-backed store as
  everything else, no new persistence model needed).
- **Auto-applied (low risk):** headline, CTA wording, chatbot greeting, lead
  form helper text, buyer/seller/refinance positioning, local market wording,
  SEO title/meta drafts, profile completeness copy, trust-building copy that
  never touches license/legal claims.
- **Held for review (`needs_approval`, medium/high risk):** rate/APR
  language, guaranteed-savings language, loan-approval language, compliance
  disclosures, NMLS/license changes, brand-claim changes, live WordPress
  publishing, paid ad copy, SMS/email sending. A defensive keyword scan
  (`containsComplianceLanguage`) also upgrades any nominally low-risk change
  to `needs_approval` if its generated text touches these terms — risk
  classification is never purely by category.
- **In `mlo_dashboard` mode**, messages like "Improve my website/profile for
  me" or "Get me more leads" trigger `runAutopilotTurn` in `chat-agent.ts`
  before any AI provider call — it's fully deterministic and works even
  without `ANTHROPIC_API_KEY` set. The assistant replies as an operator
  ("I can prepare and apply safe YPNUS-controlled improvements for you...")
  and returns a simple MLO-facing summary plus counts, shown in the
  `/assistant` preview UI's Website Autopilot block.
- **No live publishing.** This foundation only classifies and persists
  `WebsiteAutopilotChange` records inside the app; it never calls Hostinger,
  WordPress, or any deployment/webhook path. Turning `auto_applied` records
  into real published content on ypnus.com/app.ypnus.com is future work and
  requires explicit approval before being built.
