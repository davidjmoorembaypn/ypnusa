# ypnus.com WordPress → Node.js migration report

Generated 2026-11-05 from the four WordPress exports of 2026-11-04. Full machine-readable detail: `data/import-report.json` and `data/smoke-report.json`.

## Sources

| File | Items | Notes |
|---|---|---|
| `ypnusa.WordPress.2026-11-04.xml` (13.5 MB) | 590 | Full export: everything below |
| `ypnusa.WordPress.2026-11-04_1.xml` (10.3 MB) | 389 | Posts + their media, identical copies of items in the full export |
| `ypnusa.WordPress.2026-11-04_2.xml` (2.9 MB) | 166 | Pages + their media, identical copies |
| `ypnusa.WordPress.2026-11-04_3.xml` (406 KB) | 79 | Media library, identical copies |

All four were merged by WordPress ID (newest copy wins); no item existed only in a partial export.

## Migrated

| What | Count |
|---|---|
| Published pages | 139 |
| Published posts | 335 |
| Agent profile (`/agents/david-j-moore-mba/`) | 1 |
| Categories / tags (with archive pages) | 14 / 44 |
| Media library items listed (`data/media.json`) | 79 |
| Media URLs referenced in content (`data/media-manifest.txt`) | 110 |
| 301 redirects generated | 84 (+5 in `redirects-extra.json`) |
| URLs in the XML sitemap | 482 |

Every published URL is kept exactly as WordPress served it (trailing slash included). Also handled:

- `/?p=ID` and `/?page_id=ID` → 301 to the permalink
- Old slugs WordPress remembered (`_wp_old_slug`) → 301
- Attachment pages → 301 to their parent post (Rank Math default) or the file
- `/sitemap_index.xml`, `/page-sitemap.xml`, `/post-sitemap.xml`, `/category-sitemap.xml`, `/post_tag-sitemap.xml` (Rank Math names, so Search Console keeps working), `/sitemap.xml` alias
- `/feed/` RSS, `/category/*/`, `/tag/*/`, `/blog/page/N/`, `/author/*/` → founder page
- `/wp-login.php`, `/wp-admin/` → `https://app.ypnus.com/login`
- Rank Math SEO title, meta description, robots (22 noindex pages stay noindex and out of the sitemap), Open Graph and Twitter fields
- JSON-LD on every page: Organization (NMLS #787257, DRE #01852847, address, phone, social profiles, areaServed Visalia/Fresno/US), WebSite, WebPage/AboutPage/ContactPage, BreadcrumbList; BlogPosting on posts; FAQPage built from Rank Math FAQ blocks or visible `<details>` Q&A (skipped where the page already embeds its own FAQPage); Person with EducationalOccupationalCredential (NMLS license, CA DRE license, MBA) on posts and the founder/about/contact/profile pages
- Footer on every page: YPN Inc. not-a-lender disclosure, NMLS #787257, CA DRE #01852847, NMLS Consumer Access link, Equal Housing Opportunity, (559) 512-0372
- Lead forms: email consent and the separate call/text (TCPA) consent are both unchecked by default; email consent is required

## Fixed during import

- **10,182 stray "n" characters** removed. Newlines in the WordPress data had lost their backslash and show as `nnnn` between paragraphs on the live site today.
- **1,331 old tier-name phrases updated** where the price made the mapping unambiguous, e.g. "Growth $99/mo, Pro $199/mo, Elite $299/mo" → "Pro $99/mo, Growth $199/mo, Exclusive $299/mo".
- 4 pages/posts pasted as full HTML documents (two `<title>` tags) had the document shell removed; styles kept.
- 5 internal links that 404'd on hundreds of pages now redirect (`data/redirects-extra.json`): `/platform/predictive-lead-gen/` (235 pages) → `/predictive-lead-gen/`, `/va-loans/` (27 pages) → `/loan-types/va-loan-leads/`, and three `/compare/ypnus-vs-*` links → the matching `/vs/` page or `/compare/`.
- New native `/pricing.html` with the current tiers: Free $0, Pro $99, Growth $199, Exclusive $299 (ZIP code lockout exclusivity), plus OfferCatalog schema. Edit tier text in `data/site.json`.
- New native `/check-zip.html` (1,233 links point here).

## Could not convert (replaced or flagged)

| Page | WordPress feature | What the Node app does now |
|---|---|---|
| `/`, `/features/` | AI Engine chatbot `[mwai_chatbot id="Cerebro"]` | Cerebro card linking to app.ypnus.com/assistant |
| `/claim-territory/` | WPForms `[wpforms id="2711"]` | Native form (name, email, phone, ZIP, consents) → `/api/lead` |
| `/onboarding/` | `[ypnus_onboarding_form]` (mu-plugin) | Native lead form; automatic site provisioning is not wired |
| `/easiest-mortgage-website-builder/` | Rank Math How-To block (no saved HTML) | Removed; rebuild by hand if needed |
| `/7-ways-to-find-better-real-estate-leads-today/`, `/how-to-find-better-real-estate-leads-today/` | GenerateBlocks media block (no saved HTML) | Removed |
| 2 Fresno VA posts | Site Kit widget, block navigation | Removed (layout supplies navigation) |
| `/lo-signup.html`, `/onboarding.html` | Static files outside WordPress (not in the export) | Served from `public/` once copied; until then redirect to app.ypnus.com/signup and `/onboarding/` |

13 drafts/private pages (homepage redesign drafts, 5 onboarding email pages, an agent-site preview) were saved to `content/_unpublished/` and are not served.

## Needs you before cutover (blocking)

1. **WordPress still runs your business logic.** The Stripe webhook receiver, user provisioning/logins and the ZIP territory ledger live in WordPress plugins. Move the Stripe webhook endpoint to app.ypnus.com (or keep WordPress on a subdomain) before ypnus.com points at this app, or new checkouts won't provision.
2. **ZIP ledger.** The Node ZIP check answers from `data/zip-ledger.json` (empty, so every ZIP shows available) unless `ZIP_CHECK_UPSTREAM` points at the system that owns the ledger. Fill one or the other.
3. **Media.** The export only lists media URLs; the files must be copied from `public_html/wp-content/uploads` (README step 3.1) or served via `MEDIA_FALLBACK_ORIGIN`.
4. **Lead delivery.** Leads are saved to `data/leads/leads.jsonl` on the server. Set `LEAD_WEBHOOK_URL` so they reach your CRM/nurture sequence (the WordPress endpoint started a nurture flow).
5. **Rank Math Redirections** rules are stored in their own table and aren't in a WXR export. Export them (Rank Math > Redirections) into `data/redirects-extra.json`.

## Needs a content decision (not blocking)

Old pricing that couldn't be mapped automatically is still on these 10 pages (e.g. "Growth plan ($99.99/mo)", "Elite: Unlimited", JSON-LD Offers at 99.99/199.99/299.99):
`/`, `/how-it-works/`, `/features/`, `/about/`, `/mlo-growth-engine/`, `/agent-co-branding/`, `/platform/loan-officer-crm/`, `/boost-business-ai-mortgae-leads-ypn-usa/`, `/easy-mortgage-websites-ypn-usa-professionals/`, `/boost-your-mortgage-business-ypn-usa-insights/`.

Other notes from the smoke test: 98 SEO titles are longer than 65 characters (kept as written in Rank Math), and `/agent-co-branding/` has two `<h1>` headings.
