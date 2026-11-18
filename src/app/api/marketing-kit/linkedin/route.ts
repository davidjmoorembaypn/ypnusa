import { getSession } from "@/lib/auth";
import { readAgentOnboarding, readMarketingKit, saveLinkedInArticle } from "@/lib/db";
import { resolveEntitlement } from "@/lib/entitlements";
import { jsonError, jsonOk, logApiError } from "@/lib/http";
import {
  articlesLeft,
  draftLinkedInArticle,
  linkedinAllowance,
  monthKey,
  newArticleRecord,
} from "@/lib/marketing-kit";
import { publicOfficerPageFor } from "@/lib/officer-profile";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Drafts the signed-in loan officer's next LinkedIn article, if their plan has one left.
 * The draft is saved to their marketing kit and returned; nothing is posted anywhere.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return jsonError("Authentication required.", 401, "UNAUTHORIZED");

  const limited = rateLimit(`linkedin-article:${session.sub}`, 3, 60_000);
  if (!limited.ok) {
    return jsonError("Please wait a minute and try again.", 429, "RATE_LIMITED", {
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  const allowance = linkedinAllowance(resolveEntitlement(session), session.role === "admin");
  const now = new Date();
  const existing = readMarketingKit(session.sub)?.linkedinArticles ?? [];
  if (articlesLeft(allowance, existing, now) <= 0) {
    return jsonError(
      allowance.perMonth === 0
        ? "LinkedIn articles come with the Pro, Growth and Exclusive plans."
        : "You've used this month's articles. Your next one is ready to draft next month.",
      403,
      "NO_ARTICLES_LEFT",
    );
  }

  const onboarding = readAgentOnboarding(session.sub);
  const profile = onboarding?.officerProfile;
  if (!profile?.fullName || !profile.nmlsId) {
    return jsonError("Add your name and NMLS ID to your profile first; every article must show them.", 409, "PROFILE_INCOMPLETE");
  }

  try {
    const page = publicOfficerPageFor(onboarding);
    const zip = page?.zips[0] ?? onboarding?.territoryZip;
    const draft = await draftLinkedInArticle({
      profile,
      page,
      zip,
      now,
      indexThisMonth: existing.filter((article) => article.month === monthKey(now)).length,
    });
    const record = newArticleRecord(draft, now);
    const saved = saveLinkedInArticle(session.sub, record, (articles) => articlesLeft(allowance, articles, now) > 0);
    if (!saved) {
      return jsonError("You've used this month's articles. Your next one is ready to draft next month.", 403, "NO_ARTICLES_LEFT");
    }
    return jsonOk({ article: record, left: articlesLeft(allowance, [...existing, record], now) });
  } catch (error) {
    logApiError("/api/marketing-kit/linkedin", error);
    return jsonError("Unable to draft your article. Please try again.", 500, "DRAFT_FAILED");
  }
}
