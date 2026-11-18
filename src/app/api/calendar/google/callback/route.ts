import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { completeGoogleConnection, officerForViewer, readConnectState } from "@/lib/google-calendar";
import { marketingUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Google sends the officer back here after they allow calendar access. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (msg: string) => NextResponse.redirect(marketingUrl(`/portal/appointments?msg=${encodeURIComponent(msg)}`));
  const session = await getSession();
  if (!session) return NextResponse.redirect(marketingUrl("/login?next=/portal/appointments"));
  if (url.searchParams.get("error")) return back("Google Calendar wasn't connected.");
  const loId = readConnectState(url.searchParams.get("state") ?? "");
  // The signed state must name the same officer this session may connect.
  if (!loId || officerForViewer(session)?.id !== loId) return back("That connection link expired. Try again.");
  const code = url.searchParams.get("code");
  if (!code) return back("Google Calendar wasn't connected.");
  try {
    const result = await completeGoogleConnection(loId, code);
    return back(result.ok ? "Google Calendar connected. Cerebro now books around your real schedule." : result.error);
  } catch (error) {
    console.error("[google-calendar] connect failed", error instanceof Error ? error.message : error);
    return back("Google Calendar wasn't connected. Try again.");
  }
}
