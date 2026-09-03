# YPNUS SEO Hygiene

Crawl-budget/indexation hygiene for ypnus.com, plus REST access to Rank Math's SEO
title/description meta.

## Install

Upload this folder (or `wp-plugins/ypnus-seo-hygiene.zip`) as a normal plugin in
WP Admin → Plugins → Add New → Upload Plugin, then activate it. No configuration
needed.

## What it does

1. **Sitemap hygiene** — excludes `attachment`/`elementor_library` post types from
   Rank Math XML sitemaps, so image/media URLs stop wasting crawl budget.
2. **`robots.txt` note** — documents the ypnus.com / app.ypnus.com host split and
   tells crawlers not to expect the app's programmatic ZIP inventory here.
3. **Soft-noindex** for thin utility routes (`/site-directory`, `/sitemap`).
4. **Rank Math REST fields** — registers `rank_math_title` and
   `rank_math_description` as REST-readable/writable fields on `page` and `post`
   (`GET`/`POST` `/wp/v2/pages/{id}` and `/wp/v2/posts/{id}`), guarded by the
   requesting user's `edit_post` capability. This is what the app repo's Website
   Autopilot (`src/lib/wordpress.ts`, `seo_title` / `seo_meta_description` change
   types) targets when it proposes or applies an SEO title/meta-description
   change — without this plugin those fields aren't reachable over REST at all.
