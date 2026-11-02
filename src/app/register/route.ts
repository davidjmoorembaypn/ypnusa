import { NextResponse } from "next/server";
import { nativeAuthOrigin, nativePlatformEnabled } from "@/lib/native-platform";
import { marketingUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const incoming = new URL(request.url);
  if (!nativePlatformEnabled()) {
    const target = new URL(`/lo-signup.html${incoming.search}`, marketingUrl());
    if (target.origin === incoming.origin && incoming.pathname === target.pathname) return new NextResponse("Migration is not enabled.", { status: 503 });
    return NextResponse.redirect(target, 307);
  }
  const origin = nativeAuthOrigin();
  if (!origin) return new NextResponse("Account setup is temporarily unavailable. Contact support@ypnus.com.", { status: 503 });
  const destination = new URL("/login", origin);
  destination.searchParams.set("next", "/onboarding");
  return NextResponse.redirect(destination, 307);
}
