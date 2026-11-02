import { NextResponse } from "next/server";
import { nativeAuthOrigin, nativePlatformEnabled } from "@/lib/native-platform";
import { marketingUrl } from "@/lib/site";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  if (nativePlatformEnabled()) {
    const origin = nativeAuthOrigin();
    return origin ? NextResponse.redirect(new URL("/login", origin), 307) : new NextResponse("Sign-in is temporarily unavailable.", { status: 503 });
  }
  const target = new URL("/lo-dashboard.html", marketingUrl());
  if (target.origin === new URL(request.url).origin) return new NextResponse("Migration is not enabled.", { status: 503 });
  return NextResponse.redirect(target, 307);
}
