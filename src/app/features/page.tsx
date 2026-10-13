import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features | YPN USA",
  description: "Discover the AI-powered features designed to help mortgage professionals grow more confidently.",
  alternates: { canonical: "/features" },
};

const FEATURE_CARDS = [
  {
    title: "Marketing Expert Companion",
    href: "/features/marketing-companion",
    body: "Positioning, campaign guidance, and stronger lead follow-up for loan officers who want more strategic support.",
  },
  {
    title: "Google Business Profile Optimizer",
    href: "/features/gmb-optimizer",
    body: "Improve local visibility, profile consistency, and trust-building signals for borrowers searching nearby.",
  },
  {
    title: "AI Borrower Intake",
    href: "/pricing",
    body: "Capture borrower intent, qualify demand, and route the right opportunities with automation built for the mortgage funnel.",
  },
];

export default function FeaturesPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 text-slate-900">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">Features</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Tools for growth-minded MLOs</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700">
        YPN USA combines local visibility, lead capture, and conversion systems so loan officers can operate with more clarity,
        speed, and consistency.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {FEATURE_CARDS.map((card) => (
          <a
            key={card.title}
            href={card.href}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
          >
            <h2 className="text-xl font-semibold">{card.title}</h2>
            <p className="mt-3 text-slate-700">{card.body}</p>
            <span className="mt-5 inline-flex text-sm font-semibold text-violet-700">Learn more →</span>
          </a>
        ))}
      </div>
    </main>
  );
}

