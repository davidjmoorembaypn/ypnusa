import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { entitlementForEmail, upsertAccount } from "@/lib/accounts";
import { consumeLoginToken } from "@/lib/email-login";
import { logApiError } from "@/lib/http";
import { getSiteOrigin } from "@/lib/request-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Form POST from /login/verify. Burns the one-time token, creates the account on first
 * sign-in, reads the current plan from the Stripe-fed ledger and starts the session.
 */
export async function POST(request: Request) {
  const origin = await getSiteOrigin();
  try {
    const form = await request.formData();
    const result = consumeLoginToken(form.get("token"));
    if (!result.ok) {
      const reason = result.code === "EXPIRED_TOKEN" ? "expired" : result.code === "USED_TOKEN" ? "used" : "invalid";
      return NextResponse.redirect(new URL(`/login?error=${reason}`, origin), 303);
    }

    const account = upsertAccount({ email: result.email, source: "email_signup", markLogin: true });
    const entitlement = entitlementForEmail(account.email);
    await createSession({
      sub: account.id,
      email: account.email,
      role: account.role,
      tier: entitlement.tier,
      subscriptionStatus: entitlement.subscriptionStatus,
    });
    return NextResponse.redirect(new URL(result.next, origin), 303);
  } catch (error) {
    logApiError("/api/auth/email-link/verify", error);
    return NextResponse.redirect(new URL("/login?error=failed", origin), 303);
  }
}
