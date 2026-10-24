import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbSchema } from "@/components/seo/breadcrumbs";
import { marketingMetadata } from "@/lib/seo";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { OpenAssistantButton } from "@/components/assistant/open-assistant-button";
import {
  AUTHOR_NAME,
  BOOKING_URL,
  BUSINESS_EMAIL,
  BUSINESS_PHONE_DISPLAY,
  BUSINESS_PHONE_E164,
} from "@/lib/author";
import { MARKETING_SITE_URL } from "@/lib/site";
import { getSiteOrigin } from "@/lib/request-host";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getSiteOrigin();
  return marketingMetadata({
    title: "Book a Strategy Consultation",
    description:
      "Talk to the YPN USA team about exclusive ZIP territories, AI borrower intake, and building a mortgage lead pipeline you own. Book a consultation today.",
    path: "/consultation",
    origin,
  });
}

const BUTTON_PRIMARY =
  "inline-flex items-center justify-center rounded-full bg-amber-400 px-7 py-3.5 text-[#09081b] shadow-xl shadow-amber-500/30 transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200";
const BUTTON_SECONDARY =
  "inline-flex items-center justify-center rounded-full border border-white/35 bg-white/10 px-6 py-3.5 transition hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300";

export default async function ConsultationPage() {
  const origin = await getSiteOrigin();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${origin}/consultation#page`,
    url: `${origin}/consultation`,
    name: "Book a consultation with YPN USA",
    // Always the marketing-site entity id (see layout.tsx's @graph) — the
    // canonical Organization node regardless of which host served this page.
    about: { "@id": `${MARKETING_SITE_URL}/#organization` },
  };
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="bg-[#09081b] text-white">
        <BreadcrumbSchema items={[{ name: "Home", href: "/" }, { name: "Consultation", href: "/consultation" }]} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">Consultation</p>
          <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight sm:text-4xl">
            Book a strategy consultation
          </h1>
          <p className="mt-5 text-lg text-white/85">
            Talk with the team behind YPN USA, founded by {AUTHOR_NAME}, about claiming an exclusive ZIP
            territory, putting an AI assistant on your site, and owning your mortgage pipeline.
          </p>

          <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold">
            {BOOKING_URL ? (
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className={BUTTON_PRIMARY}>
                Pick a time
              </a>
            ) : (
              <OpenAssistantButton className={BUTTON_PRIMARY}>Book with the AI assistant</OpenAssistantButton>
            )}
            <a href={`tel:${BUSINESS_PHONE_E164}`} className={BUTTON_SECONDARY}>
              Call {BUSINESS_PHONE_DISPLAY}
            </a>
          </div>

          <h2 className="mt-14 text-2xl font-semibold">What we&apos;ll cover</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-white/80">
            <li>Whether your ZIP codes are still available for exclusive reservation</li>
            <li>How AI intake captures, qualifies, and nurtures borrowers for FHA, VA, conventional, DSCR, HELOC, refinance, and jumbo</li>
            <li>Which plan fits your volume — see <Link href="/pricing" className="text-violet-300 underline hover:text-violet-200">pricing</Link></li>
            <li>How your leads and website stay with you if you change brokerages</li>
          </ul>

          <p className="mt-10 text-sm text-white/60">
            Prefer email? Write to{" "}
            <a href={`mailto:${BUSINESS_EMAIL}`} className="underline hover:text-white">{BUSINESS_EMAIL}</a>.
            A consultation is a business conversation about YPN USA marketing technology. It is not a loan
            application, pre-approval, or commitment to lend.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
