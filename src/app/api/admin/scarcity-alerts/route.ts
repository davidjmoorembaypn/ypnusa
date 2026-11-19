import { NextResponse } from "next/server";
import { requireAdminSessionOrSecret } from "@/lib/auth";
import { listZipScarcityEvents } from "@/lib/db";
import { jsonError, logApiError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { zipStatusResolver, type ZipStatus } from "@/lib/zip-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * GET /api/admin/scarcity-alerts?limit=20
 *   Neighbor-lock alerts, newest first, each with the open neighbor ZIP codes and their outreach text.
 * GET /api/admin/scarcity-alerts?event=<id>&recheck=1
 *   The same single alert with every neighbor re-checked against the live ledger (`status` per
 *   neighbor: open, claimed or unknown), because a ZIP code can be claimed after the alert was logged.
 *
 * Admin session or the configured secret only.
 */
export async function GET(request: Request) {
  const denied = await requireAdminSessionOrSecret(request);
  if (denied) return denied;

  const limited = enforceRateLimit(request, {
    scope: "admin-scarcity-alerts",
    limit: 30,
    message: "Too many requests - please slow down and try again shortly.",
  });
  if (limited) return limited;

  try {
    const params = new URL(request.url).searchParams;
    const eventId = params.get("event")?.trim();
    const limitParam = Number.parseInt(params.get("limit") ?? "", 10);
    const limit = Number.isFinite(limitParam) ? Math.min(MAX_LIMIT, Math.max(1, limitParam)) : DEFAULT_LIMIT;

    const events = listZipScarcityEvents(eventId ? 500 : limit);
    const selected = eventId ? events.filter((e) => e.id === eventId) : events;
    if (eventId && selected.length === 0) return jsonError("Alert not found.", 404, "NOT_FOUND");

    const recheck = params.get("recheck") === "1" && Boolean(eventId);
    const out = [];
    for (const event of selected) {
      let statuses: Map<string, ZipStatus> | null = null;
      if (recheck) {
        const resolved = await zipStatusResolver.resolveMany(event.neighbors.map((n) => n.zip));
        statuses = new Map(resolved.map((r) => [r.zip, r.status]));
      }
      out.push({ ...event, neighbors: event.neighbors.map((n) => ({ ...n, status: statuses?.get(n.zip) })) });
    }

    return NextResponse.json({ ok: true, events: out, rechecked: recheck }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    logApiError("/api/admin/scarcity-alerts", error);
    return jsonError("Could not load scarcity alerts.", 500, "SCARCITY_ALERTS_FAILED");
  }
}
