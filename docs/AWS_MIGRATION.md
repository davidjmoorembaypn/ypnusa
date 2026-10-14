# Moving ypnus.com + app.ypnus.com to AWS

Status: **infrastructure code only. Nothing here has been applied or deployed.**
Production deploys need explicit owner approval (see `AGENTS.md`).

## Target

| Piece | AWS service |
| --- | --- |
| app.ypnus.com (this Next.js app) | ECS Fargate, 1 task, image in ECR, behind an ALB with ACM TLS |
| App state (`store.json`) | EFS (encrypted) mounted at `/data`, daily AWS Backup, 35-day retention |
| Secrets | Secrets Manager, injected as env vars (values set out-of-band) |
| ypnus.com (WordPress) | Lightsail WordPress or EC2 + RDS MySQL, then CloudFront in front |
| DNS | Route 53 (optional; `route53_zone_id` empty keeps your current DNS host) |

The app must stay at **one task**: the JSON store has a single writer. Scaling beyond one
task needs the Postgres migration (`migrations/001-003`) first.

## Correction: where the app runs today

The owner reports `app.ypnus.com` is currently served by **Vercel**, although the repo docs
describe Hostinger. Vercel's filesystem is ephemeral, so the file-backed store (`store.json`)
may be losing leads and territory locks between cold starts. Before anything else, open
`https://app.ypnus.com/api/health`: `"persistent": false` or `"degraded": true` confirms it.
There may be no `store.json` worth copying; the source of truth for lead data must be located
first (WordPress user meta, Supabase, or a webhook target).

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
8. Keep the current host (Vercel) running for at least 7 days as the rollback target.

## Open items that need an owner decision

- WordPress move and its backup (separate runbook, not part of this PR).
- Stripe: WordPress's webhook plugin is the system of record for entitlements; the AWS Lambda
  only feeds the revenue dashboard. Decide whether to consolidate.
- Terraform here was formatted but not validated against the AWS provider in the authoring
  sandbox (registry unreachable). Run `terraform validate` and `plan` before applying.
- The Docker image was not built in the authoring sandbox (no daemon); the Next.js standalone
  server was started directly and `/api/health` reported persistent storage.

## ypnus.com (WordPress) on Lightsail

Terraform: `infra/aws-wordpress/` (Bitnami WordPress, static IP, firewall with SSH limited to
`ssh_allowed_cidrs`, daily automatic snapshots). It builds a **staging copy only**; DNS is not touched.

1. Take a verified backup of the current site first (hPanel Backups or `scripts/aws/wp-export-source.sh`).
2. `cd infra/aws-wordpress && terraform init && terraform apply -var 'ssh_allowed_cidrs=["<your-ip>/32"]'`.
3. On the current host: `bash scripts/aws/wp-export-source.sh`; copy `~/ypnus-wp-export/` to the instance (`scp`).
4. On the instance: `STAGING_URL=http://<static_ip> bash wp-import-target.sh`.
5. Test via an `/etc/hosts` entry (ypnus.com -> static IP): pages, forms, SMTP mail, Stripe webhook, SSO handoff to the app.
6. TLS and edge: issue a certificate (Lightsail/Let's Encrypt via `bncert-tool`, or CloudFront + ACM) and replace
   LiteSpeed page caching with CloudFront or a WordPress cache plugin. LiteSpeed Cache is server-bound and is
   deactivated by the import script.
7. Cutover (needs owner approval): lower DNS TTL to 300 a day ahead, re-run an incremental export right before the switch,
   point `ypnus.com` and `www` at the static IP, then re-run `search-replace` from the staging URL to `https://ypnus.com`.
   Keep the old host for 7+ days.

Open: the Stripe webhook endpoint and any allow-listed IPs on the WordPress side must be updated for the new address.
