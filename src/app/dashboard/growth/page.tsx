import Link from "next/link";
import type { Metadata } from "next";
import { SessionBar } from "@/components/session-bar";
import { ComplianceChecker } from "@/components/growth/compliance-checker";
import { requireSession } from "@/lib/auth";
import { buildWeeklyPlan, loadGrowthPlanInput } from "@/lib/growth/weekly-plan";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Growth Copilot",
  robots: { index: false, follow: false },
};

export default async function GrowthCopilotPage() {
  const session = await requireSession("/dashboard/growth");
  const plan = buildWeeklyPlan(loadGrowthPlanInput(session));

  return (
    <main id="main-content" className="min-h-screen bg-[#09081b] px-5 py-10 text-white md:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">Growth Copilot</p>
            <h1 className="text-3xl font-semibold tracking-tight">Your week at a glance</h1>
            <p className="max-w-2xl text-sm leading-6 text-white/60">
              Three things worth doing this week, based on your own borrowers and territory. Nothing is posted, emailed
              or texted for you. You stay in control of every message.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Dashboard
            </Link>
            <SessionBar tone="dark" />
          </div>
        </header>

        <ol className="space-y-4">
          {plan.map((action, index) => (
            <li key={action.id} className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Step {index + 1}</p>
              <h2 className="mt-2 text-xl font-semibold">{action.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">{action.why}</p>
              <Link
                href={action.href}
                className="mt-4 inline-flex rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
              >
                {action.cta}
              </Link>
            </li>
          ))}
        </ol>

        <ComplianceChecker />
      </div>
    </main>
  );
}
