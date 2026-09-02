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
