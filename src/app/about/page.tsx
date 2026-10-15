import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BreadcrumbSchema } from "@/components/seo/breadcrumbs";
import { marketingMetadata } from "@/lib/seo";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  AUTHOR_NAME,
  AUTHOR_PROFILES,
  BOOK_AMAZON_URL,
  CA_DRE_ID,
  NMLS_CONSUMER_ACCESS_URL,
  NMLS_ID,
} from "@/lib/author";
import { MARKETING_SITE_URL } from "@/lib/site";

export const metadata: Metadata = marketingMetadata({
  title: "David J. Moore, MBA: Mortgage Expert & Author",
  description:
    "Meet David J. Moore, MBA: nearly 30 years in mortgage lending, former top-producing loan officer at Chase Bank and Wells Fargo Home Mortgage, author, and founder of YPN USA.",
  path: "/about",
});

const CREDENTIALS: Array<[string, string]> = [
  ["Education", "MBA, California State University, Fresno"],
  ["Experience", "Former top-producing loan officer at Chase Bank and Wells Fargo Home Mortgage; thousands of closed home loans"],
  ["Licensing", `NMLS #${NMLS_ID} · California DRE #${CA_DRE_ID}`],
  ["Author", "Amazon-published real estate author and nationwide speaker"],
  ["Founder", "YPN Inc. (YPN USA) and ToInvested.com"],
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "@id": `${MARKETING_SITE_URL}/about#profile`,
  url: `${MARKETING_SITE_URL}/about`,
  name: `${AUTHOR_NAME} — Mortgage Expert & Author`,
  mainEntity: { "@id": `${MARKETING_SITE_URL}/#person-david-moore` },
};

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="bg-[#09081b] text-white">
        <BreadcrumbSchema items={[{ name: "Home", href: "/" }, { name: "About", href: "/about" }]} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[minmax(0,1fr)_260px] md:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">About the founder</p>
            <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight sm:text-4xl">
              {AUTHOR_NAME} — mortgage expert, author &amp; founder of YPN USA
            </h1>
            <p className="mt-5 text-lg text-white/85">
              With nearly 30 years in mortgage lending, David built YPN USA to give loan officers what he
              wished he had at the top of his own production: exclusive local demand, an AI assistant that
              never lets a borrower bounce, and a pipeline that belongs to the loan officer, not the employer.
            </p>

            <h2 className="mt-12 text-2xl font-semibold">Credentials</h2>
            <dl className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/5">
              {CREDENTIALS.map(([label, value]) => (
                <div key={label} className="grid gap-1 px-5 py-4 sm:grid-cols-[140px_1fr]">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-white/50">{label}</dt>
                  <dd className="text-sm text-white/85">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-white/50">
              Verify licensing at{" "}
              <a
                href={NMLS_CONSUMER_ACCESS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white"
              >
                NMLS Consumer Access
              </a>
              .
            </p>

            <h2 className="mt-12 text-2xl font-semibold">Why YPN USA exists</h2>
            <p className="mt-4 text-white/80">
              Most loan officers rent attention from Realtors and shared lead vendors, then lose their book
              every time they change companies. YPN USA reverses that: one loan officer per ZIP territory,
              24/7 AI borrower intake across FHA, VA, conventional, DSCR, HELOC, refinance and jumbo, and
              leads and websites that stay with you for your career.
            </p>

            <h2 className="mt-12 text-2xl font-semibold">Author &amp; speaker</h2>
            <p className="mt-4 text-white/80">
              David is the author of{" "}
              <Link href="/book" className="text-violet-300 underline hover:text-violet-200">
                Top 9 Online Real Estate Leads Even the Gurus Do Not Know About
              </Link>{" "}
              (also on{" "}
              <a href={BOOK_AMAZON_URL} target="_blank" rel="noopener noreferrer" className="text-violet-300 underline hover:text-violet-200">
                Amazon
              </a>
              ) and speaks nationwide on mortgage marketing and real estate lead generation.
            </p>

            <div className="mt-10 flex flex-wrap gap-4 text-sm font-semibold">
              <Link
                href="/consultation"
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-7 py-3.5 text-[#09081b] shadow-xl shadow-amber-500/30 transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                Book a consultation
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full border border-white/35 bg-white/10 px-6 py-3.5 transition hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                See pricing
              </Link>
            </div>

            <p className="mt-8 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/60">
              <a href={AUTHOR_PROFILES.linkedin} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">LinkedIn</a>
              <a href={AUTHOR_PROFILES.facebook} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Facebook</a>
              <a href={AUTHOR_PROFILES.orcid} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">ORCID</a>
            </p>
          </div>

          <div className="order-first md:order-none">
            <Image
              src="/images/david-j-moore-mba.jpg"
              alt={`Portrait of ${AUTHOR_NAME}`}
              width={428}
              height={498}
              priority
      sizes="(min-width: 768px) 260px, 192px"
              className="mx-auto w-48 rounded-2xl border border-white/10 object-cover md:w-full"
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
