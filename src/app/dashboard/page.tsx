import Link from "next/link";
import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { SessionBar } from "@/components/session-bar";
import { requireSession } from "@/lib/auth";
import { isPaidEntitlement, resolveEntitlement } from "@/lib/entitlements";
import { getPricingTier, isPricingTierId, TRIAL_DAYS } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface Section {
  href: string;
  title: string;
  description: string;
  /** Operator-only pages (revenue, results, telemetry): shown to admins only. */
  adminOnly?: boolean;
}

const SECTIONS: readonly Section[] = [
  {
    href: "/onboarding",
    title: "Activate Cerebro",
    description: "Set the mission, permissions, guardrails, and run a safe agent test.",
  },
  {
    href: "/portal/nurture",
    title: "Lead Nurture & Appointments",
    description: "AI-qualified borrowers, outreach health, and calendar conversions.",
  },
  {
    href: "/dashboard/local-seo",
    title: "Local SEO & GBP",
    description: "Territory pages and verified Google review connections.",
  },
  {
    href: "/dashboard/territories",
    title: "Territory Intelligence",
    description: "ZIP code availability and what each territory means for you.",
  },
  {
    href: "/dashboard/growth",
    title: "Growth Copilot",
    description: "Your three best actions this week, plus a compliance check for your posts and emails.",
  },
  {
    href: "/dashboard/intelligence",
    title: "Content Generators",
    description: "Marketing copy, GMB posts, and website page specs.",
  },
  {
    href: "/dashboard/life-events",
    title: "Life-Event Intelligence",
    description: "Rule-based lead scoring across census and county life-event signals.",
  },
  {
    href: "/dashboard/autopilot",
    title: "Website Autopilot",
    description: "Draft website/profile improvements for your approval — nothing goes live without you.",
  },
  {
    href: "/dashboard/content",
    title: "Content Ingestion",
    description: "Turn WordPress HTML/Markdown into normalized patterns.",
  },
  {
    href: "/dashboard/silos",
    title: "Content Silos",
    description: "Patterns classified by silo with funnel recommendations.",
  },
  {
    href: "/dashboard/funnels",
    title: "Funnel Builder",
    description: "Landing page, email sequence, and social posts from one pattern.",
  },
  {
    href: "/dashboard/conversion",
    title: "Conversion Insights",
    description: "ZIP code demand, life-event likelihood, and CTA performance sets.",
  },
  {
    href: "/dashboard/borrower-intelligence",
    title: "Borrower Intelligence",
    description: "Borrower persona, confidence, and signup/conversion outcome predictions.",
  },
  {
    href: "/analytics",
    title: "Intake Telemetry",
    description: "Completion rates, qualification mix, and follow-up pulses.",
    adminOnly: true,
  },
  {
    href: "/admin/revenue",
    title: "Revenue Breakdown",
    description: "Subscription tiers and territory claims.",
    adminOnly: true,
  },
  {
    href: "/dashboard/results",
    title: "Results",
    description: "Requests, trials and verified payments toward the goal.",
    adminOnly: true,
  },
];

const STARTER_PROMPTS = [
  "Help me get visible in my ZIP code",
  "Write my Google Business Profile post",
  "Draft a follow-up text for a new lead",
  "What should I do first?",
] as const;

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Free trial",
  past_due: "Payment past due",
  canceled: "Canceled",
  none: "",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardHubPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireSession("/dashboard");
  const params = await searchParams;
  const entitlement = resolveEntitlement(session);
  const paid = isPaidEntitlement(entitlement);
  const isAdmin = session.role === "admin";

  // requireTier (src/lib/entitlements.ts) and onboarding send people here as ?upgrade=<tier>.
  const upgradeParam = firstParam(params.upgrade);
  const upgradeTier = isPricingTierId(upgradeParam) && upgradeParam !== "free" ? getPricingTier(upgradeParam) : null;
  const showUpgradeBanner = !paid || upgradeTier !== null;
  const lowestPaid = getPricingTier("growth");

  const plan = getPricingTier(entitlement.tier);
  const statusLabel = STATUS_LABEL[entitlement.status] ?? "";
  const sections = SECTIONS.filter((section) => !section.adminOnly || isAdmin);

  return (
    <main className="min-h-full bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-700">YPN USA</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard</h1>
            <p className="mt-2 text-sm text-slate-600">
              Plan: <span className="font-semibold text-slate-900">{plan.name}</span>
              {paid && statusLabel ? <span className="text-slate-500"> · {statusLabel}</span> : null}
              {isAdmin ? <span className="text-slate-500"> · Admin</span> : null}
            </p>
          </div>
          <SessionBar />
        </header>

        {showUpgradeBanner ? (
          <section
            aria-label="Upgrade"
            className="mt-8 flex flex-col gap-4 rounded-3xl border border-amber-300 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <div>
              {upgradeTier && paid ? (
                <>
                  <h2 className="text-lg font-semibold text-amber-950">
                    That page is part of the {upgradeTier.name} plan
                  </h2>
                  <p className="mt-1 text-sm text-amber-900">
                    You&rsquo;re on {plan.name}. Upgrade to {upgradeTier.name} to open it.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-amber-950">Your ZIP code isn&rsquo;t locked</h2>
                  <p className="mt-1 text-sm text-amber-900">
                    On the Free plan, another loan officer can claim it at any time — only a paid plan locks your ZIP
                    code to you. Lock it now: {TRIAL_DAYS}-day free trial, from {lowestPaid.price}/mo.
                  </p>
                </>
              )}
            </div>
            <Link
              href="/pricing"
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800"
            >
              {upgradeTier && paid ? `See ${upgradeTier.name}` : "Lock my ZIP code"}
            </Link>
          </section>
        ) : null}

        <section aria-label="Cerebro" className="mt-8">
          <AssistantChat
            mode="mlo_dashboard"
            title="Cerebro — your AI marketing assistant"
            placeholder="Ask Cerebro anything about your market, leads, or marketing…"
            starterPrompts={STARTER_PROMPTS}
          />
        </section>

        <h2 className="mt-12 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Tools</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-violet-300 hover:shadow-lg"
            >
              <h3 className="text-lg font-semibold">{section.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{section.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
