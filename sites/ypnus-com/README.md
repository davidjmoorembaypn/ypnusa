# ypnus.com on Node.js

The YPN USA marketing site (ypnus.com), migrated from WordPress to a small Express app.
Content lives in plain files, so there is no database, no plugins and nothing to patch.

| | |
|---|---|
| Runtime | Node.js 18.18+ (22 LTS recommended) |
| Start command | `npm start` (entry file `server.js`, listens on `PORT`) |
| Content | `content/pages/**.html`, `content/posts/*.html` (HTML or Markdown + front matter) |
| Site settings | `data/site.json` (phone, address, licenses, nav, footer, pricing tiers) |
| Redirects | `data/redirects.json` (generated) + `data/redirects-extra.json` (yours) |
| Leads | `data/leads/leads.jsonl` + optional webhook |

See **MIGRATION-REPORT.md** for what was migrated, what changed and what still needs you.

---

## 1. Run it locally

```bash
npm install
npm run dev          # http://localhost:3000  (auto-restarts on file changes)
npm run check        # boots the app and tests every URL, redirect, title, canonical, JSON-LD and internal link
```

## 2. Edit content (no code)

1. Open the file under `content/pages/` or `content/posts/` (the path matches the URL).
2. Edit the text between the tags, or the fields at the top (`seoTitle`, `description`, `robots`, `featuredImage`...).
3. Save and restart the app (hPanel **Restart**, or `kill -HUP <pid>` to reload without downtime).

**Add a blog post:** create `content/posts/my-new-post.md`:

```markdown
---
title: "My New Post"
permalink: "/my-new-post/"
date: "2026-11-05T09:00:00Z"
description: "155-character meta description."
categories: ["lead-generation"]
featuredImage: "/wp-content/uploads/2026/11/my-image.jpg"
---
Write the post in **Markdown** here.
```

Phone, address, NMLS/DRE numbers, navigation, footer links and the four pricing tiers are all in `data/site.json`.

**Comparison pages** (`/vs/*`, `/ypnus-vs-*`) are generated: edit competitor facts in `data/comparisons.json` (with source URL and check date), then run `npm run build:comparisons`. **"Keep exploring" links** under loan-type, market, feature and platform pages come from `data/internal-links.json`. The **author block** text is `founder.bio` in `data/site.json`. See `authority/CHANGELOG.md`.

## 3. Deploy to Hostinger

> Superseded: this folder is not deployed anywhere. ypnus.com is served by the Next.js app in this repo on its AWS server; see `../README.md`. The steps below are kept for reference only.

> Nothing here touches the live WordPress site until step 3.4. Back up WordPress first (hPanel > Websites > ypnus.com > Backups).

### 3.1 Upload and install (SSH)

Upload `ypnus-node.zip` to your home folder (hPanel File Manager or `scp`), then:

```bash
cd ~ && mkdir -p apps/ypnus-node && cd apps/ypnus-node
unzip -o ~/ypnus-node.zip -d .
npm ci --omit=dev

# Media: copy the WordPress uploads folder so every /wp-content/uploads/... URL keeps working
mkdir -p public/wp-content && cp -a ~/domains/ypnus.com/public_html/wp-content/uploads public/wp-content/

# Static files that lived next to WordPress (served as-is if present; pricing.html and check-zip.html are rebuilt natively, don't copy those)
for f in lo-signup.html onboarding.html favicon.ico google*.html BingSiteAuth.xml; do cp ~/domains/ypnus.com/public_html/$f public/ 2>/dev/null; done

# Settings outside the web root
cp .env.example ~/ypnus-node.env && nano ~/ypnus-node.env

# Test on a spare port, then stop it with Ctrl+C
ENV_FILE=~/ypnus-node.env PORT=3999 node server.js &
sleep 2 && curl -sI http://127.0.0.1:3999/ | head -1 && curl -s http://127.0.0.1:3999/healthz; kill %1
npm run check
```

### 3.2 Create the Node.js app in hPanel

hPanel labels change between releases; use whichever of these your plan shows.

- **Node.js Web App** (Websites > Add website > Node.js app): upload the zip or connect the GitHub repo, framework **Express / Other**, Node **22**, entry file **server.js**, build command `npm ci --omit=dev`, start command `npm start`. Add the variables from `.env.example` in the app's **Environment variables** screen.
- **Advanced > Node.js (Passenger)**: application root `apps/ypnus-node`, startup file `server.js`, Node 22. Run **NPM install**, then add `ENV_FILE=/home/<user>/ypnus-node.env` as an environment variable.

### 3.3 Review on a staging subdomain first

Attach the app to a staging subdomain (for example `new.ypnus.com`) with `SITE_URL=https://ypnus.com` (canonicals and the sitemap already point at the real domain) and `NOINDEX=1` (keeps staging out of Google). Remove `NOINDEX` at cutover.

Check: home page, `/pricing.html`, `/check-zip.html`, a blog post, `/sitemap_index.xml`, a contact form submission, and `https://new.ypnus.com/2967/` (should 301).

### 3.4 Cut over ypnus.com (your call, when ready)

Before switching, move what WordPress still does (see "Blocking items" in MIGRATION-REPORT.md: Stripe webhook, logins, ZIP ledger). Then:

1. hPanel: point the **ypnus.com** domain at the Node.js app (or move WordPress to a subdomain such as `wp.ypnus.com` and attach ypnus.com to the app).
2. SSL: hPanel > Security > SSL, confirm the certificate covers ypnus.com and www; enable **Force HTTPS**.
3. Purge LiteSpeed/CDN cache: hPanel > Performance > Cache Manager > Purge all.
4. Google Search Console: submit `https://ypnus.com/sitemap_index.xml` and run URL Inspection on the home page and two posts.

**Rollback:** re-attach ypnus.com to the WordPress website in hPanel. WordPress is untouched by this app.

## 4. Re-import from WordPress

If you edit WordPress again before cutting over, export again (Tools > Export > All content) and run:

```bash
npm run import -- --force wxr/your-export.xml   # several exports can be passed at once
npm run check
```

`--force` rebuilds `content/` from the export, so do it before editing files by hand.

## 5. Environment variables

| Variable | Purpose |
|---|---|
| `SITE_URL` | Canonical domain, default `https://ypnus.com` |
| `ZIP_CHECK_UPSTREAM` | URL that answers `GET <url>/<zip>` with `{success, available}`. Empty = use `data/zip-ledger.json` |
| `LEAD_WEBHOOK_URL` / `LEAD_WEBHOOK_SECRET` | Forward each lead as JSON (header `x-ypnus-secret`) |
| `MEDIA_FALLBACK_ORIGIN` | Redirect missing `/wp-content/...` files to another host (S3/CloudFront) |
| `GA_MEASUREMENT_ID` | Google Analytics 4 tag |
| `NOINDEX` | `1` on staging only: sends `X-Robots-Tag: noindex` and a disallow-all robots.txt |
| `ENV_FILE` | Path to the env file (keep it outside `public_html`) |

## 6. Project layout

```
server.js                 Express app: routing, redirects, sitemaps, RSS, caching
src/content.js            Loads content/ into memory
src/seo.js                Meta tags + JSON-LD (Organization, WebSite, WebPage, BreadcrumbList,
                          BlogPosting, FAQPage, Person + EducationalOccupationalCredential)
src/api.js                ZIP check + lead capture (replaces the WordPress REST endpoints)
views/                    EJS templates (header, footer with NMLS/DRE disclosures, pricing, ZIP check)
public/assets/            site.css, site.js
public/wp-content/        copy of WordPress uploads (step 3.1)
content/pages, posts      migrated content; content/_unpublished = drafts/private pages (not served)
data/                     settings, redirects, media list, import report
scripts/import-wxr.js     WordPress export importer
scripts/smoke-test.js     full-site check
```
