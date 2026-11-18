import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { googleConsentUrl, googleOAuthConfigured, officerForViewer } from "@/lib/google-calendar";
import { marketingUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts "Connect Google Calendar" for the signed-in officer (or the house account for an admin). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(marketingUrl("/login?next=/portal/appointments"));
  const back = (msg: string) => NextResponse.redirect(marketingUrl(`/portal/appointments?msg=${encodeURIComponent(msg)}`));
  if (!googleOAuthConfigured()) return back("Google Calendar connection isn't set up on the server yet.");
  const officer = officerForViewer(session);
  if (!officer) return back("Finish your profile setup first, then connect your calendar.");
  return NextResponse.redirect(googleConsentUrl(officer.id));
}
