import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { FOUNDER_ID, jsonLdScript, marketingMetadata } from "@/lib/seo";
import { PAGE_SEO } from "@/lib/seo/page-seo";
import { homeTrail } from "@/lib/seo/breadcrumbs";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  AI_BOOK,
  AI_BOOK_PRICE_LINE,
  AMAZON_ASSOCIATE_DISCLOSURE,
  AUTHOR_NAME,
  BOOK_AMAZON_URL,
  BOOK_TITLE,
} from "@/lib/author";
import { MARKETING_SITE_URL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return marketingMetadata({ ...PAGE_SEO.book, absoluteTitle: true, path: "/book" });
}

/** Product page on Amazon without the associate tag, for schema identity (sameAs / offer URL). */
const AMAZON_PRODUCT_URL = `https://www.amazon.com/dp/${AI_BOOK.asin}`;

/** Listing facts only (from the Amazon page), so nothing here describes content we haven't verified. */
const DETAILS: Array<[string, string]> = [
  ["Format", "Kindle eBook"],
  ["Price", AI_BOOK_PRICE_LINE],
  ["Publisher", AI_BOOK.publisher],
  ["Published", "October 31, 2026"],
  ["Series", AI_BOOK.series],
  ["ASIN", AI_BOOK.asin],
];

export default function BookPage() {
  const origin = MARKETING_SITE_URL;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    "@id": `${origin}/book#book`,
    name: AI_BOOK.title,
    alternateName: AI_BOOK.shortTitle,
    author: { "@type": "Person", "@id": FOUNDER_ID, name: AUTHOR_NAME },
    publisher: { "@type": "Organization", name: AI_BOOK.publisher },
    datePublished: AI_BOOK.datePublished,
    isPartOf: { "@type": "BookSeries", name: AI_BOOK.series },
    bookFormat: "https://schema.org/EBook",
    inLanguage: "en",
    url: `${origin}/book`,
    image: `${origin}${AI_BOOK.cover}`,
    identifier: { "@type": "PropertyValue", propertyID: "ASIN", value: AI_BOOK.asin },
    sameAs: AMAZON_PRODUCT_URL,
    offers: {
      "@type": "Offer",
      price: AI_BOOK.kindlePrice,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: AMAZON_PRODUCT_URL,
      seller: { "@type": "Organization", name: "Amazon" },
    },
  };

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="bg-[#09081b] text-white">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
        <div className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6">
          <Breadcrumbs items={homeTrail({ name: "The book", href: "/book" })} />
        </div>
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[240px_minmax(0,1fr)] md:items-center md:py-16">
          <Image
            src={AI_BOOK.cover}
            alt={`Book cover: ${AI_BOOK.shortTitle} by David J. Moore`}
            width={300}
            height={446}
            priority
            sizes="(min-width: 768px) 240px, 192px"
            className="mx-auto w-48 rounded-lg shadow-2xl shadow-black/50 md:w-full"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
              New Kindle book · {AI_BOOK.series} series
            </p>
            <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight sm:text-4xl">{AI_BOOK.shortTitle}</h1>
            <p className="mt-2 text-lg text-white/85">
              10 Secret AI-Powered Real Estate Tricks for Investors Who Want to Build Wealth in Today&rsquo;s
              Data-Driven Market
            </p>
            <p className="mt-2 text-sm text-white/70">
              by {AUTHOR_NAME} · {AI_BOOK.publisher}, October 31, 2026
            </p>
            <p className="mt-5 text-white/85">
              David&rsquo;s Kindle guide to using AI in real estate: ten AI-powered techniques for investors who want to
              build wealth in a data-driven market, from a loan officer with 25+ years in lending.
            </p>
            <p className="mt-4 text-base font-semibold text-white">{AI_BOOK_PRICE_LINE}.</p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
              <a
                href={AI_BOOK.url}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-amber-400 px-7 py-3.5 text-[#09081b] shadow-xl shadow-amber-500/30 transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                Get it on Amazon
              </a>
              <Link
                href="/about"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/35 bg-white/10 px-6 py-3.5 transition hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                About the author
              </Link>
            </div>
            <p className="mt-4 text-xs text-white/70">
              Opens Amazon in a new tab. {AMAZON_ASSOCIATE_DISCLOSURE}
            </p>
          </div>
        </div>

        <section className="border-t border-white/10 bg-[#0b0a20]">
          <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold">Book details</h2>
              <dl className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/5">
                {DETAILS.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[110px_1fr] gap-3 px-5 py-3 text-sm">
                    <dt className="font-semibold text-white/70">{label}</dt>
                    <dd className="text-white/90">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-white/70">
                Educational content, not financial, legal or tax advice. Price as listed on Amazon; Amazon sets the
                current price.
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-semibold">For loan officers: AI that works your borrowers</h2>
              <p className="mt-3 text-white/85">
                The same ideas power YPN USA. Cerebro, our AI assistant for mortgage loan officers, answers and qualifies
                borrowers on your site day or night and hands the ready ones to you.
              </p>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <Link href="/cerebro" className="font-semibold text-violet-200 underline hover:text-white">
                  Meet Cerebro
                </Link>
                <Link href="/claim-territory" className="font-semibold text-violet-200 underline hover:text-white">
                  Check your ZIP code free
                </Link>
                <Link href="/pricing" className="font-semibold text-violet-200 underline hover:text-white">
                  Pricing
                </Link>
              </div>
              <p className="mt-8 text-sm text-white/70">
                Also by David: <cite>{BOOK_TITLE}</cite>, available{" "}
                <a href={BOOK_AMAZON_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                  on Amazon
                </a>
                .
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
