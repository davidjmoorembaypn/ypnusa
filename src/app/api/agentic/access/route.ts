import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const tier = req.cookies.get("ypn_tier")?.value;
    const allowed = tier === "elite";
    return NextResponse.json({ allowed });
  } catch {
    return NextResponse.json({ allowed: false });
  }
}
