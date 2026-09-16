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

## Status

- [x] Phase 1 — recon complete (this file)
- [ ] Phase 2 — pricing collapse + hero tightening + Author Hub (in progress, delegated)
- [ ] Phase 3 — silo/app routing verification
- [ ] Phase 4 — build/lint/test verification, then confirm before merging to `main`
