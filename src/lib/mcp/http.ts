import { timingSafeEqual } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { createMcpServer } from "./server";

/**
 * HTTP layer for the remote MCP endpoint (Streamable HTTP transport, spec 2025-11-25).
 *
 * Stateless: every POST gets its own server and transport, answered as plain JSON, and nothing is kept
 * between requests. That suits this deployment (one Node process that restarts on every release, behind
 * Apache) and these tools, none of which push anything to the client. The spec's two session methods
 * are therefore answered the way it allows a stateless server to answer them:
 *   - GET (the optional server-to-client SSE stream): 405, "this server offers no stream".
 *   - DELETE (end a session): 405, "this server does not allow clients to end sessions". No session id is
 *     ever issued, so there is nothing to end.
 *
 * CORS and origin: browsers send an Origin header, so it is checked (the spec's DNS-rebinding rule) against
 * an allow-list, and only an allowed origin gets CORS headers. A request with no Origin header (Claude's
 * backend, the CLI, curl) is not a browser and is let through. No credentials are ever allowed.
 *
 * Optional shared secret: set MCP_BEARER_TOKEN and every request except the CORS preflight must send it as
 * `Authorization: Bearer <token>`. Unset, the endpoint is public, which is right for the public-data tools.
 */

/** What a browser may ask for (CORS): every method a client might try, each answered correctly. */
export const MCP_ALLOWED_METHODS = "POST, GET, DELETE, OPTIONS";
/** What actually works here (the Allow header on a 405 and on the preflight): GET and DELETE answer 405. */
const SUPPORTED_METHODS = "POST, OPTIONS";
const ALLOWED_REQUEST_HEADERS = "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID";
const EXPOSED_RESPONSE_HEADERS = "Mcp-Session-Id, Mcp-Protocol-Version, WWW-Authenticate, Retry-After";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://claude.ai",
  "https://www.claude.ai",
  "https://claude.com",
  "https://www.claude.com",
  "https://ypnus.com",
  "https://www.ypnus.com",
];

/** Per caller, per minute: every JSON-RPC POST, including the cheap handshake and tool-list calls. */
const REQUESTS_PER_MINUTE = 120;
/** A JSON-RPC message here is tiny; refuse anything big before it is parsed. */
const MAX_BODY_BYTES = 64 * 1024;

function allowedOrigins(): Set<string> {
  const extra = (process.env.MCP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra]);
}

/** localhost and 127.0.0.1 on any port, outside production only (the MCP Inspector runs there). */
function isLocalDevOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function originAllowed(origin: string): boolean {
  return allowedOrigins().has(origin) || isLocalDevOrigin(origin);
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": MCP_ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_REQUEST_HEADERS,
    "Access-Control-Expose-Headers": EXPOSED_RESPONSE_HEADERS,
    "Access-Control-Max-Age": "600",
  };
}

function jsonRpcError(status: number, code: number, message: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Constant-time check of `Authorization: Bearer <token>` against MCP_BEARER_TOKEN. */
function bearerOk(request: Request, token: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const given = Buffer.from(match[1].trim());
  const wanted = Buffer.from(token);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** Adds CORS (for an allowed browser origin), no-store and Vary to a response. Builds a new one: a transport's headers can be immutable. */
function finish(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.append("Vary", "Origin");
  if (origin) for (const [key, value] of Object.entries(corsHeaders(origin))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handlePost(request: Request, clientId: string): Promise<Response> {
  const limited = rateLimit(`mcp:${clientId}`, REQUESTS_PER_MINUTE, 60_000);
  if (!limited.ok) {
    return jsonRpcError(429, -32000, "Too many requests. Please slow down and try again shortly.", { "Retry-After": String(limited.retryAfter) });
  }

  const server = createMcpServer({ clientId });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MAX_BODY_BYTES,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally {
    await server.close().catch(() => undefined);
  }
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");

  if (origin !== null && !originAllowed(origin)) {
    return finish(jsonRpcError(403, -32000, "Origin not allowed."), null);
  }
  // From here a present origin is an allowed one.

  if (request.method === "OPTIONS") {
    return finish(new Response(null, { status: 204, headers: { Allow: SUPPORTED_METHODS } }), origin);
  }

  const token = process.env.MCP_BEARER_TOKEN?.trim();
  if (token && !bearerOk(request, token)) {
    return finish(jsonRpcError(401, -32001, "Unauthorized.", { "WWW-Authenticate": 'Bearer realm="ypn-usa-mcp"' }), origin);
  }

  try {
    switch (request.method) {
      case "POST":
        return finish(await handlePost(request, clientKey(request)), origin);
      case "GET":
        return finish(jsonRpcError(405, -32000, "This server does not offer a server-to-client stream. Send JSON-RPC requests with POST.", { Allow: SUPPORTED_METHODS }), origin);
      case "DELETE":
        return finish(jsonRpcError(405, -32000, "This server is stateless and does not issue sessions, so there is nothing to end.", { Allow: SUPPORTED_METHODS }), origin);
      default:
        return finish(jsonRpcError(405, -32000, "Method not allowed.", { Allow: SUPPORTED_METHODS }), origin);
    }
  } catch {
    return finish(jsonRpcError(500, -32603, "Internal server error."), origin);
  }
}
