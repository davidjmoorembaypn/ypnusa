import { CopySnippet } from "@/components/copy-snippet";
import { LinkedInArticles } from "@/components/marketing-kit/linkedin-articles";
import { readAgentOnboarding, readMarketingKit } from "@/lib/db";
import type { Entitlement } from "@/lib/entitlements";
import {
  articlesLeft,
  BADGE_HEIGHT,
  BADGE_WIDTH,
  badgeSnippet,
  LINKEDIN_NEW_ARTICLE_URL,
  linkedinAllowance,
} from "@/lib/marketing-kit";
import { officerShortId, publicOfficerPageForUser } from "@/lib/officer-profile";

/**
 * Dashboard "Marketing kit": the website badge snippet and the officer's LinkedIn article drafts.
 */
export function MarketingKitCard({ userId, entitlement, isAdmin }: { userId: string; entitlement: Entitlement; isAdmin: boolean }) {
  const profile = readAgentOnboarding(userId)?.officerProfile ?? null;
  const page = publicOfficerPageForUser(userId);
  const kit = readMarketingKit(userId);
  const snippet = badgeSnippet({ userId, profile, page });
  const allowance = linkedinAllowance(entitlement, isAdmin);
  const now = new Date();
  const existing = kit?.linkedinArticles ?? [];
  const left = articlesLeft(allowance, existing, now);
  const hasProfile = Boolean(profile?.fullName && profile.nmlsId);
  const planIncludes = allowance.perMonth !== 0;

  return (
    <section id="marketing-kit" aria-label="Marketing kit" className="mt-8 scroll-mt-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Marketing kit</p>

      <h2 className="mt-3 text-xl font-semibold">Your website badge</h2>
      <p className="mt-1 text-sm text-slate-600">
        Put this on your own website and visitors can chat with Cerebro day or night; their requests come straight to you.
        It also links your website to your page on ypnus.com.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- the same SVG the officer's website loads */}
      <img
        src={`/api/badge/${officerShortId(userId)}`}
        alt="Preview of your website badge"
        width={BADGE_WIDTH}
        height={BADGE_HEIGHT}
        className="mt-4 h-auto max-w-full"
      />
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>Tap Copy badge code.</li>
        <li>
          On your website, add an HTML or Embed block to your footer (WordPress: Custom HTML block; Wix: Embed Code; Squarespace:
          Code block) and paste.
        </li>
      </ol>
      <CopySnippet code={snippet} label="Website badge" tone="light" buttonLabel="Copy badge code" />
      <p className="mt-3 text-sm text-slate-700">
        {kit?.badgeHost
          ? `Spotted on ${kit.badgeHost}. Thanks for keeping it up.`
          : "Not spotted on your website yet. After you paste it, open your website once and it will show here."}
      </p>
      {!page ? (
        <p className="mt-1 text-xs text-slate-500">
          The badge links to ypnus.com until your borrower page is live; then it links to your own page automatically.
        </p>
      ) : null}

      <h2 className="mt-10 text-xl font-semibold">LinkedIn articles</h2>
      <p className="mt-1 text-sm text-slate-600">
        Cerebro writes an article in your voice with your NMLS ID, company and Equal Housing line already on it, and a link to your
        borrower page. You post it from your own LinkedIn profile.
      </p>
      <div className="mt-4">
        <LinkedInArticles
          initial={[...existing].reverse().map(({ id, title, body, createdAt }) => ({ id, title, body, createdAt }))}
          left={left}
          allowanceLabel={allowance.label}
          canDraft={planIncludes && hasProfile}
          blockedReason={
            !planIncludes
              ? "Upgrade to Pro to get your first article, or Growth and Exclusive for new ones every month."
              : !hasProfile
                ? "Add your name and NMLS ID to your profile first; every article must show them."
                : undefined
          }
          linkedinUrl={LINKEDIN_NEW_ARTICLE_URL}
        />
      </div>
    </section>
  );
}
