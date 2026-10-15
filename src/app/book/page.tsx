import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BreadcrumbSchema } from "@/components/seo/breadcrumbs";
import { marketingMetadata } from "@/lib/seo";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AUTHOR_NAME, BOOK_AMAZON_URL, BOOK_COVER_TITLE, BOOK_TITLE } from "@/lib/author";
import { APP_SITE_URL, MARKETING_SITE_URL } from "@/lib/site";

export const metadata: Metadata = marketingMetadata({
  title: "Top 9 Online Real Estate Leads: The Book",
  description:
    "A practical guide by David J. Moore, MBA to nine online real estate lead sources even the gurus overlook. Get it on Amazon, then claim your exclusive ZIP territory.",
  path: "/book",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Book",
  "@id": `${MARKETING_SITE_URL}/book#book`,
  name: BOOK_TITLE,
  alternateName: BOOK_COVER_TITLE,
  author: { "@id": `${MARKETING_SITE_URL}/#person-david-moore` },
  url: `${MARKETING_SITE_URL}/book`,
  image: `${APP_SITE_URL}/images/top-9-online-real-estate-leads-cover.jpg`,
  inLanguage: "en",
  sameAs: BOOK_AMAZON_URL,
  workExample: {
    "@type": "Book",
    bookFormat: "https://schema.org/Paperback",
    potentialAction: { "@type": "ReadAction", target: BOOK_AMAZON_URL },
  },
};

export default function BookPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="bg-[#09081b] text-white">
        <BreadcrumbSchema items={[{ name: "Home", href: "/" }, { name: "The book", href: "/book" }]} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[260px_minmax(0,1fr)] md:items-center md:py-20">
          <Image
            src="/images/top-9-online-real-estate-leads-cover.jpg"
            alt={`Book cover: ${BOOK_COVER_TITLE} by ${AUTHOR_NAME}`}
            width={264}
            height={342}
            priority
            sizes="(min-width: 768px) 260px, 208px"
            className="mx-auto w-52 rounded-lg shadow-2xl shadow-black/50 md:w-full"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">The book</p>
            <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight sm:text-4xl">{BOOK_TITLE}</h1>
            <p className="mt-2 text-sm text-white/60">by {AUTHOR_NAME}</p>
            <p className="mt-5 text-lg text-white/85">
              A practical guide to nine online lead sources that most real estate and mortgage professionals
              never use. Written by a former top-producing loan officer with nearly 30 years in the industry.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold">
              <a
                href={BOOK_AMAZON_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-7 py-3.5 text-[#09081b] shadow-xl shadow-amber-500/30 transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                Get the book on Amazon
              </a>
              <Link
                href="/#territories"
                className="inline-flex items-center justify-center rounded-full border border-white/35 bg-white/10 px-6 py-3.5 transition hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                Check your ZIP territory — free
              </Link>
            </div>
            <p className="mt-4 text-xs text-white/50">
              Opens Amazon in a new tab. This is a direct listing link, not an affiliate link.
            </p>
          </div>
        </div>

        <section className="border-t border-white/10 bg-[#0b0a20]">
          <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold">From the book to your own lead engine</h2>
            <p className="mt-3 max-w-3xl text-white/75">
              The book shows where online demand hides. YPN USA turns it into a system: an exclusive ZIP
              territory, an AI assistant that captures and qualifies every borrower 24/7, and leads you own
              for life.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <Link href="/features" className="text-violet-300 underline hover:text-violet-200">Platform features</Link>
              <Link href="/pricing" className="text-violet-300 underline hover:text-violet-200">Pricing</Link>
              <Link href="/about" className="text-violet-300 underline hover:text-violet-200">About David</Link>
              <Link href="/consultation" className="text-violet-300 underline hover:text-violet-200">Book a consultation</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
