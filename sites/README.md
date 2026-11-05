# sites/

Website sources that live next to the `app.ypnus.com` Next.js app but are **not part of its
build and are not deployed**. The root `npm run lint`, `tsc`, `npm test` and `npm run build`
ignore this folder.

| Folder | What it is |
| --- | --- |
| [`ypnus-com/`](./ypnus-com/) | Content source: the ypnus.com marketing site rebuilt from the 2026-11-04 WordPress exports (142 pages, 335 posts, 89 redirects) as a small Express app, used for local preview and checks (`npm run check`). Snapshot of 2026-11-05. |

## How ypnus.com is served (decided 2026-11-05)

ypnus.com is served by **this Next.js app**, as planned in `docs/AWS_MIGRATION.md`
("Decision: WordPress is retired"):

- Marketing pages, posts and the 301 redirect map live in `src/content/wp-import/`
  (wired into `next.config.ts` and the `src/app/*/[slug]` routes).
- ypnus.com reaches the app through the Apache front door in `aws/apache/` on the existing
  app server (`i-0ad200fc61f4d39f5`, us-east-2). Deploys follow `aws/README.md`
  (`scripts/aws-install-release.sh`). There is no separate hosting stack for ypnus.com.
- DNS for ypnus.com stays on WordPress until the cutover items in `docs/AWS_MIGRATION.md` are
  done (Stripe webhook owner, ZIP ledger, media, final content check).

A separate static site on S3 + CloudFront (with its own Lambdas, in us-east-1) was considered
on 2026-11-05 and set aside: it needed a second system to run, and the AWS account's
quarantine SCP blocks the CloudFormation and Lambda actions it depends on. Its template and
scripts are not in this repo.

## Using `ypnus-com/` with the app

`ypnus-com/` is never deployed. It is the edited copy of the WordPress content; the app gets it
through one script:

```bash
cd sites/ypnus-com && npm ci && node scripts/export-to-app.js     # writes src/content/wp-import/
node scripts/export-to-app.js --check                              # exit 1 if the app is out of date
```

The script takes the pages the authority plan rewrote or added (comparisons, editorial policy,
methodology, founder pages, CRM wording, hand-fixed pricing) with their FAQ, schema type, author
box and "Keep exploring" links; keeps the app's own HTML for everything else and only swaps old
plan names and prices; and adds redirects the app is missing. Launch steps:
[`docs/LAUNCH-YPNUS-COM.md`](../docs/LAUNCH-YPNUS-COM.md).

The step-by-step build prompt is
[`docs/prompts/ypnus-aws-build-prompt.md`](../docs/prompts/ypnus-aws-build-prompt.md).
