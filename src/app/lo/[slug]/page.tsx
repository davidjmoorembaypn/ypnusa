import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { serializeJsonLd } from "@/lib/local-seo";
import {
  findPublicOfficerPage,
  formatUsPhone,
  officerIntakeHref,
  officerPagePath,
  officerPhotoUrl,
  usPhoneHref,
  type PublicOfficerPage,
} from "@/lib/officer-profile";
import { marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

/**
 * A paying loan officer's public borrower page, built from the live subscription ledger:
 * it 404s when the officer has no live paid plan holding a ZIP code (or no profile), and
 * its CTA opens the borrower intake prefilled with their ZIP code and tagged (?lo=) so the
 * lead routes to them.
 *
 * Rendered on demand and cached for 60 seconds (ISR: no paths at build time). Not
 * force-dynamic on purpose: under the root loading.tsx a dynamic page starts streaming
 * with a 200 before notFound()/permanentRedirect() run, so missing officers would not get
 * a real 404 and renamed slugs no real 308. The cost is that a cancelled plan can keep
 * its page up for at most a minute. Lead routing itself always re-checks the live plan.
 */
export const revalidate = 60;

export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

const NMLS_CONSUMER_ACCESS = "https://www.nmlsconsumeraccess.org/";

type Props = { params: Promise<{ slug: string }> };

function zipList(zips: string[]): string {
  if (zips.length <= 1) return zips[0] ?? "";
  return `${zips.slice(0, -1).join(", ")} and ${zips[zips.length - 1]}`;
}

function describe(page: PublicOfficerPage): string {
  const { fullName, company, nmlsId } = page.profile;
  const where = `${page.zips.length === 1 ? "ZIP code" : "ZIP codes"} ${zipList(page.zips)}`;
  return `${fullName}${company ? ` of ${company}` : ""}, mortgage loan officer (NMLS #${nmlsId}), serving borrowers in ${where} through YPN USA. Start a short mortgage request online.`;
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = findPublicOfficerPage(slug);
  // Thrown here (not only in the page) so the response carries a real 404/308 status:
  // metadata resolves before the root loading.tsx starts streaming the body.
  if (!page) notFound();
  if (slug !== page.slug) permanentRedirect(officerPagePath(page.slug));
  const base = marketingMetadata({
    title: `${page.profile.fullName}, Mortgage Loan Officer · NMLS #${page.profile.nmlsId}`,
    description: describe(page),
    path: officerPagePath(page.slug),
  });
  const photo = page.photo ? `${MARKETING_SITE_URL}${officerPhotoUrl(page.userId, page.photo)}` : null;
  return {
    ...base,
    robots: { index: true, follow: true },
    openGraph: {
      ...base.openGraph,
      type: "profile",
      ...(photo ? { images: [{ url: photo, alt: page.profile.fullName }] } : {}),
    },
  };
}

export default async function LoanOfficerPage({ params }: Props) {
  const { slug } = await params;
  const page = findPublicOfficerPage(slug);
  if (!page) notFound();
  // Old name or bare short id: send to the canonical slug.
  if (slug !== page.slug) permanentRedirect(officerPagePath(page.slug));

  const { fullName, company, nmlsId, phone } = page.profile;
  const url = `${MARKETING_SITE_URL}${officerPagePath(page.slug)}`;
  const photoPath = page.photo ? officerPhotoUrl(page.userId, page.photo) : null;
  const intakeHref = officerIntakeHref(page);
  const zipLabel = page.zips.length === 1 ? "ZIP code" : "ZIP codes";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${url}#person`,
        name: fullName,
        jobTitle: "Mortgage Loan Officer",
        url,
        telephone: `+1${phone}`,
        ...(photoPath ? { image: `${MARKETING_SITE_URL}${photoPath}` } : {}),
        identifier: { "@type": "PropertyValue", propertyID: "NMLS ID", value: nmlsId },
        ...(company ? { worksFor: { "@type": "Organization", name: company } } : {}),
      },
      {
        "@type": "FinancialService",
        "@id": `${url}#service`,
        name: company ? `${fullName}, ${company}` : `${fullName}, Mortgage Loan Officer`,
        url,
        telephone: `+1${phone}`,
        ...(photoPath ? { image: `${MARKETING_SITE_URL}${photoPath}` } : {}),
        employee: { "@id": `${url}#person` },
        areaServed: page.zips.map((zip) => ({
          "@type": "Place",
          name: `ZIP code ${zip}`,
          address: { "@type": "PostalAddress", postalCode: zip, addressCountry: "US" },
        })),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#f6f2e9] text-[#102239]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <header className="border-b border-[#d8d0c1] bg-[#fbf8f1] px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="text-base font-black tracking-[-0.03em] text-[#0b2038]">
            YPN <span className="font-medium">USA</span>
          </Link>
          <a href={usPhoneHref(phone)} className="text-sm font-semibold text-[#7a571b] underline-offset-4 hover:underline">
            {formatUsPhone(phone)}
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <section className="rounded-[28px] border border-[#d8d0c1] bg-[#fffdf8] p-6 shadow-[0_18px_55px_rgba(30,38,48,.08)] sm:p-10">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left">
            {photoPath ? (
              <Image
                src={photoPath}
                alt={`Headshot of ${fullName}`}
                width={144}
                height={144}
                unoptimized
                priority
                className="h-32 w-32 shrink-0 rounded-full border-4 border-white object-cover shadow-md sm:h-36 sm:w-36"
              />
            ) : (
              <div
                aria-hidden
                className="grid h-32 w-32 shrink-0 place-items-center rounded-full bg-[#102239] text-4xl font-semibold text-[#e6bb68] sm:h-36 sm:w-36"
              >
                {initials(fullName)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9a6b19]">Mortgage Loan Officer</p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">{fullName}</h1>
              {company ? <p className="mt-1 text-base text-[#536070]">{company}</p> : null}
              <p className="mt-3 text-sm text-[#536070]">
                NMLS #{nmlsId} ·{" "}
                <a
                  href={NMLS_CONSUMER_ACCESS}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#7a571b] underline underline-offset-4"
                >
                  Verify on NMLS Consumer Access
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={intakeHref}
              className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#aa7a24] px-7 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#93681c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e9d7b3]"
            >
              Start my mortgage request
            </Link>
            <a
              href={usPhoneHref(phone)}
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#cfc5b4] bg-white px-7 py-3 text-base font-bold text-[#102239] transition hover:border-[#9a6b19] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e9d7b3]"
            >
              Call {formatUsPhone(phone)}
            </a>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#647080]">
            The request takes a few quick questions and goes straight to {fullName}.
          </p>
        </section>

        <section aria-labelledby="zips-heading" className="mt-6 rounded-[24px] border border-[#d8d0c1] bg-white p-6 sm:p-8">
          <h2 id="zips-heading" className="text-lg font-semibold tracking-[-0.02em]">
            {zipLabel} served through YPN USA
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {page.zips.map((zip) => (
              <li key={zip} className="rounded-full border border-[#e4ddcf] bg-[#fbf8f1] px-4 py-1.5 text-sm font-semibold">
                {zip}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-6 text-[#536070]">
            Borrower requests that YPN USA receives for {page.zips.length === 1 ? "this ZIP code" : "these ZIP codes"} go to{" "}
            {fullName}. The ZIP code assignment is exclusive within YPN USA; loan officers and lenders outside YPN USA
            may also serve this area.
          </p>
        </section>

        <section aria-labelledby="how-heading" className="mt-6 rounded-[24px] border border-[#d8d0c1] bg-white p-6 sm:p-8">
          <h2 id="how-heading" className="text-lg font-semibold tracking-[-0.02em]">How it works</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-[#536070]">
            <li>
              <span className="font-bold text-[#102239]">1. Share your goal.</span> Purchase or refinance, the property
              ZIP code, timing and a credit range.
            </li>
            <li>
              <span className="font-bold text-[#102239]">2. {fullName} reviews it.</span> You decide whether
              you may be contacted by text and email.
            </li>
            <li>
              <span className="font-bold text-[#102239]">3. Talk through your options.</span> Book a time or call{" "}
              {formatUsPhone(phone)}.
            </li>
          </ol>
        </section>
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-10 text-center text-[11px] leading-5 text-[#647080]">
        <p>
          {fullName} · NMLS #{nmlsId}
          {company ? ` · ${company}` : ""} · Equal Housing Opportunity
        </p>
        <p className="mt-1">
          Page provided by YPN USA marketing technology only — not a commitment to lend. Loan approval, rates and terms
          depend on the lender&rsquo;s review of your application.
        </p>
        <p className="mt-2 space-x-3">
          <Link href="/privacy-policy" className="underline underline-offset-2">Privacy Policy</Link>
          <Link href="/licensing-disclosures" className="underline underline-offset-2">Licensing &amp; disclosures</Link>
        </p>
      </footer>
    </div>
  );
}
