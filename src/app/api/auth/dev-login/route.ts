import { createSession } from "@/lib/auth";
import { isRecord, jsonError, jsonOk, logApiError, parseJsonBody } from "@/lib/http";
import { isPricingTierId } from "@/lib/pricing";
import { isEntitlementStatus, type SessionRole } from "@/lib/session";
import { isValidEmail } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Local-dev-only session issuer so the dashboard/proxy gate can be exercised with
 * `npm run dev` and no live WordPress SSO handoff. Disabled in production.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return jsonError("Not found.", 404, "NOT_FOUND");
  }

  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok || !isRecord(parsed.data)) {
      return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
    }

    const email = typeof parsed.data.email === "string" ? parsed.data.email.trim() : "";
    if (!email || !isValidEmail(email)) {
      return jsonError("A valid email is required.", 400, "INVALID_EMAIL");
    }
    const role: SessionRole = parsed.data.role === "admin" ? "admin" : "mlo";
    // Optional — lets local dev exercise tier-gated features without a live SSO handoff.
    // Omit both to get the same "free, no claim" session every real first-time login gets.
    const tier = isPricingTierId(parsed.data.tier) ? parsed.data.tier : undefined;
    const subscriptionStatus = isEntitlementStatus(parsed.data.subscriptionStatus)
      ? parsed.data.subscriptionStatus
      : undefined;

    await createSession({ sub: `dev_${email}`, email, role, tier, subscriptionStatus });
    return jsonOk({ email, role, tier, subscriptionStatus });
  } catch (error) {
    logApiError("/api/auth/dev-login", error);
    return jsonError("Dev login failed.", 500, "DEV_LOGIN_FAILED");
  }
}
