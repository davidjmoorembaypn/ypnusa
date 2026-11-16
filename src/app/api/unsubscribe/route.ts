import { NextResponse } from "next/server";
import { unsubscribeBorrower } from "@/lib/unsubscribe";

export const runtime = "nodejs";

/** One-click unsubscribe (RFC 8058): Gmail and Yahoo POST here from the List-Unsubscribe header. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const ok = unsubscribeBorrower(url.searchParams.get("l") ?? "", url.searchParams.get("t") ?? "", "email_one_click_unsubscribe");
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

/** A person opening the link: send them to the page with a confirm button (link scanners can't unsubscribe anyone). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL("/unsubscribe", url.origin);
  for (const key of ["l", "t"]) {
    const value = url.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target, 303);
}
