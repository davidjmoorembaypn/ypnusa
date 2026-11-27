import { NextResponse } from "next/server";
import { unsubscribeMloDrip } from "@/lib/mlo-drip";
import { unsubscribeBorrower } from "@/lib/unsubscribe";

export const runtime = "nodejs";

/** One-click unsubscribe (RFC 8058): Gmail and Yahoo POST here from the List-Unsubscribe header. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  // ?m= is a loan officer leaving the free-account email series; ?l= is a borrower.
  const series = url.searchParams.get("m");
  const outcome = series
    ? unsubscribeMloDrip(series, token)
    : unsubscribeBorrower(url.searchParams.get("l") ?? "", token, "email_one_click_unsubscribe");
  // 503 when the opt-out could not be saved, so the mail provider can try again; 400 for a bad link.
  const status = outcome === "unsubscribed" ? 200 : outcome === "not_saved" ? 503 : 400;
  return NextResponse.json(
    { ok: outcome === "unsubscribed" },
    { status, headers: outcome === "not_saved" ? { "Retry-After": "60" } : undefined },
  );
}

/** A person opening the link: send them to the page with a confirm button (link scanners can't unsubscribe anyone). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL("/unsubscribe", url.origin);
  for (const key of ["l", "m", "t"]) {
    const value = url.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target, 303);
}
