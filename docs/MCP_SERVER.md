# YPN USA remote MCP server

`https://ypnus.com/api/mcp` is a remote [Model Context Protocol](https://modelcontextprotocol.io) server (Streamable HTTP, spec 2025-11-25) for loan officers. Code: `src/app/api/mcp/route.ts` (route), `src/lib/mcp/http.ts` (CORS, origin, transport), `src/lib/mcp/server.ts` (tool registration), `src/lib/mcp/tools.ts` (what each tool does).

## Connect Claude

In Claude, add a custom connector and enter the URL `https://ypnus.com/api/mcp`. No sign-in is needed unless `MCP_BEARER_TOKEN` is set (below). For the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector
```

Choose transport "Streamable HTTP" and the URL above.

## Tools

| Tool | What it does | Writes anything? |
| --- | --- | --- |
| `check_zip_availability` | Is a ZIP code open or locked, with city, state and the market estimate | No |
| `check_zip_availability_batch` | Up to 10 ZIP codes at once, grouped open, locked and invalid | No |
| `find_nearby_open_zips` | The nearest open ZIP codes (1 to 5) when one is locked | No |
| `get_zip_lock_info` | How locking works and what each public plan includes | No |
| `get_cerebro_overview` | What Cerebro does today and what it does not do yet | No |
| `ask_cerebro` | One message to the public-site Cerebro, the same chat the website offers visitors | Saves the chat transcript, as the website does |

A ZIP code locks only at the first payment on a paid plan. A free account or a trial does not hold it, and exclusivity applies within YPN USA.

Not available here: a loan officer's own dashboard Cerebro (their leads, drafts and settings). That needs a signed-in account, and this endpoint has no per-officer sign-in. Adding it means building OAuth for MCP clients; see "Not built yet".

## How it behaves

- **POST** carries every JSON-RPC message and is answered as JSON. One server and transport per request; nothing is kept between requests, so a restart or a release never breaks a connection.
- **GET** and **DELETE** answer `405 Method Not Allowed` with `Allow: POST, OPTIONS`. The spec allows this for a server with no server-to-client stream (GET) and no sessions (DELETE). No `Mcp-Session-Id` is ever issued.
- **OPTIONS** answers the CORS preflight with `204`.
- **Origin check:** a request with an `Origin` header must come from an allowed origin, otherwise `403`. Allowed by default: `claude.ai`, `claude.com`, `ypnus.com` and their `www` hosts; `localhost` and `127.0.0.1` outside production. Requests with no `Origin` (Claude's backend, the CLI, curl) are let through. CORS headers are sent only to an allowed origin and never allow credentials.
- **Limits:** 120 POSTs a minute per caller; request bodies over 64 KB are refused; `ask_cerebro` has 10 messages a minute per caller and 120 an hour in total.
- `src/proxy.ts` leaves `/api/mcp` to this handler. Every other `/api` route keeps the credentialed marketing-site CORS.

## Settings (all optional)

| Variable | Effect |
| --- | --- |
| `MCP_BEARER_TOKEN` | When set, every request except the CORS preflight must send `Authorization: Bearer <token>`. Use it to take the endpoint private. |
| `MCP_ALLOWED_ORIGINS` | Extra browser origins, comma separated, for example `https://partner.example` |
| `MCP_CEREBRO_CHAT` | Set to `off` to remove `ask_cerebro` (it spends a paid model call) |
| `MCP_CEREBRO_HOURLY_LIMIT` | Total `ask_cerebro` messages an hour across all callers (default 120) |

## Try it

```bash
curl -s https://ypnus.com/api/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -H 'mcp-protocol-version: 2025-06-18' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check_zip_availability","arguments":{"zip":"93618"}}}'
```

## Not built yet

- Per-officer sign-in (OAuth) so an officer can use their own Cerebro from Claude.
- Stateful sessions with a server-to-client stream. Not needed by any tool today; the transport supports it if one is added.
- A shared rate-limit store. Limits are in memory, per Node process, like the rest of the app.
