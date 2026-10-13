import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "About David J. Moore | YPN Inc.",
  description:
    "Learn about David J. Moore, President and CEO of YPN Inc., and the leadership behind YPN USA’s mortgage marketing, AI, and lead generation platform.",
  alternates: { canonical: "/about" },
};

const BOOK_LINKS = [
  {
    title: "The Mortgage Sales Playbook",
    url: "https://amzn.to/4dzdePZ",
  },
  {
    title: "Mortgage Marketing & Growth",
    url: "https://link.amazon/B0aaUgWRs",
  },
];

const authorJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "David J. Moore",
  jobTitle: "President and CEO",
  worksFor: {
    "@type": "Organization",
    name: "YPN Inc.",
    url: "https://ypnus.com",
  },
  knowsAbout: [
    "Real estate websites",
    "AI-driven marketing",
    "Lead generation",
    "Digital advertising",
    "Mortgage marketing strategy",
  ],
  description:
    "David J. Moore leads YPN Inc. (Young Professionals Network / YPN USA), helping mortgage professionals grow with digital marketing, AI workflow systems, and conversion-focused websites.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Four Embarcadero Center, Suite 1400",
    addressLocality: "San Francisco",
    addressRegion: "CA",
    postalCode: "94111",
    addressCountry: "US",
  },
  telephone: "+1 559-607-3797",
  areaServed: ["California", "Mortgage and real estate professionals"],
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 text-slate-900">
      <Script id="about-author-jsonld" type="application/ld+json">
        {JSON.stringify(authorJsonLd)}
      </Script>

      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">About</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">About David J. Moore</h1>

      <div className="mt-8 space-y-6 text-base leading-8 text-slate-700">
        <p>
          David J. Moore is the President and CEO of YPN Inc. (Young Professionals Network / YPN USA),
          a company built to help mortgage and real estate professionals generate more qualified leads,
          automate marketing follow-up, and create stronger digital visibility.
        </p>

        <p>
          YPN Inc. focuses on real estate websites, AI-driven marketing systems, lead generation, and digital
          advertising for modern sales teams and independent professionals. The company has a regional footprint in
          California, with strong ties to the Central Valley and a broad national focus on serving professionals who
          want to convert more opportunity into revenue.
        </p>

        <p>
          The work centers on practical marketing systems for growth: conversion-focused websites,
          AI-assisted customer engagement, territory-driven lead acquisition, and campaign execution that balances
          automation with sales velocity.
        </p>
      </div>

      <section className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 p-6 md:p-8">
        <h2 className="text-2xl font-semibold">YPN Inc. business details</h2>
        <ul className="mt-5 list-disc space-y-2 pl-6 text-slate-700">
          <li><strong>Company:</strong> YPN Inc. (Young Professionals Network / YPN USA)</li>
          <li><strong>Services:</strong> Real estate websites, AI-driven marketing, lead generation, and digital advertising</li>
          <li><strong>Leadership:</strong> David J. Moore (President / CEO)</li>
          <li><strong>Office:</strong> Four Embarcadero Center, Suite 1400, San Francisco, CA 94111</li>
          <li><strong>Regional presence:</strong> Reedley / Dinuba, CA area</li>
          <li><strong>Phone:</strong> +1 559-607-3797</li>
          <li><strong>Official website:</strong> <a href="https://ypnus.com" className="text-violet-700 underline">YPN Inc.</a></li>
        </ul>
      </section>

      <section className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <h2 className="text-2xl font-semibold">Books & resources</h2>
        <p className="mt-4 text-slate-700">
          David J. Moore has authored and shared practical business and marketing resources for professionals building
          trust, visibility, and growth in the mortgage and real-estate ecosystem.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {BOOK_LINKS.map((book) => (
            <a
              key={book.title}
              href={book.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-violet-900 shadow-sm transition hover:bg-violet-100"
            >
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700">Amazon</div>
              <div className="mt-2 text-lg font-semibold">{book.title}</div>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Books, education, and accomplishments</h2>
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-slate-700">
            This page can be expanded with the author’s full publishing history, degrees, speaking engagements, and
            corporate milestones. The business details and book links above establish the current verified foundation
            for the profile and can be paired with a full résumé, media mentions, or more published work as the library grows.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Work experience and focus areas</h2>
        <ul className="mt-5 list-disc space-y-2 pl-6 text-slate-700">
          <li>Mortgage and real estate growth strategy</li>
          <li>AI-driven customer acquisition and lead management</li>
          <li>Website design and landing page optimization</li>
          <li>Digital advertising and funnel design for revenue generation</li>
          <li>Operational systems that improve conversion and retention</li>
        </ul>
      </section>
    </main>
  );
}

