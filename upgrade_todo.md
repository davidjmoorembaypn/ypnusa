# YPN USA (ypnus.com) Upgrade Plan: Six Enhancements

**Status:** Phase 1 plan only. No code has been written. Nothing in Phase 2 starts until David approves this file.
**Audited:** `main` at `c54f992` (the build live on ypnus.com), 2026-11-16.
**Legend:** 💳 needs a paid account or credentials · ⚖️ legal/compliance review · 📦 new package (ask first) · 🗄️ data migration (ask first) · ✅ free, no outside account

---

## 1. Tech stack (filled in from the repo)

| Area | What the repo actually uses |
|---|---|
| Frontend / backend | Next.js **16.4** App Router, React 19, TypeScript, Tailwind CSS 4. Route gate lives in `src/proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts`). |
| Database | **No database.** One JSON file (`data/store.json`) held in memory and written to disk (`src/lib/db.ts`, ~900 lines). Postgres schemas already drafted in `migrations/001-003_*.sql` but not connected. |
| Hosting | One AWS EC2 server (`ypnus-app`, us-east-2). Releases built by `.github/workflows/release-build.yml` on push to `main`, installed by hand with `scripts/aws-install-release.sh`. |
| Auth | Email magic link (`src/lib/email-login.ts`) + signed session cookie (`src/lib/session.ts`). Roles: `mlo`, `admin` only. Every protected page also calls `requireSession()`; API machine routes use `requireSecret()` (ADMIN_TOKEN / CRON_SECRET). |
| AI | Provider switch in `src/lib/ai/provider.ts` (`AI_PROVIDER` = gemini / openai / anthropic, plus Bedrock config). Live: **Gemini free tier**. Cerebro agent: `src/lib/ai/chat-agent.ts`, tools in `cerebro-tools.ts`, `follow-up-tools.ts`. |
| Voice / SMS | **Twilio already wired for inbound calls** (`/api/voice/incoming`, `/respond`, `/dial-status`, signature check in `src/lib/voice/twilio.ts`) and SMS sending in `src/lib/outreach.ts`. No Twilio account is live yet. |
| Email | Resend (`src/lib/email.ts`), from support@ypnus.com. |
| Payments | Stripe webhooks with event-id idempotency (`src/lib/stripe-webhook.ts`), tiers Free / $99 / $199 / $299, ZIP lock on first payment. |
| Tests | 90 `*.test.ts` files run with `tsx --test` (`npm test`). ESLint flat config. CI on PRs (`ci.yml`). |

## 2. What the audit found that matters

**Already built (we extend these, not rebuild):**
- Cerebro approval queue: `CerebroQueuedActionRecord` with `awaiting_approval → approved/dismissed` for callbacks, follow-up drafts, nudges, rate alerts, prequal letters. All outbound stays MLO-approved.
- Lead routing (`src/lib/crm.ts`: ZIP owner → officer page → house), lead alerts (`notifications.ts`), optional outbound webhook mirror (`external-webhook.ts`, Zapier-style).
- Marketing-copy compliance checker (`src/lib/ai/marketing-compliance.ts`): blocks rates/APR, payments, guarantees, invented track records, wrong NMLS numbers.
- Borrower consent fields exist (`consent`, `consentAt`, `contactConsent`), but there is no per-channel consent ledger.
- Equity math (`property-equity.ts`), rule-based qualification scores (`qualification.ts`), outcome engine (`predictive/outcomeEngine.ts`), life-event dashboard; county life-event data is a **neutral placeholder** (no provider connected).

**Baseline health at `c54f992` (run 2026-11-16):** `npm test` 677/677 pass · `npm run lint` 0 errors, 2 warnings (unused eslint-disable in `src/lib/flows.ts`) · `npm run build` succeeds.

**Gaps and risks:**
1. 🔴 **Borrower PII is stored in plain text** in `store.json` (names, phones, emails, credit band, income answers). No encryption anywhere in `src/`. Must fix before any of the six upgrades add more PII (call transcripts, CRM data, enrichment).
2. 🔴 **Free-tier Gemini:** Google may use prompts on the free tier. A paid AI key is required before borrower PII reaches the AI at volume (affects upgrades 1, 2, 5, and Live Takeover in 3).
3. 🟠 **Single JSON file on one small server** works today but will not hold up for two-way CRM sync, background enrichment jobs, or many officers. A move to Postgres is the clean fix; the SQL is half-written already.
4. 🟠 `logApiError()` prints whole error objects to the console; provider errors can echo request bodies (phones, emails). Needs a redaction layer.
5. 🟠 Inbound lead webhook (`/api/webhooks/leads`) has **no duplicate check**; a retried POST creates a second lead.
6. 🟡 Only two roles (`mlo`, `admin`); no realtor role, no per-record access scoping beyond officer id.
7. 🟡 No PWA manifest or service worker.

**Path note:** the request names `src/services/voice/` and `src/integrations/crm/`. This repo keeps all server logic in `src/lib/` and already has `src/lib/voice/`. Plan uses `src/lib/voice/outbound/` and `src/lib/integrations/crm/` to match. Same intent, one convention.

## 3. Recommended order

| # | Work | Why this order | Outside accounts |
|---|---|---|---|
| 0 | **Foundations** (encryption, log redaction, consent ledger, idempotency helper) | Every upgrade below writes PII or receives webhooks. | ✅ none |
| 1 | **Upgrade 6: Compliance engine** | Pure code, no accounts, protects everything after it. | ✅ none (⚖️ rule text reviewed) |
| 2 | **Upgrade 3: PWA + Live Takeover** | Direct MLO value, Web Push is free. SMS alerts wait for Twilio. | 📦 `web-push`; 💳 Twilio for SMS only |
| 3 | **Upgrade 5: Lead scoring (rules first)** | Rules-based score is free; data providers added later. | 💳 AVM / public-record provider (later) |
| 4 | **Upgrade 2: CRM / LOS integrations** | Needs vendor partner access, which takes time to obtain. | 💳 per vendor |
| 5 | **Upgrade 4: Realtor co-marketing portal** | Needs RESPA attorney review before launch. | ⚖️ attorney |
| 6 | **Upgrade 1: Outbound AI voice** | Highest legal risk (TCPA) and cost. David already decided AI calls go last. | 💳 Twilio (+ paid AI), ⚖️ |

Optional but recommended between steps 2 and 4: **Postgres move** (🗄️ needs David's yes; see F5).

**Rule for every step:** run `npm run lint`, `npm test`, `npm run build`; fix errors before the next step. Each step lands as its own small PR on a branch, never directly on `main`.

---

## 4. Phase 0: Foundations (do first)

- [ ] **F1. Field encryption helper** `src/lib/crypto/pii.ts`: AES-256-GCM `encryptField()` / `decryptField()`, key from `PII_ENCRYPTION_KEY` (32-byte, server env only), key-version prefix for rotation. Tests: round trip, tamper detection, missing key fails closed.
- [ ] **F2. Encrypt existing PII at rest**: wrap borrower phone, email, name, free-text answers, chat transcripts in `db.ts` read/write paths. One-time backfill script with dry-run flag. 🗄️ *ask before running on the live store* (back up `store.json` first).
- [ ] **F3. Log redaction** `src/lib/log.ts`: `safeLog()` that masks emails, phone numbers, SSN-like and account-like digit runs, and drops request bodies. Replace `logApiError()` internals and the 53 `console.*` calls. Test with sample PII strings.
- [ ] **F4. Consent ledger**: `ConsentRecord { leadId, channel: sms|call|email|ai_voice, granted, source, textShown, at, ip? }`; helper `canContact(leadId, channel)` that also checks quiet hours (8am–9pm borrower local time) and opt-outs (STOP keywords). All outbound paths must call it. Tests for each channel.
- [ ] **F5. (Decision) Storage move to Postgres** 🗄️📦(`pg`): finish `migrations/`, add a `db` adapter with the same function names as `db.ts`, migrate with a verified copy, keep JSON as rollback. *Needs David's yes and a small AWS RDS cost.* Can be deferred until upgrade 2.
- [ ] **F6. Idempotency helper** `src/lib/idempotency.ts`: `once(key, fn)` with a processed-key table (24h+ retention), reused by every webhook. Apply first to `/api/webhooks/leads` (dedupe by source id, else hash of email+phone+day).
- [ ] **F7. (Decision) Paid AI key** 💳: switch Cerebro from Gemini free tier to a paid key (Gemini paid tier, Anthropic, or Bedrock; provider switch already exists). Required before upgrades 1, 2, 5 send PII to the AI.

## 5. Upgrade 6: State-by-State Compliance Engine ✅ ⚖️

- [ ] **6.1** `src/lib/compliance/rules.ts`: typed `ComplianceRule` (state, appliesTo: ai_message | social_caption | landing_footer | sms | email, required disclosures, max length variants). Start with **federal baseline** (individual + company NMLS ID, Equal Housing Opportunity / Equal Housing Lender per officer type) and **California** (DRE + NMLS, matching DRE #01852847 / NMLS #787257 for YPN's own pages).
- [ ] **6.2** ZIP → state lookup `src/lib/compliance/zip-state.ts` (static ZIP3 prefix table, no API).
- [ ] **6.3** Officer license profile: add `licenses: { state, type, number }[]` and company NMLS to the officer record; onboarding asks for them. Disclosures must use **the loan officer's** licenses, not YPN's, on MLO content.
- [ ] **6.4** `applyComplianceGuardrails({ text, channel, officer, zip })` → `{ text, appended[], blocked?, reasons[] }`. Appends required disclosures, shortens for SMS, blocks when the officer is not licensed in the borrower's state. Reuses `marketing-compliance.ts` checks (rates, guarantees).
- [ ] **6.5** Unit tests (requested): CA footer, multi-state officer, unlicensed state blocked, SMS length variant, idempotent (running twice does not double the disclosure), no officer licenses → blocked.
- [ ] **6.6** Wire in: Cerebro outgoing drafts (`follow-up-tools.ts`), social writer (`/tools/social-writer`), `/lo/[slug]` and ZIP page footers (`mlo-compliance-footer.tsx`).
- [ ] **6.7** ⚖️ Rule text for each added state reviewed by a compliance professional before turning that state on. States off by default; unknown state = federal baseline + "verify" flag.

## 6. Upgrade 3: PWA + Instant Lead Handoff

- [ ] **3.1** ✅ `src/app/manifest.ts` (Next built-in), icons in `public/`, `theme_color`, `start_url=/dashboard`.
- [ ] **3.2** ✅ Service worker `public/sw.js`: offline shell for `/dashboard` only, **never cache API responses or lead pages** (PII). Register from a client component.
- [ ] **3.3** ✅ Mobile pass on dashboard lead list and lead card (tap targets, one-column layout).
- [ ] **3.4** 📦 Web Push: `web-push` package + VAPID keys in server env; `PushSubscriptionRecord`; `/api/push/subscribe`; settings toggle. Push text holds **no PII** ("New high-intent lead in 93720"), detail only after login.
- [ ] **3.5** "High intent" trigger: reuse `qualification.ts` lead quality (later upgrade 5 score). Fire push on threshold.
- [ ] **3.6** 💳 SMS escalation (Twilio, MLO's own phone, MLO opts in): if push not opened in N minutes, text the MLO. Uses existing `outreach.ts`.
- [ ] **3.7** Live Takeover: add `chatSession.mode: "ai" | "human"`; MLO "Take over" button pauses Cerebro for that session; borrower sees "You're now chatting with {officer}". MLO replies via `/api/assistant/takeover` (session + officer ownership check). Tests: AI stays silent in human mode; another MLO cannot take over.
- [ ] **3.8** Live view: polling (5s) first, no new infra. Server-sent events later if needed.

## 7. Upgrade 5: Predictive Enrichment & Lead Scoring

- [ ] **5.1** ✅ Deterministic 0–100 score `src/lib/scoring/lead-score.ts` from data we already have: program, timeline, credit band, down payment, engagement (chat depth, return visits), equity when known. Weighted, explainable (`reasons[]`). Tests with fixed fixtures.
- [ ] **5.2** ✅ Background worker using the existing cron pattern (`/api/automation/process` + CRON_SECRET): queue `EnrichmentJob` records, process N per run, retry with backoff.
- [ ] **5.3** 💳 Property/AVM adapter `src/lib/enrichment/avm.ts` (interface + "none" stub). Pick a provider later (ATTOM, CoreLogic, HouseCanary or similar; pricing unverified). Feeds equity and LTV into `property-equity.ts`.
- [ ] **5.4** 💳⚖️ Public-record signals (probate, divorce, marriage): **use only as area/timing signals for the MLO's outreach, never inside an individual borrower's score.** Marital status is a protected class under ECOA/Reg B; scoring people on divorce or marriage risks fair-lending claims. Also check the data vendor's permitted-use terms (FCRA).
- [ ] **5.5** AI layer (paid key only): AI writes a one-line explanation of the score; it never changes the number.
- [ ] **5.6** Lead card UI: score badge, top 3 reasons, equity / LTV when available, "estimate" label.

## 8. Upgrade 2: Two-Way LOS & CRM Integrations

- [ ] **2.1** ✅ Adapter interface `src/lib/integrations/crm/types.ts`: `pushLead`, `updateLead`, `pullChanges`, `verifyWebhook`, `mapStatus`.
- [ ] **2.2** ✅ Encrypted credential store: OAuth tokens / API keys per officer, encrypted with F1, refresh-token rotation, never logged.
- [ ] **2.3** ✅ Generic outbound webhook adapter (upgrade of `external-webhook.ts`) with HMAC signing; works with any CRM via Zapier today.
- [ ] **2.4** ✅ Idempotent inbound webhook route `/api/webhooks/crm/[vendor]`: signature check, F6 `once()`, external-id ↔ lead-id map, last-writer-wins with timestamps, no duplicate leads.
- [ ] **2.5** 💳 First native adapter: the CRM most YPN officers use (David picks). Then the rest one by one: **Lofty, Top Producer, Surefire, Encompass**. Each needs vendor API / partner access and, for Encompass, the officer's company admin to approve. Access terms unverified until we apply.
- [ ] **2.6** Settings page: connect / disconnect, last sync time, error log (no PII).
- [ ] **2.7** Tests: duplicate webhook = one lead, replay with old signature rejected, token refresh, field mapping per vendor with fixtures.

## 9. Upgrade 4: Realtor Co-Marketing Portal ⚖️

- [ ] **4.0** ⚖️ **RESPA Section 8 review first.** Co-marketing cost splits must match each party's actual share of the ad at fair market value; nothing may pay for referrals. Earlier marketing work already suggested an attorney review of the ZIP lead model; do both together.
- [ ] **4.1** Role `realtor_partner` in `SessionRole`, `requireRole()` helper, deny-by-default on every existing MLO route (test each route).
- [ ] **4.2** Invitation flow: MLO invites agent by email → magic link → agent account tied to that MLO only.
- [ ] **4.3** Masking layer `src/lib/realtor/mask.ts`: realtor view gets name, property interest, stage only. Never credit band, income, debts, assets, loan amount, SSN, documents. Server-side (never hide in UI only). Tests prove masked fields never leave the API.
- [ ] **4.4** Co-branded ZIP campaign pages: both licenses shown (via upgrade 6).
- [ ] **4.5** Cost-split ledger: `CoMarketingAgreement { mloId, agentId, campaignId, mloPct, agentPct, basis, signedAt }`, append-only, exportable for audit.
- [ ] **4.6** Agent dashboard: campaigns, page views, leads (masked), shared costs.

## 10. Upgrade 1: Outbound AI Voice Assistant (last) 💳⚖️

- [ ] **1.0** ⚖️ **TCPA:** the FCC ruled in 2024 that AI-generated voices count as "artificial" voices, so AI calls to cell phones need the borrower's **prior express written consent** for that kind of call. F4 consent ledger must show `ai_voice` consent with the exact text shown. Calling hours, DNC list scrub, caller ID, opt-out on every call.
- [ ] **1.1** Provider choice: **recommend Twilio** (already wired for inbound + SMS, one vendor, one bill) over Vapi or Bland. Adapter interface keeps the option open.
- [ ] **1.2** Trigger service `src/lib/voice/outbound/trigger.ts`: on high-intent lead + `canContact(lead, "ai_voice")` + MLO enabled it → create `OutboundCallJob` (default: **MLO approves each call**, matching the current queue).
- [ ] **1.3** Guardrail prompt + server check: never quote a rate, APR or payment as an offer; never give credit or legal advice; always say it's an AI assistant for {officer}; hand off to the MLO (existing `<Dial>` handoff) on request.
- [ ] **1.4** Transcript + outcome saved to lead timeline, **encrypted (F1)**; recordings off by default (two-party consent states such as California need disclosure).
- [ ] **1.5** Tests: no consent = no call, quiet hours blocked, rate quote in transcript flagged, transcript stored encrypted.

---

## 11. What David must decide or sign up for

| When | Decision / signup |
|---|---|
| Now | Approve this order (Foundations → 6 → 3 → 5 → 2 → 4 → 1). |
| Before Foundations F2 | OK to encrypt the live data file (we back it up first). |
| Before upgrades 1, 2, 5 | Paid AI key (Gemini paid tier or another provider). |
| Before upgrade 2 | Move from the data file to Postgres (small monthly AWS cost), and which CRM to build first. |
| Upgrade 3 SMS / upgrade 1 | Twilio account (costs already researched, nothing signed up). |
| Upgrade 5 | Which property / AVM data provider (paid). |
| Before upgrade 4 launch | RESPA attorney review. |
| Before each new state in upgrade 6 | Compliance review of that state's disclosure text. |

## 12. Packages that would need approval (none installed yet)

| Package | For | Size |
|---|---|---|
| `web-push` | Upgrade 3 push alerts | small |
| `pg` | Postgres move (F5) | small |

Everything else uses Node's built-in `crypto` and `fetch`.

## 13. Security rules for all steps

- No raw PII, bank data, credentials or tokens in logs, test snapshots, or error messages.
- Secrets only in the server env file, never in the repo or this plan.
- No destructive data migrations or new heavy packages without David's yes.
- Every outbound message (SMS, email, call) passes `canContact()` and `applyComplianceGuardrails()`.
