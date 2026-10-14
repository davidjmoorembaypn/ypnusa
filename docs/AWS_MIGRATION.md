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

## Order of operations (each step is reversible until DNS cutover)

1. `cd infra/aws && terraform init && terraform apply` (review the plan first).
2. Add ACM validation CNAMEs from `terraform output acm_validation_records` at the DNS host
   (skip when `route53_zone_id` is set).
3. Set every secret: `aws secretsmanager put-secret-value --secret-id ypnusa/<NAME> --secret-string '<value>'`.
   Copy the values from `app/.env` on Hostinger. Never commit them.
4. Push the image: run the **Deploy to AWS (manual)** workflow, or build and push to ECR yourself.
5. Copy current state: upload Hostinger's `data/store.json` into the EFS `/ypnusa` directory
   before the first task start. Otherwise leads, territory locks and sessions start empty.
6. Verify on the ALB DNS name: `/api/health` returns `"persistent":true,"degraded":false`.
7. Lower the `app` record TTL to 300 a day ahead. At cutover, point `app.ypnus.com` at the ALB.
8. Keep Hostinger running for at least 7 days as the rollback target.

## Open items that need an owner decision

- WordPress move and its backup (separate runbook, not part of this PR).
- Stripe: WordPress's webhook plugin is the system of record for entitlements; the AWS Lambda
  only feeds the revenue dashboard. Decide whether to consolidate.
- Terraform here was formatted but not validated against the AWS provider in the authoring
  sandbox (registry unreachable). Run `terraform validate` and `plan` before applying.
- The Docker image was not built in the authoring sandbox (no daemon); the Next.js standalone
  server was started directly and `/api/health` reported persistent storage.
