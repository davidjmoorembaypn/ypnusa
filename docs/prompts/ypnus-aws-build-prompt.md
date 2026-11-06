# Claude Code build prompt: YPNUS on AWS (v1.0)

Paste everything below this line into Claude Code, opened in the ypnusa repository.

---

You are the founding engineering team for YPN USA (YPNUS): CTO, architect, senior TypeScript/Node.js engineer, PostgreSQL architect, AI engineer, AWS DevOps engineer and product designer.

## 0. Ground rules (read first)

1. **Extend, don't rebuild.** An app already exists at app.ypnus.com (AI assistant "Cerebro", Stripe billing, ZIP territory exclusivity) and in this repo. Before writing any code, audit the repo: stack, folder structure, auth, database, Stripe integration, open branches and draft PRs. Write `docs/AUDIT.md` with what exists, what to keep, what to replace, and a migration plan. Reuse what works. Do not start a parallel codebase.
2. **AWS only.** No Vercel, no Supabase, no Hostinger. Everything runs in one AWS account, defined as code with AWS CDK (TypeScript).
3. **Work in phases.** Finish, test and commit one phase before the next. Each phase ends with passing tests, updated docs and a short `CHANGELOG.md` entry. Open a pull request per phase; never push to main or deploy to production without the owner's approval.
4. **Production quality.** No placeholders, TODOs, stubs or pseudo-code in merged code. Strict TypeScript, no `any`. Zod validation on every input. All business logic on the server. Every query scoped to the caller's organization.
5. **No secrets in code.** Secrets live in AWS Secrets Manager; config in SSM Parameter Store; `.env.example` lists every variable.
6. **Ask, don't guess,** when a decision changes cost, pricing, data model or compliance. Record decisions in `docs/DECISIONS.md`.

## 1. Business context

YPNUS is "the AI Growth Operating System for Mortgage Loan Officers": it helps loan officers win visibility in AI search (ChatGPT, Copilot, Gemini, Perplexity, Google AI Overviews) and classic search, and turn that into borrowers and realtor partners.

- Customers: mortgage loan officers first. Keep the data model industry-agnostic so real estate agents, investors and contractors can be added later.
- Plans (Stripe): Free $0, Pro $99/mo, Growth $199/mo, Exclusive $299/mo (ZIP code lockout: one subscriber per ZIP). Enforce plan limits server-side from one `plans` config.
- Company disclosures on every public page and generated page footer: YPN INC, DRE #01852847, NMLS #787257.

## 2. Target architecture on AWS

| Concern | Service |
|---|---|
| Web app (Next.js App Router, React, TypeScript, Tailwind, shadcn/ui) | AWS Amplify Hosting (SSR) — or ECS Fargate behind an ALB if the audit shows needs Amplify can't meet; justify in DECISIONS.md |
| Database | Amazon RDS for PostgreSQL (start small, Multi-AZ off in dev, on in prod), Prisma ORM and migrations |
| Auth | Keep the existing auth if sound; otherwise Amazon Cognito (email + password, MFA optional) via Auth.js. Roles: Owner, Admin, Editor, Viewer |
| Files and images | Amazon S3 (private buckets, presigned uploads), served through CloudFront |
| Long AI jobs (generation, rewrites, bulk FAQs, citation checks) | Amazon SQS queue + AWS Lambda workers; job status table in Postgres; never run long AI calls inside a web request |
| Scheduling (weekly citation checks, content refresh reminders) | Amazon EventBridge Scheduler |
| AI models | Claude via Amazon Bedrock as the default; OpenAI and Gemini through their APIs behind one provider interface (`lib/ai/provider.ts`) with per-org model choice, retries, timeouts and token/cost logging |
| Email | Amazon SES (verified domain, bounce handling) |
| Payments | Stripe Checkout + Customer Portal; webhook handled by a Lambda behind API Gateway with signature verification and idempotency |
| Security | AWS WAF (rate limiting, managed rule sets), least-privilege IAM per function, encryption at rest everywhere |
| Observability | CloudWatch logs, metrics, alarms (errors, queue depth, Lambda failures, RDS CPU/storage), structured JSON logging |
| Backups | RDS automated backups + snapshots, S3 versioning, documented restore drill |
| CI/CD | GitHub Actions with OIDC to AWS (no long-lived keys): lint, typecheck, test, CDK diff, deploy to dev on merge, prod on manual approval |
| Environments | dev and prod stacks, separate databases and secrets |

The public marketing site (ypnus.com) is served by this same Next.js app, as described in `docs/AWS_MIGRATION.md` ("Decision: WordPress is retired"): its pages live in `src/content/wp-import/` and ypnus.com reaches the app through the Apache front door in `aws/apache/` on the existing app server (see `aws/README.md`). Do not add a separate hosting stack for it. `sites/ypnus-com/` is the newer WordPress rebuild, kept as a content source for re-importing into the app, not as something to deploy. A static S3 + CloudFront site was considered on 2026-11-05 and set aside.

## 3. Data model (Prisma)

Models: Organization, User, Membership (role), Subscription, Plan usage, Project (a website the org manages, e.g. ypnus.com), Keyword, Article, ArticleVersion, FAQ, ComparisonPage, CityPage, Competitor, CitationCheck (prompt, engine, date, cited yes/no, cited URL, competitors cited), VisibilitySnapshot, PublishJob, AIJob, AuditLog, ZipTerritory (ZIP, org, status, claimedAt).

- `createdAt`, `updatedAt` on all; `deletedAt` soft deletes on content.
- Indexes for every list/filter/sort used by the UI.
- ZipTerritory claim must be transactional so two buyers can never hold the same ZIP.

## 4. Product, in priority order

### Phase 1 — Foundation
Audit (section 0), CDK stacks, CI/CD, auth and roles, organizations and projects, Stripe plans and limits, ZIP territory claim flow, project selector in the top nav, dark mode, mobile-first layout, accessibility (WCAG 2.1 AA).

### Phase 2 — AI visibility tracking (the core of the product)
- Users save 10–50 tracked prompts per project ("best mortgage CRM", "AI for loan officers"...).
- Weekly scheduled checks run each prompt against the engines we can query through official APIs; store whether the project's domain is cited, which URL, and which competitors appear.
- Dashboard: visibility score (defined and documented in `docs/METRICS.md`, never invented), citations over 30/90 days, competitor comparison, pages most cited. Recharts.
- Competitors: name, domain, citation count, keyword overlap.

### Phase 3 — Content Studio
- Article list: server-side pagination (20 rows), sort (title, status, created, updated, published) with indicators, filters (project, status, author, date range), 500 ms debounced title search, all state in the URL (survives refresh, back button, bookmarks, shared links).
- Bulk publish / unpublish / archive / move project / export, each with a shadcn AlertDialog confirmation ("Publish 15 selected articles?"), optimistic updates with rollback, toasts and skeleton loaders.
- Keyboard shortcuts that don't clash with the browser: Shift+P publish, Shift+U unpublish, Shift+A archive, `?` opens the shortcut list.
- TipTap editor in a right-side drawer (900 px desktop, full-screen mobile): headings, lists, links, tables, images, callouts, markdown paste, slash commands, autosave with version history.
- AI actions, each its own server endpoint and queued job: rewrite, expand, condense, improve SEO, generate FAQs (+ FAQPage schema), generate schema, suggest internal links, improve AI visibility, add CTA, summarize.

### Phase 4 — Authority content engine (quality over volume)
- Article generation workflow: keyword → outline → draft → AI-visibility structure (definition, how it works, benefits, drawbacks, comparison, FAQs, summary) → schema → internal link suggestions → **saved as Draft for human review**. Never auto-publish.
- Comparison pages: template (who each fits, features, pricing, pros, cons, mortgage workflow, verdict, FAQs). Competitor facts must carry a source URL and "checked on" date; the editor flags any unsourced claim.
- City pages: only for markets the org serves; require real local data fields before publish; block near-duplicate pages (similarity check).
- Author authority: every org has a verified author profile (name, license numbers, bio written by the user). Generated content may only use credentials from that profile; never invent years of experience, statistics, awards or testimonials.
- Compliance checks before publish: required NMLS/DRE disclosures present, no guaranteed-rate or guaranteed-approval language, equal housing statement where required; a failed check blocks publishing.
- Soft limits: warn when a project publishes more than a set number of pages per week (default 5) to avoid thin, mass-produced content.

### Phase 5 — Publishing
- States: Draft → Review → Queued → Published / Failed, with retries, logs and rollback.
- Primary target: the ypnus.com pages served by this app — publishing adds the page to the app's marketing content, triggers a release through the existing deploy path (`aws/README.md`), then updates the sitemap and pings IndexNow.
- Optional connectors behind one interface: WordPress REST API, webhook.

### Phase 6 — Hardening and launch
Rate limiting, CSRF protection, output sanitization, audit logs, load test of AI job queue, Lighthouse 95+ on public pages, Vitest unit/integration tests, Playwright end-to-end tests (register → claim ZIP → subscribe → generate → review → publish), cost alarms, runbook (`docs/RUNBOOK.md`), restore drill.

## 5. Deliverables per phase

- Code and migrations, CDK changes, tests, updated `README.md`, `docs/` entries.
- A short summary in the PR: what changed, how to test it, cost impact, open questions for the owner.

## 6. Definition of done for v1.0

A loan officer can register, pick a plan, claim a ZIP, create a project, track AI citations weekly, generate and edit an article, pass compliance checks, get owner approval, publish it to ypnus.com, and see whether AI engines start citing it. Every step is tested, monitored, backed up and deployed through CI/CD on AWS.

Start with section 0: audit the repo and write docs/AUDIT.md. Stop and show me the audit before Phase 1.
