# ypnus.com on AWS: plan and setup guide

Prepared 2026-11-05. Nothing has been created in AWS, DNS or Stripe yet; every step below is yours to run.

## 1. Recommendation

Run ypnus.com as **pre-built pages on Amazon S3 behind Amazon CloudFront**, with the few live parts (lead form, ZIP check, Stripe webhook) as **two small AWS Lambda functions**. Put DNS on **Route 53** and subscribe the CloudFront distribution to the **CloudFront Pro flat-rate plan ($15/month)**, which bundles the CDN, firewall (WAF), DDoS protection, DNS and logs into one bill with no overage charges.

Why this shape:

- **Fast and SEO-safe.** Every one of the 482 URLs is a ready file served from 750+ edge locations. Same URLs, trailing slashes, canonicals, JSON-LD, sitemaps and 301s as the Node build (all 89 redirects plus 475 old `?p=ID` links are answered at the edge).
- **Nothing to patch.** No server, no WordPress, no PHP. Publishing = push to GitHub; the site rebuilds and goes live in about 2 minutes.
- **Cheap and predictable.** About **$16–17/month** all-in on the Pro plan (section 3).
- **Reversible.** WordPress on Hostinger stays untouched until you switch DNS, and switching back is one command (about 5 minutes).

Alternative considered: AWS Amplify Hosting is a few clicks simpler for the static part, but it bills bandwidth at a higher rate, has no bundled firewall, handles the redirect list less precisely, and the form/Stripe functions would still be separate. Not recommended here.

## 2. Architecture

```
                  Visitors / Google / AI crawlers                    Stripe
                               │                                       │ webhook
                               ▼                                       ▼
   Route 53 DNS ──►  CloudFront (ypnus.com, www → ypnus.com)  ◄── WAF: rate limit on forms, AWS managed rules
                     │  edge function: WordPress URLs, 301s from KeyValueStore, /foo → /foo/
        ┌────────────┼─────────────────────────┬───────────────────────────────┐
        ▼            ▼                         ▼                               ▼
  S3 site/       S3 media/            /api/* and /wp-json/*            /api/stripe/webhook
  482 pages,     wp-content/uploads   API Gateway → Lambda "api"       API Gateway → Lambda "stripe-webhook"
  sitemaps,                            ├─ POST /api/lead → DynamoDB Leads, SES email, optional CRM webhook
  feed                                 └─ GET /api/zip-check/{zip} → DynamoDB ZIP ledger
                                                                         ├─ claims/releases ZIPs in DynamoDB
  Secrets Manager: Stripe + webhook settings                             ├─ records subscriptions
  CloudWatch alarms + Route 53 health check + budget → email to you      └─ forwards to app.ypnus.com (logins)

  GitHub (ypnus-site repo) ── push to main ──► GitHub Actions: check → build → upload → refresh cache
```

| Need | AWS service | Notes |
|---|---|---|
| Pages, posts, sitemaps, feed | S3 (private) + CloudFront | Built by `aws/scripts/build-static.js` from the Node app; 567 files, ~20 MB |
| 301 redirects, `?p=ID`, `www`, legacy WordPress URLs | CloudFront Function + KeyValueStore | 97 redirects + 475 IDs, updated on every deploy |
| Images (`/wp-content/uploads/...`) | S3 `media/` prefix | Same URLs as today |
| Lead forms | Lambda + DynamoDB leads table + SES email | Same `/api/lead` and old `/wp-json/.../lead` URLs |
| ZIP territory check | Lambda + DynamoDB ZIP ledger table | Ledger now lives in AWS; Stripe keeps it current |
| Stripe webhook | Lambda + DynamoDB billing table | Verifies signatures, claims Exclusive ZIPs, forwards to the app for logins |
| Logins / dashboard | app.ypnus.com (not in this stack) | `/wp-login.php`, `/wp-admin`, `/login` → app.ypnus.com/login |
| TLS certificate | AWS Certificate Manager | Free, auto-renews |
| DNS | Route 53 | Covered by the flat-rate plan |
| Secrets | Secrets Manager (1 secret) | Stripe signing secret, webhook URLs |
| Monitoring | CloudWatch alarms, Route 53 health check, AWS Budget | Emails you on errors, downtime, or spend over $30 |
| Backups | S3 versioning (90 days), DynamoDB point-in-time recovery (35 days), GitHub history | Tables and bucket are kept even if the stack is deleted |
| Publishing | GitHub Actions (OIDC role, no stored AWS keys) | `aws/github-actions/deploy-site.yml` |

Everything is in one CloudFormation stack (`aws/template.yaml`), in region **us-east-1** (N. Virginia), which CloudFront certificates and WAF require.

## 3. Monthly cost

Assumptions: about 20,000 page views a month (~600,000 requests, ~30 GB transferred), 300 leads, 3,000 ZIP checks, 100 Stripe events, ~1.5 GB of files. AWS list prices as of November 2026; confirm in the AWS Pricing Calculator.

| Item | Pro flat-rate plan (recommended) | Pay-as-you-go |
|---|---|---|
| CloudFront CDN, edge function, redirects store | in plan | $0 (always-free tier: 1 TB, 10M requests) + ~$0.02 |
| WAF firewall (1 web ACL, 4 rules) | in plan | ~$9.40 ($5 + $1/rule + $0.60 per 1M requests) |
| Route 53 hosted zone + DNS queries | in plan | ~$0.90 |
| S3 storage + deploy uploads | ~$0.10 (50 GB storage credit in plan) | ~$0.15 |
| Lambda | $0 (always-free tier) | $0 |
| API Gateway HTTP API | ~$0.01 | ~$0.01 |
| DynamoDB (on-demand + backups) | ~$0.05 | ~$0.05 |
| SES email (~400/month) | ~$0.04 | ~$0.04 |
| Secrets Manager (1 secret) | $0.40 | $0.40 |
| Route 53 health check | $0–0.50 | $0.50 |
| CloudWatch alarms (6) + logs | $0 (free tier) | $0 |
| CloudFront plan fee | $15.00 | — |
| **Total** | **≈ $16–17 / month** | **≈ $11–12 / month** |

At 10× the traffic the Pro plan stays about the same; pay-as-you-go climbs once you pass the free tier, and a bot flood or DDoS can add charges. The Pro plan never bills overages. Without WAF, pay-as-you-go drops to about $2–3/month, but the lead forms then have only API Gateway throttling against spam.

Note: CloudFront flat-rate plans can't be used while the AWS account itself is on the AWS **Free Plan** (new accounts). If yours is, switch the account to the Paid plan first (Billing console → Upgrade plan; this costs nothing by itself).

## 4. Decisions for you

1. **Billing model:** CloudFront Pro plan ($15 flat, recommended) or pay-as-you-go (~$11–12, can spike).
2. **DNS:** move ypnus.com DNS to Route 53 (recommended; needed for the automatic certificate and the one-command switch/rollback), or keep it at Hostinger and do those steps by hand.
3. **Logins and provisioning:** after the switch, WordPress no longer receives Stripe events or logins. Before cutover, app.ypnus.com must accept the forwarded Stripe event (or new subscribers won't get accounts). This is the one hard blocker.
4. **Code home:** this plan uses the ypnus-node build. If you choose the ypnusa repo draft (PR 119) as the base instead, the `aws/` folder moves there and the build script needs adapting.
5. **Where lead emails go:** `support@ypnus.com` by default, plus your existing nurture/CRM webhook if you give its URL.

## 5. Setup, step by step

Time: about 2–3 hours of your attention, spread over 2–3 days (DNS changes need time to spread). Every command runs in **AWS CloudShell** (the `>_` icon at the top of the AWS console), which already has the AWS CLI, SAM CLI, Node.js, Python and git. Set the console region (top right) to **US East (N. Virginia) us-east-1** first.

### Step 1. Prepare the AWS account (15 min)

1. Sign in to the AWS console. Turn on MFA for the root user (account menu → Security credentials → Assign MFA).
2. Create your everyday admin login: IAM Identity Center → Enable → Users → Add user → add to a group with the `AdministratorAccess` permission set. Sign in with that user from now on.
3. If the account is on the Free Plan: Billing and Cost Management → Upgrade plan. (The stack adds a $30/month budget alert for you.)

### Step 2. Put the code in GitHub (15 min)

1. Create a private repository named `ypnus-site` on github.com.
2. On your computer, unzip `ypnus-node-aws.zip`, open GitHub Desktop → File → Add local repository (or New repository) on that folder → Publish to `ypnus-site` (keep it private).
3. In the repo: copy `aws/github-actions/deploy-site.yml` to `.github/workflows/deploy-site.yml` (you'll finish its setup in step 6).

### Step 3. Move DNS to Route 53 (30 min, then up to 48 h to spread; the live site does not change)

1. In Hostinger hPanel → Domains → ypnus.com → DNS / Nameservers, write down or screenshot **every** record: A, AAAA, CNAME (`www`, `app`, others), MX, TXT (SPF, DKIM, DMARC, Google verification), CAA.
2. In CloudShell, create the hosted zone:
   ```bash
   aws route53 create-hosted-zone --name ypnus.com --caller-reference ypnus-$(date +%s) \
     --query '{ZoneId:HostedZone.Id,NameServers:DelegationSet.NameServers}'
   ```
   Keep the `ZoneId` (the part after `/hostedzone/`) and the four name servers.
3. Route 53 console → Hosted zones → ypnus.com → **Create record** for each record from step 3.1, with the same name, type, value and TTL. Email depends on MX and TXT being exact.
4. Check that the new zone answers the same as today (replace NS1 with one of your four AWS name servers):
   ```bash
   command -v dig >/dev/null || sudo dnf install -y bind-utils
   for t in A MX TXT; do echo "== $t"; dig +short ypnus.com $t; dig +short ypnus.com $t @NS1; done
   dig +short app.ypnus.com @NS1; dig +short www.ypnus.com @NS1
   ```
5. In hPanel (or wherever ypnus.com is registered) → Nameservers → Change → use custom nameservers → paste the four AWS name servers → Save.
6. Wait until this shows `awsdns` names (usually 1–24 h):
   ```bash
   dig +short NS ypnus.com
   ```

### Step 4. Create the AWS stack, preview only (20 min)

```bash
# Upload ypnus-node-aws.zip with CloudShell's Actions → Upload file, then:
cd ~ && unzip -q -o ypnus-node-aws.zip -d ypnus-site && cd ypnus-site
bash aws/deploy-stack.sh          # first run creates aws/stack.env and stops
nano aws/stack.env                # set ALERT_EMAIL, HOSTED_ZONE_ID (from step 3), GITHUB_REPO=<you>/ypnus-site; Ctrl+O, Enter, Ctrl+X
bash aws/deploy-stack.sh          # creates everything (10-15 min); prints the outputs table
bash aws/scripts/deploy.sh        # builds and uploads the site; prints the preview address
```

Then:

- Open the **AlertEmail** inbox and click **Confirm subscription** in the AWS Notifications email.
- Open the printed `https://dxxxxxxxx.cloudfront.net/` address and check: home page, `/pricing.html`, `/check-zip.html`, a blog post, `/blog/page/2/`, `/sitemap_index.xml`, `/feed/`, `/2967/` (should redirect), `/about` (should add the slash). The preview's robots.txt keeps search engines out, and every canonical already points at ypnus.com.
- If the stack fails with "OIDC provider already exists", set `CREATE_GITHUB_OIDC=false` in `aws/stack.env` and run `bash aws/deploy-stack.sh` again.

### Step 5. Copy images (15 min)

Recommended (complete): hPanel → File Manager → `public_html/wp-content/uploads` → right-click → Compress (zip) → download it. In CloudShell: Actions → Upload file → `uploads.zip`, then:

```bash
cd ~/ypnus-site && unzip -q ~/uploads.zip -d ~/media && bash aws/scripts/media-copy.sh ~/media/uploads
```

(If the zip unpacks to a different folder name, point the command at the folder that holds the `2026/` year folders.)

Quick alternative (only the 110 images the pages reference, while WordPress is still live): `bash aws/scripts/media-copy.sh --from-live`.

### Step 6. Settings, email, Stripe, ZIP ledger, auto-publishing (40 min)

1. **Settings secret:** Secrets Manager console → the secret named in the `SecretArn` output → Retrieve secret value → Edit. Fill what you have:
   - `LEAD_WEBHOOK_URL` / `LEAD_WEBHOOK_SECRET`: where WordPress used to send leads for your nurture sequence (Zapier, CRM, or app.ypnus.com).
   - `PROVISION_WEBHOOK_URL` / `PROVISION_WEBHOOK_SECRET`: the app.ypnus.com endpoint that creates logins from a Stripe event.
   - `STRIPE_WEBHOOK_SECRET`: from Stripe, next point.
2. **Stripe:** Dashboard → Developers → Webhooks → Add endpoint → URL = the `StripeWebhookUrl` output → events `checkout.session.completed` and `customer.subscription.deleted` (add any your app needs) → copy its **Signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`. Keep the old WordPress endpoint on until cutover. Make sure Exclusive checkouts carry `plan` and `zip` in the Checkout Session metadata (or list the Exclusive price IDs in `EXCLUSIVE_PRICE_IDS`). Use **Send test webhook**; you should get an email.
3. **Email:** SES verifies ypnus.com by itself within about an hour (the stack added the DKIM records). Check SES console → Identities → ypnus.com = Verified. Then submit a test lead on the preview site; `support@ypnus.com` should get it.
4. **ZIP ledger:** export claimed ZIPs from WordPress to a CSV with the header `zip,status,email,subscription_id`, upload it to CloudShell, and run:
   ```bash
   python3 aws/scripts/zip-ledger-import.py ~/claimed-zips.csv
   ```
   Check a claimed ZIP on the preview `/check-zip.html`: it should say taken.
5. **Auto-publishing:** GitHub repo → Settings → Secrets and variables → Actions → New repository secret `AWS_DEPLOY_ROLE_ARN` = the `DeployRoleArn` output. Push any small change (or Actions → Deploy ypnus.com → Run workflow) and watch it go green.

### Step 7. Attach ypnus.com to CloudFront (15 min; traffic still on WordPress)

```bash
cd ~/ypnus-site && sed -i 's/^USE_CUSTOM_DOMAIN=.*/USE_CUSTOM_DOMAIN=true/' aws/stack.env
bash aws/deploy-stack.sh          # adds the free TLS certificate (validates by itself in ~5-30 min), www, health check
```

Then choose the billing plan (decision 1): CloudFront console → your distribution → **Pricing plan** → Pro → Subscribe, and under **Manage plan** attach the ypnus.com hosted zone so DNS is covered too.

Test the real domain against CloudFront without switching anyone over:

```bash
CF=$(aws cloudformation describe-stacks --stack-name ypnus-site --query "Stacks[0].Outputs[?OutputKey=='DistributionDomain'].OutputValue" --output text)
IP=$(dig +short $CF | head -1)
curl -sI --resolve ypnus.com:443:$IP https://ypnus.com/ | head -5
curl -s  --resolve ypnus.com:443:$IP https://ypnus.com/api/health
```

### Step 8. Cut over (10 min, reversible)

Before: the app.ypnus.com provisioning hand-off works (decision 3), WordPress content is frozen (if you edited WordPress since the export, re-export, re-import with `npm run import -- --force wxr/<file>.xml`, push), and the 10 pages with old pricing are fixed or accepted.

```bash
cd ~/ypnus-site
python3 aws/scripts/dns-cutover.py backup      # saves today's ypnus.com/www records to dns-backup.json
python3 aws/scripts/dns-cutover.py lower-ttl   # do this the day BEFORE, so the switch spreads in ~5 min
# switch day:
python3 aws/scripts/dns-cutover.py cutover
```

Right after:

1. Stripe → point the webhook at `https://ypnus.com/api/stripe/webhook` (edit the endpoint URL) and disable the old WordPress endpoint.
2. Check `https://ypnus.com/`, a post, a lead form, a ZIP check, `https://www.ypnus.com/` (should go to ypnus.com) and `https://ypnus.com/wp-admin` (should go to the app login).
3. Google Search Console → Sitemaps → submit `https://ypnus.com/sitemap_index.xml`; URL Inspection on the home page and two posts. Do the same in Bing Webmaster Tools.

**Rollback** (WordPress serves again within about 5 minutes):

```bash
python3 aws/scripts/dns-cutover.py rollback
```

Keep the Hostinger plan and `dns-backup.json` for at least 30 days.

### Step 9. Day to day

- **Edit or add a page/post:** change the file in `content/` on GitHub (web editor is fine) → Commit → live in ~2 minutes. The check step stops the deploy if a page or redirect breaks.
- **Add a redirect:** add a line to `data/redirects-extra.json` → commit.
- **Add images:** upload to the `media/wp-content/uploads/...` folder of the S3 bucket (S3 console → Upload), or keep them in `public/` in the repo for small files.
- **See leads:** DynamoDB console → Tables → the Leads table → Explore items (each lead also arrives by email).
- **Alarms** email you if forms or the Stripe webhook fail, if the site stops answering, or if spend heads past $30.

## 6. Backups and recovery

| What | Backup | Restore |
|---|---|---|
| Site content | GitHub history | Revert the commit; it redeploys |
| Built pages and images | S3 versioning, 90 days | S3 console → Show versions → restore |
| Leads, ZIP ledger, billing | DynamoDB point-in-time recovery, 35 days | DynamoDB → Backups → Restore to point in time |
| Settings secret | Secrets Manager versions | Secrets Manager → previous version |
| Whole stack | `aws/template.yaml` | `bash aws/deploy-stack.sh` |

## 7. Files in `aws/`

| File | What it does |
|---|---|
| `template.yaml` | All AWS resources (one CloudFormation/SAM stack) |
| `deploy-stack.sh`, `stack.env.example` | Create/update the stack with your settings |
| `scripts/build-static.js` | Renders the Node app into static files + the redirect list |
| `scripts/deploy.sh` | Build → upload → redirects → cache refresh |
| `scripts/kvs-sync.py` | Keeps the edge redirect store equal to the build's list |
| `scripts/media-copy.sh` | Copies `wp-content/uploads` to S3 |
| `scripts/zip-ledger-import.py` | Loads claimed ZIPs into DynamoDB |
| `scripts/dns-cutover.py` | backup / lower-ttl / cutover / rollback of the ypnus.com + www records |
| `functions/api/index.mjs` | Lead form, ZIP check, health check |
| `functions/stripe-webhook/index.mjs` | Stripe webhook → ZIP ledger, billing records, app hand-off |
| `github-actions/deploy-site.yml` | Auto-publish on push to main |

Checked here: the template passes `cfn-lint`; the build renders 567 files with no errors; the edge rules, lead/ZIP API and Stripe signature + ZIP-claim logic pass local tests with mocked AWS services. Not yet run against a real AWS account.

## 8. Still open (not blockers for the AWS setup itself)

- 10 pages still show old pricing (listed in `MIGRATION-REPORT.md`).
- Rank Math "Redirections" rules aren't in the WordPress export; export them into `data/redirects-extra.json` before cutover.
- Where app.ypnus.com itself is hosted is outside this plan (it could later move to AWS Amplify Hosting).
