import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Google Business Profile Optimizer for MLOs | YPN USA",
  description:
    "Improve your local mortgage visibility with a Google Business Profile optimization workflow designed for loan officers and teams.",
  alternates: { canonical: "/features/gmb-optimizer" },
};

export default function GbmOptimizerPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16 text-slate-900">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">Feature</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
        Google Business Profile Optimizer
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-700">
        Turn your profile into a more consistent, more discoverable, and more trust-building asset for
        local search and lead generation.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Profile clarity",
            body: "Strengthen service descriptions, categories, and local positioning so your profile matches what borrowers are searching for.",
          },
          {
            title: "Lead capture",
            body: "Use messaging and conversion prompts that help visitors take action faster and with less friction.",
          },
          {
            title: "Ongoing optimization",
            body: "Keep the profile fresh and relevant with updates, reviews, and a structured approach to local visibility improvements.",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">{item.title}</h2>
            <p className="mt-3 text-slate-700">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-3xl border border-violet-200 bg-violet-50 p-6 md:p-8">
        <h2 className="text-2xl font-semibold">Built to support local discovery</h2>
        <p className="mt-4 text-slate-700">
          This feature is designed to improve consistency across your business profile, strengthen local
          credibility, and help borrowers understand who you are, where you serve, and why you’re the right fit.
        </p>
        <a href="/pricing" className="mt-6 inline-flex rounded-full bg-violet-700 px-6 py-3 text-sm font-semibold text-white">
          Explore plans →
        </a>
      </div>
    </main>
  );
}
