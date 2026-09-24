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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
