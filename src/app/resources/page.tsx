import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mortgage Growth Resources | YPN USA",
  description:
    "Explore mortgage and real-estate growth resources, from local market strategy to AI-powered lead systems.",
  alternates: { canonical: "/resources" },
};

const RESOURCES = [
  {
    title: "Mortgage Lead Generation Guide",
    description:
      "A practical framework for turning traffic into conversations and conversations into closed loans.",
    href: "/blog",
  },
  {
    title: "Local Market Strategy",
    description:
      "Learn how to position your business around the right ZIP codes, neighborhoods, and borrower segments.",
    href: "/features",
  },
  {
    title: "AI for Mortgage Growth",
    description:
      "Understand how AI-powered intake and follow-up can reduce friction in your borrower journey.",
    href: "/features/marketing-companion",
  },
];

export default function ResourcesPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 text-slate-900">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">
          Resources
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          High-value resources for serious mortgage professionals
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-700">
          These pages are designed to help loan officers and team leaders improve visibility,
          conversion, and pipeline quality without gimmicks or vanity metrics.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {RESOURCES.map((resource) => (
          <Link
            key={resource.title}
            href={resource.href}
            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">
              Resource
            </div>
            <h2 className="mt-4 text-2xl font-semibold">{resource.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">{resource.description}</p>
            <span className="mt-5 inline-flex text-sm font-semibold text-violet-700">
              Explore →
            </span>
          </Link>
        ))}
      </div>

      <section className="mt-16 rounded-3xl border border-slate-200 bg-slate-50 p-8">
        <h2 className="text-2xl font-semibold">What makes a resource link-worthy</h2>
        <ul className="mt-5 list-disc space-y-3 pl-6 text-slate-700">
          <li>Practical guidance instead of fluff.</li>
          <li>Specific to mortgage and real-estate growth.</li>
          <li>Useful enough to share with peers and partners.</li>
          <li>Built around actual growth systems, not generic marketing advice.</li>
        </ul>
      </section>
    </main>
  );
}
