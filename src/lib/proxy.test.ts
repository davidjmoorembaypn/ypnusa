import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { createSessionToken, SESSION_COOKIE_NAME } from "./session";

process.env.SESSION_SECRET = "test-proxy-secret";

function requestFor(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set("cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  return new NextRequest(new URL(path, "https://app.ypnus.com"), { headers });
}

describe("proxy (dashboard gate)", () => {
  it("passes through public routes untouched", () => {
    const response = proxy(requestFor("/"));
    assert.equal(response.headers.get("location"), null);
  });

  it("redirects an unauthenticated visitor away from a protected route", () => {
    const response = proxy(requestFor("/dashboard/local-seo"));
    const location = response.headers.get("location");
    assert.ok(location);
    assert.match(location!, /\/login\?next=%2Fdashboard%2Flocal-seo/);
  });

  it("redirects onboarding before streaming a page response", () => {
    const response = proxy(requestFor("/onboarding"));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "https://app.ypnus.com/login?next=%2Fonboarding");
  });

  it("lets an authenticated request through to a protected route", () => {
    const token = createSessionToken({ sub: "wp_1", email: "jordan@example.com", role: "mlo" });
    const response = proxy(requestFor("/portal/nurture", token));
    assert.equal(response.headers.get("location"), null);
  });

  it("rejects a forged/garbage session cookie on a protected route", () => {
    const response = proxy(requestFor("/admin/revenue", "garbage.token"));
    assert.ok(response.headers.get("location")?.includes("/login"));
  });
});

describe("proxy (MCP endpoint)", () => {
  const preflight = (path: string, origin: string) =>
    proxy(new NextRequest(new URL(path, "https://ypnus.com"), { method: "OPTIONS", headers: { origin } }));

  it("leaves /api/mcp to its own handler, so claude.ai's preflight is not answered with the marketing-site 403", () => {
    const response = preflight("/api/mcp", "https://claude.ai");
    assert.notEqual(response.status, 403);
    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(response.headers.get("access-control-allow-credentials"), null);
  });

  it("still gives every other /api route the credentialed marketing-site CORS and a 403 to other origins", () => {
    assert.equal(preflight("/api/territory/check", "https://claude.ai").status, 403);
    const ok = preflight("/api/territory/check", "https://ypnus.com");
    assert.equal(ok.status, 204);
    assert.equal(ok.headers.get("access-control-allow-credentials"), "true");
  });

  it("does not exempt look-alike paths", () => {
    assert.equal(preflight("/api/mcp-admin", "https://claude.ai").status, 403);
    assert.equal(preflight("/api/mcp/x", "https://claude.ai").status, 403);
  });
});
