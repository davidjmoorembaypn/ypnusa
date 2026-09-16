# CRO / Agentic-AI Rebuild — Progress Log

Baseline audit performed 2026-09-16 against `origin/main` (`33ec46c`, PR #71) before starting
work on branch `feature/agentic-hero-4tier-authorhub`.

## Repo reality check (read this before assuming greenfield)

This is **not** a blank-slate build. `ypnusa` is a mature, mostly-shipped product:

- **App**: Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4, `app.ypnus.com`.
  Marketing WordPress site is `ypnus.com`; this repo is the product app only.
- **Already live/merged to `main`**: ZIP-exclusive territory checker + reservation flow, AI
  borrower intake assistant (`/embed/intake`), MLO nurture portal, equity tool, local-SEO
  city/ZIP pages, silo architecture + breadcrumb JSON-LD (PR #70), Organization/Person/
  founder E-E-A-T JSON-LD in the site-wide graph + footer bio blurb (`e763f5f`), Stripe
  fulfillment webhook, entitlements system (currently fails closed — every session resolves
  to `free` until WordPress's SSO handoff starts sending real tier claims, which is
  documented as **not live yet**).
- **50+ branches** exist from prior Claude/Cursor/Devin sessions covering autopilot,
  security hardening, revenue admin, local SEO, etc. — check `git branch -a` / open PRs
  before re-building something that may already exist on another branch.
- `/home/u853154979/public_html` is a **separate git worktree of this same repo, on
  `main`** — treat `main` as the deployed branch. Work happens on feature branches and
  gets pushed to `main` only after verification, not after every micro-commit.
- The `origin` remote URL has a GitHub PAT embedded in plaintext in `.git/config`
  (both this worktree and `ypnusa-work`). Recommend rotating it and switching to a
  credential helper rather than an inline URL.

## Gaps vs. the CRO directive (what's actually new work)

1. **Pricing**: live tiers are Free/$0, Starter/$29.99, Growth/$99, Pro/$199, Elite/$299,
   wired to `STRIPE_PRICE_ID_*` / `STRIPE_PRODUCT_ID_*` env vars in `src/lib/pricing.ts`
   and referenced across `entitlements.ts`, `checkout.ts`, `revenue.ts`, `db.ts`,
   `ai/prompts.ts`, and ~8 test files. Directive calls for Free/$0, Pro/$99, Growth/$199,
   Exclusive/$299 — **user confirmed collapsing to this exact 4-tier structure**
   (2026-09-16), accepting that this drops the $29.99 Starter tier and reuses "pro"/
   "growth" as names at swapped price points vs. today, which requires new/relabeled
   Stripe Products+Prices and updated env vars before go-live. Tracked in the
   `feature/agentic-hero-4tier-authorhub` branch.
2. **Author Hub (`/about/`)**: no dedicated page exists yet — only a footer bio blurb and
   site-wide `Person` JSON-LD. Needs a full page with `Person`/`ProfilePage` schema
   covering: CEO of YPN INC, founder of ToInvested.com, owner of YPNUS.com, MBA (CSU
   Fresno), loan-closing track record at JPMorgan Chase and Wells Fargo Home Mortgage,
   nationwide speaker, Amazon author of 3 books.
3. **Hero positioning**: `DynamicHero.tsx` already leans on the AI agent / ZIP scarcity
   angle; tightening copy to foreground "Agentic AI System" as the explicit named
   product and reinforce ZIP-lockout messaging across all paid tiers ($99+).
4. **Silo architecture / orphan pages**: already addressed in PR #70 (`/services/`,
   `/pricing/`, breadcrumb schema) — spot-checked, no further action unless Phase 4
   verification finds a regression.

## `loans.ypnus.com` audit (2026-09-16, per user direction to use it as staging reference)

`loans.ypnus.com` is a live WordPress site at
`/home/u853154979/domains/ypnus.com/public_html/loans/` — **not** part of this repo, and
not touched by this branch. It's the real destination `checkout.ts`'s `marketingUrl()`
already links out to. Findings:

- **Funnel pages already integrate exactly as this app's docs claim**: `lo-signup.html`
  calls `GET /wp-json/ypnus/v1/signup-config`, `GET /wp-json/ypnus/v1/zip-check/{zip}`,
  and `POST /wp-json/ypnus/v1/signup`; `check-zip.html` calls the same zip-check
  endpoint. This matches `AGENTS.md`'s note that live ZIP availability reads through to
  that WP REST endpoint. No hidden duplicate logic found here worth porting — the
  existing "WordPress owns checkout, this app links out / reads through" split is
  intentional and already consistent, not an oversight.
- **Live pricing.html today** (WordPress-rendered, the actual page customers see) shows
  Starter $29.99, Pro **$99.99**, Elite **$299.99**, plus a $49.99 "DFY LO Website"
  add-on — different numbers than this repo's pre-change `pricing.ts` (which had "Pro"
  at $199). The WP side's "Pro ≈ $99" is actually already closer to the directive's
  target than this repo was, which supports the 4-tier collapse decision.
- **Real, separate, currently-live bug found (not part of this branch's scope, flagging
  for a fast follow-up)**: `wp-content/plugins/ypnus-stripe-webhook/ypnus-stripe-webhook.php`
  (v2.0.0, the active copy) hardcodes `YPNUS_STRIPE_ALLOWED_TIERS` to
  `['starter','pro','elite']` — **`growth` is missing**, so growth-tier Stripe webhook
  events are silently dropped today (entitlement never applied). A fixed v2.1.0 (adds
  `growth`, plus territory-lock table migrations) already exists on disk but landed in a
  sibling folder `ypnus-stripe-webhook(1)/` because of a WordPress upload-naming
  collision — **it was never actually activated**. Whatever the final tier id set ends
  up being after this branch's rename, that plugin's allowed-tier list needs to be
  updated (ideally by properly deploying v2.1.0 first) or the same silent-drop bug will
  recur under the new tier names.
- Two other stray/uncommitted-looking items noticed in `wp-content/plugins/` worth a
  look when someone's next in there: `ypnus-lead-integration-deactivated` (named as
  disabled — confirm nothing still depends on it) and `ypnus-init-erjpjgsv` (auto-generated-
  looking name, unclear purpose).
- Directive's system-architecture section asks for `app.ypnus.com` to own "Stripe
  checkout endpoints" directly. That's a real conflict with the current, deliberate
  design (`checkout.ts`'s own doc comment: "Stripe billing is owned entirely by
  ypnus.com's WordPress plugin", by design). Moving Stripe ownership into the Next app
  would be a live-cutover project (webhook secrets, in-flight subscriptions, dual-write
  risk) — **not attempted on this branch**; flagging as a decision for the user rather
  than guessing.

## Status

- [x] Phase 1 — recon complete (this file)
- [ ] Phase 2 — pricing collapse + hero tightening + Author Hub (in progress, delegated)
- [ ] Phase 3 — silo/app routing verification
- [ ] Phase 4 — build/lint/test verification, then confirm before merging to `main`
