This is a snapshot of the files found in `~/public_html` on the production
hosting account (copied 2026-09-15), which serves the marketing/WordPress
surface at `ypnus.com`.

`ypnus.com` and this repo (`app.ypnus.com`) are **two separate live
deployments**, not two versions of the same app — see `src/lib/site.ts` and
the `SiteFooter` component, which link between them. `ypnus.com` remains
live and unmodified; nothing here was moved, only copied for reference so a
snapshot exists in version control. Do not treat these files as dead code to
delete, and do not wire them into the Next.js build.
