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

`ypnus-com/` is never deployed. Treat it as the newer, cleaner copy of the WordPress content
to port into `src/content/wp-import/` in a follow-up PR. Compared with the app's 2026-10-21
import, it adds:

- Pages the app doesn't have yet: `/agents/david-j-moore-mba`, `/editorial-policy`,
  `/research-methodology`, `/ypn-usa-partner-suite`.
- Rewritten comparison pages (`content/pages/vs/`, `authority/`) and internal links from the
  authority plan, which was still being edited when this snapshot was taken.
- Fewer leftovers of the old tier names: "Elite" appears 28 times across 15 of its files, versus 720 times in
  the app's current import. Those still need a pricing pass before or during the port.

Every one of its 335 posts already exists in the app, either as a canonical post or as a
redirect to one.

The step-by-step build prompt is
[`docs/prompts/ypnus-aws-build-prompt.md`](../docs/prompts/ypnus-aws-build-prompt.md).
