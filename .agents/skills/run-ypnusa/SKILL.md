---
name: run-ypnusa
description: Run, start, build, test, and drive the ypnusa Next.js app (app.ypnus.com) locally - launch the dev server, smoke-test pages, security headers, CORS, dev-login, and the AI assistant with curl.
---

# Run ypnusa (app.ypnus.com)

Next.js app (`output: "standalone"`), driven with `curl` against a local dev server. Paths are relative to the repo root (`ypnusa/`). Verified on Windows 11 with Git Bash and Node 24; commands are the ones that were actually run.

## Prerequisites

- Node 20+ and `npm ci` already done (`node_modules/` present).
- No env vars are required locally. `ANTHROPIC_API_KEY` is optional (see Gotchas).

## Agent path: launch and drive

```bash
# 1. start on a fixed port, in the background (ready in ~15s)
(npm run dev -- -p 3100 > /tmp/ypnusa-dev.log 2>&1 &); sleep 15
curl -s http://localhost:3100/api/health        # {"ok":true,"service":"ypnusa-app","storage":{...}}

# 2. security headers: /login must be un-frameable, /embed/* must stay frameable
curl -sI http://localhost:3100/login | grep -i -E "x-frame|content-security"
curl -sI http://localhost:3100/embed/intake | grep -i -E "x-frame|content-security" || echo "frameable"

# 3. CORS: only https://ypnus.com and https://www.ypnus.com, with credentials
curl -si -X OPTIONS -H "Origin: https://ypnus.com" -H "Access-Control-Request-Method: POST" http://localhost:3100/api/demo-request | grep -i -E "^HTTP|access-control-allow-(origin|credentials)"   # 204
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS -H "Origin: https://evil.example" -H "Access-Control-Request-Method: POST" http://localhost:3100/api/demo-request   # 403

# 4. auth gate + dev login (non-production only), then the signed-in pages
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3100/account   # 307 -> /login?next=/account
curl -s -c /tmp/cj -X POST http://localhost:3100/api/auth/dev-login -H 'content-type: application/json' -d '{"email":"mlo@example.com","tier":"growth","subscriptionStatus":"active"}'
curl -s -b /tmp/cj http://localhost:3100/account | grep -o -F -e "mlo@example.com" -e "Growth" -e "99.99"
curl -s -b /tmp/cj http://localhost:3100/billing | grep -o -F -e "Plan and billing" -e "199.99" -e "Current"
curl -s -b /tmp/cj -X POST http://localhost:3100/api/auth/logout

# 5. AI assistant
curl -s -X POST http://localhost:3100/api/assistant/chat -H 'content-type: application/json' -d '{"mode":"public_site","message":"What does Pro cost?"}'

# 6. stop (kills all node processes on this machine)
taskkill //F //IM node.exe
```

## Build, typecheck, test, lint

```bash
npx tsc --noEmit      # clean
npm test              # tsx --test: 368 tests
npm run lint          # 0 errors, 2 unused-var warnings in src/lib/flows.ts
npm run build         # production build, prints the route table
```

## Gotchas

- `/api/assistant/chat` returns `providerConfigured:false` and a canned reply unless `ANTHROPIC_API_KEY` is set. Without it you cannot exercise the agent loop or tools (`get_pricing`, `check_territory_availability`, etc.); the production site has a key and does run them.
- `POST /api/auth/dev-login` returns 404 when `NODE_ENV=production`. It accepts `email`, `role`, `tier`, `subscriptionStatus` (ignores `trialEndsAt`).
- The session cookie `ypnus_session` is host-only by design (see `docs/sso-handoff.md`). Use a cookie jar (`-c` / `-b`).
- Editing files under `src/` while `next dev` runs hot-reloads; editing `next.config.ts` needs a restart (it also sets `experimental.cpus: 2` for the Hostinger build).
- `git` on Windows warns "LF will be replaced by CRLF"; harmless.
- No browser tooling was available when this skill was written, so nothing here covers client-side rendering or screenshots. Use the Chrome tools or a Playwright script for that.

## Troubleshooting

- Port already in use after a crash: `taskkill //F //IM node.exe`, then start again.
- Local runs write leads and chat sessions to `data/store.json` (already gitignored).

## Deploying

Local runs do not deploy. Production runs on Hostinger; see `hostinger/README.md` and `scripts/deploy-hostinger.mjs` (needs `HOSTINGER_API_TOKEN`).
