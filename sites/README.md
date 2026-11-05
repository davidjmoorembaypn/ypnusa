# sites/

Standalone websites that live next to the `app.ypnus.com` Next.js app but are **not part of
its build**. Each folder has its own `package.json`, its own checks and its own deploy path.
The root `npm run lint`, `tsc`, `npm test` and `npm run build` ignore this folder.

| Folder | What it is | Status |
| --- | --- | --- |
| [`ypnus-com/`](./ypnus-com/) | The ypnus.com marketing site rebuilt from the 2026-11-04 WordPress exports as a small Express app (139 pages, 335 posts, 89 redirects), plus an AWS S3 + CloudFront + Lambda hosting plan in `ypnus-com/aws/`. | Snapshot of 2026-11-05. **Not deployed. Nothing has been created in AWS.** |

## How `ypnus-com/` relates to the rest of this repo

There are now three candidate ways to serve ypnus.com once WordPress is retired. The owner
has not picked one yet; nothing here changes production.

1. **The Next.js app itself** (`docs/AWS_MIGRATION.md`, "Decision: WordPress is retired"):
   `src/content/wp-import/` already holds an earlier import (171 posts after dedupe, 134 pages,
   330 redirects) served by app.ypnus.com, with `aws/apache/` as an Apache "front door" for
   ypnus.com on the existing EC2 host (`i-0ad200fc61f4d39f5`, us-east-2).
2. **This static site** (`sites/ypnus-com/`): pre-rendered to S3 behind CloudFront in
   **us-east-1**, with two Lambdas (forms + ZIP check, Stripe webhook). Separate CloudFormation
   stack `ypnus-site`; it does not touch the EC2 host or app.ypnus.com.
3. **The unapplied Terraform/ECS stack** in `infra/aws/` (also us-east-1).

Before deploying `sites/ypnus-com/aws/` check:

- **Account guardrails.** `aws/README.md` notes an org quarantine SCP (`p-vxracxez`) that denies
  most EC2/Lambda/CloudFormation/ECS actions in the account that hosts app.ypnus.com. The
  `ypnus-site` stack needs CloudFormation, Lambda, S3, CloudFront, ACM, WAF, SES and IAM, so it
  will fail in that account until the SCP is lifted, or it must go in a different account.
- **Region.** The stack is us-east-1 (required for CloudFront certificates and WAF); the app
  host is us-east-2. That is fine, but alarms, logs and budgets will live in two regions.
- **Stripe.** WordPress still receives the Stripe webhook; app.ypnus.com is the planned
  receiver (`docs/AWS_MIGRATION.md`). Only one system should create logins for new subscribers.
- **Deploy workflow.** `ypnus-com/aws/github-actions/deploy-site.yml` is an example kept
  outside `.github/workflows/`, so it never runs. It is manual-only if copied in.

`ypnus-com/README.md` still describes Hostinger install steps from the first draft; the AWS
path is `ypnus-com/aws/AWS-SETUP.md`. The step-by-step build prompt is
[`docs/prompts/ypnus-aws-build-prompt.md`](../docs/prompts/ypnus-aws-build-prompt.md).
