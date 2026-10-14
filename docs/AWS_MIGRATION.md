# Moving ypnus.com + app.ypnus.com to AWS

Status: **infrastructure code only. Nothing here has been applied or deployed.**
Production deploys need explicit owner approval (see `AGENTS.md`).

## Target

| Piece | AWS service |
| --- | --- |
| app.ypnus.com (this Next.js app) | ECS Fargate, 1 task, image in ECR, behind an ALB with ACM TLS |
| App state (`store.json`) | EFS (encrypted) mounted at `/data`, daily AWS Backup, 35-day retention |
| Secrets | Secrets Manager, injected as env vars (values set out-of-band) |
| ypnus.com + www (marketing site) | The same Next.js app, as extra hostnames on the same ALB/certificate. WordPress is retired. |
| DNS | Route 53 (optional; `route53_zone_id` empty keeps your current DNS host) |

The app must stay at **one task**: the JSON store has a single writer. Scaling beyond one
task needs the Postgres migration (`migrations/001-003`) first.

## Correction: where the app runs today

The owner reports `app.ypnus.com` is currently served by **Vercel**, although the repo docs
describe Hostinger. Vercel's filesystem is ephemeral, so the file-backed store (`store.json`)
may be losing leads and territory locks between cold starts. Before anything else, open
`https://app.ypnus.com/api/health`: `"persistent": false` or `"degraded": true` confirms it.
If so there may be no `store.json` worth copying, and the real source of truth for lead data
(WordPress user meta, a webhook target, another database) must be located first.

## Decision: WordPress is retired

The owner does not want to keep WordPress. ypnus.com will be served by this Next.js app.
Remaining work before ypnus.com can cut over (tracked as follow-ups, none done yet):

1. Export the 138 pages / 335 posts from WordPress to MDX (or the existing `src/content`) and
   generate a 301 redirect map from every old URL, so rankings survive.
2. Make canonical URLs, sitemap and metadata host-aware (today `NEXT_PUBLIC_SITE_URL` makes
   everything canonical to app.ypnus.com).
3. Replace the `/wp-json/ypnus/v1` territory and signup calls with native routes.
4. Move the WordPress Stripe webhook and SSO claim minting into the app, and re-point Stripe.
5. Replace WPForms and WP Mail SMTP with app routes plus an email provider.

## Order of operations (each step is reversible until DNS cutover)

1. `cd infra/aws && terraform init && terraform apply` (review the plan first).
2. Add ACM validation CNAMEs from `terraform output acm_validation_records` at the DNS host
   (skip when `route53_zone_id` is set).
3. Set every secret: `aws secretsmanager put-secret-value --secret-id ypnusa/<NAME> --secret-string '<value>'`.
   Copy the values from `app/.env` on Hostinger. Never commit them.
4. Push the image: run the **Deploy to AWS (manual)** workflow, or build and push to ECR yourself.
5. Copy current state **if a persistent copy exists** (see the correction above): upload it as
   `store.json` into the EFS `/ypnusa` directory before the first task start.
6. Verify on the ALB DNS name: `/api/health` returns `"persistent":true,"degraded":false`.
7. Lower the `app` record TTL to 300 a day ahead. At cutover, point `app.ypnus.com` at the ALB.
8. Keep the current hosts (Vercel, Hostinger WordPress) running for at least 7 days as the rollback target.

## Open items that need an owner decision

- WordPress move and its backup (separate runbook, not part of this PR).
- Stripe: WordPress's webhook plugin is the system of record for entitlements; the AWS Lambda
  only feeds the revenue dashboard. Decide whether to consolidate.
- Terraform here was formatted but not validated against the AWS provider in the authoring
  sandbox (registry unreachable). Run `terraform validate` and `plan` before applying.
- The Docker image was not built in the authoring sandbox (no daemon); the Next.js standalone
  server was started directly and `/api/health` reported persistent storage.
