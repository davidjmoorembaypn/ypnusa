import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

/**
 * Optimistic auth gate for dashboard-style routes (cookie-only check — see
 * src/lib/auth.ts / getSession() for the authoritative per-request check that route
 * handlers and pages must still perform; proxy alone is not a full auth boundary).
 */
const PROTECTED_PREFIXES = ["/dashboard", "/portal", "/analytics", "/admin", "/onboarding", "/account", "/billing"];

/**
 * Cross-origin callers allowed to hit /api/* with credentials: only the marketing
 * site. Never a wildcard; credentialed CORS with "*" is both invalid and unsafe.
 */
const CORS_ALLOWED_ORIGINS = new Set(["https://ypnus.com", "https://www.ypnus.com"]);

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function handleApiCors(request: NextRequest): NextResponse {
  const origin = request.headers.get("origin");
  const allowed = origin !== null && CORS_ALLOWED_ORIGINS.has(origin);
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: allowed ? 204 : 403,
      headers: allowed ? corsHeaders(origin) : { Vary: "Origin" },
    });
  }
  const response = NextResponse.next();
  if (allowed) {
    for (const [key, value] of Object.entries(corsHeaders(origin))) response.headers.set(key, value);
  } else {
    response.headers.append("Vary", "Origin");
  }
  return response;
}

/**
 * /api/mcp is the public, read-only MCP server (src/app/api/mcp/route.ts). It uses no cookies and
 * returns only what the public site shows, so any origin may call it from a browser (claude.ai, the
 * MCP Inspector), without credentials. This is the one exception to the allowlist above; do not
 * widen it to routes that read a session.
 */
const MCP_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Mcp-Method, Mcp-Name, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "600",
};

function handleMcpCors(request: NextRequest): NextResponse {
  const response = request.method === "OPTIONS" ? new NextResponse(null, { status: 204 }) : NextResponse.next();
  for (const [key, value] of Object.entries(MCP_CORS_HEADERS)) response.headers.set(key, value);
  // Newer MCP clients send per-call headers (Mcp-Param-*) that can't be listed ahead of time, so a
  // preflight is answered with exactly the headers it asked for. Safe here: no credentials are allowed.
  const requested = request.headers.get("access-control-request-headers");
  if (request.method === "OPTIONS" && requested) {
    response.headers.set("Access-Control-Allow-Headers", requested);
    response.headers.set("Vary", "Access-Control-Request-Headers");
  }
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/mcp") return handleMcpCors(request);
  if (pathname.startsWith("/api/")) return handleApiCors(request);
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) return NextResponse.next();

  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (session) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/portal/:path*",
    "/analytics/:path*",
    "/admin/:path*",
    "/onboarding/:path*",
    "/account/:path*",
    "/billing/:path*",
  ],
};
