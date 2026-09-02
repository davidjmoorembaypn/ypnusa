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

## Setup

1. Get a key at <https://console.anthropic.com/settings/keys>.
2. Set `ANTHROPIC_API_KEY` in your environment (`.env.local` for local dev,
   your host's env var config in production). Never commit a real key.
3. Optionally set `AI_MODEL` to override the default (`claude-opus-5`) —
   e.g. `claude-sonnet-5` or `claude-haiku-4-5` for lower cost/latency on
   high-volume routes once you've measured quality is acceptable.
4. Restart the app. `getAiProvider()` picks up the new env var on next
   process start (it memoizes per-process; see `resetAiProviderCache` for
   tests).

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
- **No handoff into the CRM yet.** `ChatSessionRecord.borrowerLeadId` /
  `crmLeadId` exist for linking a qualified chat session into
  `appendBorrowerLead` / `appendCrmLead` (`src/lib/db.ts`), but nothing calls
  that yet — the foundation stops at scoring + a recommended action.
