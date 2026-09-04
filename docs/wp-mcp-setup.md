# WordPress MCP setup (ypnus.com ↔ Claude)

Project-scoped MCP server `invizo` (see [`.mcp.json`](../.mcp.json)) lets Claude Code
call ypnus.com's WordPress MCP adapter endpoint directly, via
[`@automattic/mcp-wordpress-remote`](https://github.com/Automattic/mcp-wordpress-remote).

## How it's wired

| Setting | Value |
| --- | --- |
| Server name | `invizo` |
| Command | `npx -y @automattic/mcp-wordpress-remote@latest` |
| `WP_API_URL` | `https://ypnus.com/wp-json/mcp/novamira` — the same MCP adapter endpoint the `novamira-ypnus-com` connector uses |
| Auth | WordPress application password (`OAUTH_ENABLED=false`) |
| Credentials | `YPNUS_WP_MCP_USERNAME` / `YPNUS_WP_MCP_APP_PASSWORD` (see [`.env.example`](../.env.example)) |

## One-time setup

1. Log in to the ypnus.com WordPress admin as the account this MCP server
   should act as.
2. Go to **Users → Profile → Application Passwords**.
3. Enter a name (e.g. `claude-mcp-invizo`) and click **Add New Application
   Password**.
4. Copy the generated password (it's shown once, spaces included).
5. Set the two env vars Claude Code resolves `.mcp.json`'s `${...}` references
   from — either export them in your shell, or put them in `.env.local`:
   ```bash
   YPNUS_WP_MCP_USERNAME=your-wp-username
   YPNUS_WP_MCP_APP_PASSWORD="xxxx xxxx xxxx xxxx xxxx xxxx"
   ```
6. Restart Claude Code (or reconnect MCP servers) so it picks up the new env
   vars and starts `invizo`.

## Verifying

Once connected, Claude Code should expose `mcp__invizo__*` tools (the exact
set depends on what the `novamira` MCP adapter server on ypnus.com registers).
If the server fails to start, check:

- The WordPress account has sufficient permissions for whatever the
  `novamira` adapter server exposes.
- The application password wasn't revoked (Users → Profile → Application
  Passwords lists active ones).
- `WP_API_URL` still matches the live endpoint — confirm via
  `https://ypnus.com/wp-json/mcp/novamira` in a browser (should return a JSON
  MCP discovery response, not a 404).

## Related

- Hostinger MCP servers (`hostinger-*` in `.mcp.json`) manage hosting, DNS,
  domains, billing, and VPS — see [`hostinger/README.md`](../hostinger/README.md).
- `YPNUS_WP_API_BASE` (separate from this setup) is the app's own runtime
  REST client for the live ZIP-lock ledger and signup APIs — unrelated to MCP.
