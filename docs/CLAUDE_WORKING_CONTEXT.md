# Claude working context (read before starting new work)

- **PR #41** (`claude/stdio-mcp-invizo-setup-ysa3fe`) contains the app.ypnus.com
  AI Assistant foundation (`src/lib/ai/`, `/api/assistant/chat`, `/assistant`
  preview page) plus the invizo WordPress MCP setup and Vercel cleanup. See
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
