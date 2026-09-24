/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Process-scoped (per instance) — enough to blunt casual abuse / accidental
 * double-submits of the write endpoints on a single Node host. For a
 * multi-instance production deployment, back this with a shared store (Redis,
 * Upstash, etc.).
 */

import type { NextResponse } from "next/server";
import { jsonError, type ApiErrorEnvelope } from "./http";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1;
  const safeWindowMs = Number.isFinite(windowMs) && windowMs > 0 ? Math.floor(windowMs) : 60_000;
  const safeKey = key.trim() || "unknown";

  // Opportunistic cleanup so the map can't grow without bound.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  const existing = buckets.get(safeKey);
  if (!existing || existing.resetAt <= now) {
    buckets.set(safeKey, { count: 1, resetAt: now + safeWindowMs });
    return { ok: true, retryAfter: 0 };
  }

  if (existing.count >= safeLimit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true, retryAfter: 0 };
}

/**
 * Fixed-window guard for a route: returns a 429 envelope when the caller is
 * over budget, or `null` to continue.
 */
export function enforceRateLimit(
  request: Request,
  options: { scope: string; limit: number; message: string; windowMs?: number },
): NextResponse<ApiErrorEnvelope> | null {
  const limited = rateLimit(
    `${options.scope}:${clientKey(request)}`,
    options.limit,
    options.windowMs ?? 60_000,
  );
  if (limited.ok) return null;

  return jsonError(options.message, 429, "RATE_LIMITED", {
    headers: { "Retry-After": String(limited.retryAfter) },
  });
}

/**
 * Best-effort client identifier from proxy headers.
 *
 * The left-most x-forwarded-for entry is client-controlled, so trusting it lets
 * a caller rotate the header to dodge every limit. Proxies append the address
 * they saw, so count in from the right: TRUSTED_PROXY_HOPS (default 1) is how
 * many trusted proxies sit in front of the app.
 */
export function clientKey(request: Request): string {
  const hops = Math.max(1, Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10) || 1);
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    const picked = parts[Math.max(0, parts.length - hops)];
    if (picked) return picked;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
