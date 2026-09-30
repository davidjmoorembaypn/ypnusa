<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Project overview

YPN USA product app (Next.js 16 App Router) for exclusive ZIP territories + AI borrower intake.

| Host | Role |
| --- | --- |
| `https://ypnus.com` | WordPress marketing, signup, Cerebro, Rank Math |
| `https://app.ypnus.com` | Product app target for this Next.js repo |

Local demo state persists to `data/store.json`. Live ZIP availability is read from `https://ypnus.com/wp-json/ypnus/v1/zip-check/{zip}` when reachable. See `hostinger/README.md` for production Hostinger fixes.

### Running services

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server on port 3000 |
| `npm run lint` | ESLint (flat config, no args needed) |
| `npm run build` | Production build (uses Turbopack) |

### Key caveats

- The project uses **Next.js 16.2.6** with React 19 and Tailwind CSS 4. Consult `node_modules/next/dist/docs/` for API guidance rather than relying on training-data assumptions.
- No `.env` file is required; the app runs fully without environment variables. `INTAKE_EXTERNAL_WEBHOOK_URL` is optional for Zapier-style integrations.
- The file-based DB at `data/store.json` is auto-created on first write. It can be deleted to reset state.
- The `package-lock.json` is the lockfile; use `npm install` (not yarn/pnpm/bun).

## Deploying app.ypnus.com (any agent or tool)

- The only supported path: merge to `main`, let `.github/workflows/release-build.yml` publish `app-build-<sha7>`, then run `scripts/hostinger-install-release.sh` on the server (see `hostinger/README.md`). It verifies the checksum, keeps the previous release for rollback, and rolls back automatically if `/api/health` doesn't report the new `build.commit`.
- Never use hPanel's Node.js "Deploy"/"Rebuild", Hostinger's Node.js build API, or an uploaded archive for this app. On 2026-09-26 that replaced production with an old bundle (no California compliance pages, no `app/.env` loader) and deleted the installed releases.
- Secrets live only in `app/.env` on the server; `hostinger/server-preamble.js` loads them and is injected into every release bundle.
