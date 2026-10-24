import { listSyncedAvailableSlots } from "@/lib/calendar";
import { jsonError, jsonOk, logApiError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, {
    scope: "calendar-slots",
    limit: 60,
    message: "Too many requests - please slow down and try again shortly.",
  });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const loId = searchParams.get("loId")?.trim() || undefined;
    const horizon = Number(searchParams.get("horizon") ?? "12");
    const safeHorizon = Number.isFinite(horizon)
      ? Math.min(Math.max(Math.trunc(horizon), 1), 30)
      : 12;

    const slots = await listSyncedAvailableSlots(loId, safeHorizon);
    return jsonOk({ slots: slots.slice(0, 3) });
  } catch (error) {
    logApiError("/api/calendar/slots", error);
    return jsonError("Calendar slots are temporarily unavailable.", 500, "CALENDAR_SLOTS_FAILED");
  }
}
