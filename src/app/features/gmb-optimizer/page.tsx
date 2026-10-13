import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketing Expert Companion for MLOs | YPN USA",
  description:
    "Get an AI-powered marketing expert companion built for mortgage loan officers to manage positioning, campaigns, and lead follow-up.",
  alternates: { canonical: "/features/marketing-companion" },
};

export default function MarketingCompanionPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16 text-slate-900">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">Feature</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
        Marketing Expert Companion
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-700">
        Give your team a practical growth partner to sharpen positioning, improve campaign strategy,
        and keep lead follow-up consistent across the entire borrower journey.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Positioning",
            body: "Refine your value proposition, local differentiation, and offer clarity across your website and lead capture funnel.",
          },
          {
            title: "Campaign guidance",
            body: "Use AI to structure campaigns around borrower segments, local relevance, and conversion goals instead of one-off tactics.",
          },
          {
            title: "Follow-up consistency",
            body: "Improve your lead response rhythm and nurture sequence so opportunities do not drop after the first contact.",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">{item.title}</h2>
            <p className="mt-3 text-slate-700">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-3xl border border-violet-200 bg-violet-50 p-6 md:p-8">
        <h2 className="text-2xl font-semibold">Built for MLOs who want more than automation</h2>
        <p className="mt-4 text-slate-700">
          This companion is meant to help mortgage professionals think strategically, improve message
          quality, and keep conversion systems aligned with the real opportunity in their local market.
        </p>
        <a href="/pricing" className="mt-6 inline-flex rounded-full bg-violet-700 px-6 py-3 text-sm font-semibold text-white">
          View plan options →
        </a>
      </div>
    </main>
  );
}
