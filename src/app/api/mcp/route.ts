import { createMcpHandler, isLegacyRequest, WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { logApiError } from "@/lib/http";
import { createYpnMcpServer } from "@/lib/mcp/server";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/mcp: the remote MCP server for ypnus.com (Streamable HTTP).
 *
 * Connect an MCP client to https://ypnus.com/api/mcp (no trailing slash: the site redirects those,
 * and MCP clients do not reliably follow a redirect on POST).
 *
 * Stateless and JSON-only: a new server per request, no session IDs (so a deploy restart never
 * breaks a client) and no event stream (so Apache has nothing to buffer or time out). GET and
 * DELETE, which only matter for sessions, are answered 405 by the handler.
 *
 * Public on purpose: every tool is read-only over data the public site already shows (see
 * src/lib/mcp/server.ts), so there is no token and no environment variable to configure.
 */
const MAX_BODY_BYTES = 64 * 1024;
const onerror = (error: Error) => logApiError("/api/mcp", error);

/** Clients on the 2026-07-28 protocol revision. */
const modern = createMcpHandler(createYpnMcpServer, {
  legacy: "reject",
  responseMode: "json",
  maxRequestBodySize: MAX_BODY_BYTES,
  onerror,
});

/**
 * Clients on the 2025 protocol revisions (most of today's). The SDK's built-in fallback for them
 * always answers over an event stream, so they are served here by the same factory over a
 * stateless transport in JSON mode instead.
 */
async function serveLegacy(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null },
      { status: 405, headers: { Allow: "POST" } },
    );
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32600, message: "Request body is too large." }, id: null },
      { status: 413 },
    );
  }
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  transport.onerror = onerror;
  const server = createYpnMcpServer();
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // JSON mode: the whole body is in hand once handleRequest resolves, so the pair can be released.
    void server.close().catch(onerror);
  }
}

const handler = {
  fetch: async (request: Request): Promise<Response> =>
    (await isLegacyRequest(request, undefined, { maxRequestBodySize: MAX_BODY_BYTES })) ? serveLegacy(request) : modern.fetch(request),
};

async function serve(request: Request): Promise<Response> {
  // An MCP client makes several requests per tool call, and hosted clients share a few addresses.
  const limited = enforceRateLimit(request, {
    scope: "mcp",
    limit: 240,
    message: "Too many requests to the YPN USA MCP server. Wait a minute and try again.",
  });
  if (limited) return limited;

  const response = await handler.fetch(request);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export { serve as GET, serve as POST, serve as DELETE };
