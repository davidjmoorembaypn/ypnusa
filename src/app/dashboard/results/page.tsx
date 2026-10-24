import Link from "next/link";
import type { Metadata } from "next";
import { SessionBar } from "@/components/session-bar";
import { requireAdminSession } from "@/lib/auth";
import { summarizeConversions } from "@/lib/conversions";
import { readDb } from "@/lib/db";
import { buildResultsFunnel } from "@/lib/results/funnel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Results",
  robots: { index: false, follow: false },
};

function percent(value: number | null): string {
  return value === null ? "-" : `${Math.round(value * 100)}%`;
}

export default async function ResultsPage() {
  await requireAdminSession("/dashboard/results");
  const db = readDb();
  const funnel = buildResultsFunnel({
    analyticsEvents: db.analyticsEvents,
    demoRequests: db.demoRequests,
    revenueSubscriptions: db.revenueSubscriptions,
    paymentConversions: db.paymentConversions,
    conversions: summarizeConversions(),
  });
  const progress = Math.min(funnel.verified / funnel.goal, 1);

  return (
    <main id="main-content" className="min-h-screen bg-[#09081b] px-5 py-10 text-white md:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">Results</p>
            <h1 className="text-3xl font-semibold tracking-tight">From request to verified payment</h1>
            <p className="max-w-2xl text-sm leading-6 text-white/60">
              Counts come only from records this app holds. Only live, paid, fulfilled subscriptions count as a
              payment. Website visits are in Google Analytics, so this view starts at the first action it can see.
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

        <section aria-labelledby="goal-heading" className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
          <h2 id="goal-heading" className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">
            Verified payments
          </h2>
          <p className="mt-3 text-5xl font-semibold tabular-nums">
            {funnel.verified}
            <span className="text-2xl text-white/50"> of {funnel.goal}</span>
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={funnel.goal}
            aria-valuenow={Math.min(funnel.verified, funnel.goal)}
            aria-label="Verified payments toward goal"
            className="mt-4 h-3 overflow-hidden rounded-full bg-white/10"
          >
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="mt-4 text-sm leading-6 text-white/70">{funnel.headline}</p>
        </section>

        <section aria-labelledby="funnel-heading" className="space-y-3">
          <h2 id="funnel-heading" className="text-xl font-semibold">
            Funnel
          </h2>
          <div className="overflow-hidden rounded-3xl border border-white/10">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Funnel stages with all-time totals, last 7 days, and step conversion</caption>
              <thead className="bg-white/[0.06] text-xs uppercase tracking-wide text-white/60">
                <tr>
                  <th scope="col" className="px-5 py-3">Stage</th>
                  <th scope="col" className="px-5 py-3 text-right">Total</th>
                  <th scope="col" className="px-5 py-3 text-right">Last 7 days</th>
                  <th scope="col" className="px-5 py-3 text-right">From previous</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {funnel.stages.map((stage) => (
                  <tr key={stage.id}>
                    <th scope="row" className="px-5 py-3 font-medium">{stage.label}</th>
                    <td className="px-5 py-3 text-right tabular-nums">{stage.total}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{stage.last7Days}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-white/60">{percent(stage.conversionFromPrevious)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-5 text-white/50">
            Trials require a card, so the first charge happens when the trial ends. Confirm each counted payment in the
            Stripe dashboard before reporting it.
          </p>
        </section>
      </div>
    </main>
  );
}
