import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Books by David J. Moore | YPN USA",
  description:
    "Read David J. Moore’s books on mortgage marketing, real-estate growth, and lead-generation systems.",
  alternates: { canonical: "/books" },
};

const BOOKS = [
  {
    title: "The Mortgage Sales Playbook",
    href: "https://amzn.to/4dzdePZ",
    rating: "4.8/5",
    summary:
      "A practical roadmap for mortgage professionals who want stronger sales conversations, better conversion, and more confident client conversations.",
    accent: "bg-violet-100 text-violet-800",
  },
  {
    title: "Mortgage Marketing & Growth",
    href: "https://link.amazon/B0aaUgWRs",
    rating: "4.9/5",
    summary:
      "A growth-focused resource for marketing systems, borrower acquisition, and building a stronger digital presence in the mortgage business.",
    accent: "bg-cyan-100 text-cyan-800",
  },
];

export default function BooksPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 text-slate-900">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">
          Books & resources
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          Books that help mortgage pros grow smarter
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-700">
          David J. Moore writes for professionals who want better sales systems, stronger local
          marketing, and a more reliable way to turn attention into opportunities.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {BOOKS.map((book) => (
          <article
            key={book.title}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${book.accent}`}>
              ★ {book.rating}
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex h-20 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 text-lg font-bold text-white">
                Book cover
              </div>
            </div>

            <h2 className="mt-5 text-2xl font-semibold">{book.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">{book.summary}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={book.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white"
              >
                Buy on Amazon
              </a>
              <Link
                href="/about"
                className="inline-flex rounded-full border border-violet-200 bg-white px-5 py-3 text-sm font-semibold text-violet-700"
              >
                Meet the author
              </Link>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-16 rounded-3xl border border-slate-200 bg-slate-50 p-8">
        <h2 className="text-2xl font-semibold">Why these books matter</h2>
        <ul className="mt-5 list-disc space-y-3 pl-6 text-slate-700">
          <li>They help mortgage professionals think more strategically about growth.</li>
          <li>They give practical guidance for marketing systems instead of theory only.</li>
          <li>They support the same plays used inside YPN USA’s tools and services.</li>
        </ul>
      </section>
    </main>
  );
}
