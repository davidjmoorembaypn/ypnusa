import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Check for a simple cookie-based tier marker for gating. Replace with
    // your real session/entitlement check (requireSession + resolveEntitlement)
    // when integrating with your auth system.
    const tier = req.cookies.get("ypn_tier")?.value;
    const allowed = tier === "elite";
    return NextResponse.json({ allowed });
  } catch (err) {
    return NextResponse.json({ allowed: false });
  }
}
