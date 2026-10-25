# Migration runbook: WordPress/Hostinger → AWS (ypnus-edge)

Nothing below has been executed. Every step that changes AWS, DNS or WordPress needs the owner's explicit
approval at the time. Order matters. Stop at any failed check.

## 0. Preconditions
1. Production app is healthy (`curl https://app.ypnus.com/api/health` shows JSON) and the pending release is deployed.
2. Full WordPress backup (files + database) stored off-host, and a Search Console export of top pages/queries.
3. List every public URL: WordPress `sitemap.xml` + Search Console "Pages" + analytics landing pages → `legacy-urls.txt`.
4. Lower the DNS TTL of the apex and `www` to 300 seconds, 24 hours before cutover.

## 1. Build and publish artifacts
```bash
cd platform/ypnus-edge && npm test && npm run test:browser
npm run package            # dist/ads.zip
npm run build:template     # infra/dist/edge.yaml (redirect function injected)
npm run kvs:seed           # infra/dist/kvs/puts-*.json (169 redirect keys)
aws s3 cp dist/ads.zip s3://<code-bucket>/ypnus-edge/ads.zip
aws s3 cp public/ypn-ads.js  s3://<media-bucket>/assets/ypn-ads.js --cache-control "public,max-age=31536000,immutable"
aws s3 cp public/ypn-ads.css s3://<media-bucket>/assets/ypn-ads.css --cache-control "public,max-age=31536000,immutable"
```
Version the asset filenames (`ypn-ads.<hash>.js`) before enabling long caching.

## 2. Deploy the web tier (us-east-2)
Build the existing root `Dockerfile` for arm64 with the public build args the GitHub workflow uses
(`NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_*`; the Dockerfile needs matching `ARG`s), push to ECR, then:
```bash
aws cloudformation deploy --stack-name ypnus-web --template-file infra/web-fargate.template.yaml \
  --capabilities CAPABILITY_IAM --parameter-overrides ImageUri=... CloudFrontPrefixListId=pl-... \
  OriginVerifyToken=... AppSecretArn=...
```
Copy secrets from `/etc/ypnusa/app.env` into the Secrets Manager secret (never into the template). Seed `store.json` on
EFS from the latest `/var/backups/ypnusa` backup **before** the first task starts, or customer data will be empty.

## 3. Deploy the edge (us-east-1)
Request the ACM certificate (apex + www) in us-east-1 first. Then:
```bash
aws cloudformation deploy --region us-east-1 --stack-name ypnus-edge --template-file infra/dist/edge.yaml \
  --capabilities CAPABILITY_IAM --parameter-overrides CertificateArn=... WebOriginDomain=<ALB dns> \
  CodeBucket=... LegacyWpOriginDomain=<wordpress origin host>
```
Load redirects: for each `infra/dist/kvs/puts-NNN.json`, get the store ETag and call
`aws cloudfront-keyvaluestore update-keys --kvs-arn <RedirectStoreArn> --if-match <etag> --puts file://puts-NNN.json`.

## 4. Verify before DNS changes (no public impact)
```bash
IP=$(dig +short <distribution>.cloudfront.net | head -1)
node scripts/verify-redirects.mjs --base https://ypnus.com --file legacy-urls.txt   # with: curl --resolve ypnus.com:443:$IP
```
Required: 100% of legacy URLs are one 301 to a 200 (or an intentional 410); homepage, `/pricing`, `/check-zip`,
`/blog/*` return 200; `/api/health` OK; a Stripe test webhook reaches `/api/webhooks/stripe`; the ZIP lookup works
through `/wp-json/*` if WordPress is still the ledger.

## 5. Cutover
1. Freeze WordPress content edits. 2. Point apex and `www` at the distribution (ALIAS/CNAME). 3. Re-run
`verify-redirects` against the live domain. 4. Submit the new sitemap in Search Console. 5. Watch CloudFront 4xx/5xx,
Search Console Coverage and analytics hourly for 48 hours.

**Rollback:** set DNS back to the previous Hostinger records (kept intact). Keep Hostinger paid for at least 30 days.

## 6. After cutover
- Weeks 1-4: monitor 404s in Search Console and add any missed URL to the KeyValueStore (no redeploy needed).
- Raise redirect cache to 1 day once stable. Never delete redirects.
- Retire WordPress only after the ZIP ledger and Stripe webhook no longer depend on it and a native login exists.

## 7. Turning on ads (separate approval, after steps 1-6 are stable)
1. Ship with `DspEndpointsJson=[]` (house ads only) and verify Core Web Vitals in the field.
2. Add the consent banner that sets `window.YPN_CONSENT`, the "Do Not Sell or Share" link and updated privacy policy.
3. Sign a DSP/SSP agreement, set `DSP_ENDPOINTS` with each DSP's `noticeDomains`, start with one DSP.
4. Add slots to blog templates only: `<div class="ypn-slot" data-ypn-slot="top" data-size="300x250"></div>`, plus the
   `<link rel="stylesheet" href="/assets/ypn-ads.css">` and `<script src="/assets/ypn-ads.js" defer></script>`.
5. Watch the `AdsLatencyAlarm`, fill rate, and Lighthouse/CrUX CLS and INP. Roll back by emptying `DSP_ENDPOINTS`.
