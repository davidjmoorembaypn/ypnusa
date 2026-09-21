import { NextResponse } from "next/server";
import { fetchLiveTerritory } from "@/lib/live-territory";
import { checkTerritory } from "@/lib/territory";
import { jsonError, logApiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const zip = searchParams.get("zip") ?? "";

    // Prefer the live ypnus.com lock ledger so app.ypnus.com matches production.
    const live = await fetchLiveTerritory(zip);
    if (live) {
      return NextResponse.json({
        ok: live.ok,
        zip: live.zip,
        valid: live.valid,
        available: live.available,
        totalClaimed: live.totalClaimed,
        message: live.message,
        source: live.live ? "ypnus_wp" : "local_validation",
        city: live.live?.city ?? null,
        state: live.live?.state ?? null,
        signupUrl: live.live?.signup_url ?? null,
        demand: live.live?.demand ?? null,
      });
    }

    // Demo inventory is not authoritative and must never drive a paid signup.
    if (process.env.NODE_ENV === "production") {
      return jsonError(
        "Live ZIP availability is temporarily unavailable. Please try again shortly.",
        503,
        "TERRITORY_UNAVAILABLE",
        { headers: { "Cache-Control": "no-store", "Retry-After": "30" } },
      );
    }

    const local = checkTerritory(zip);
    return NextResponse.json({ ...local, source: "local_demo" });
  } catch (error) {
    logApiError("/api/territory/check", error);
    return jsonError("Territory availability is temporarily unavailable.", 500, "TERRITORY_CHECK_FAILED");
  }
}
