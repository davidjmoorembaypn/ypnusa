import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { SiloNav } from "@/components/silo-nav";
import { DarkPageShell } from "@/components/dark-page-shell";
import { TrackedLink } from "@/components/tracked-link";
import { HMDA_SOURCE_URL, REPORT_COUNTIES, type ReportCounty } from "@/content/market-report";
import {
  BANK_STATEMENT_CONTENT,
  BANK_STATEMENT_PATH,
  DSCR_PATH,
  SELF_EMPLOYED_HUB,
  SELF_EMPLOYED_HUB_PATH,
  countyDataSentence,
  countyFaqs,
  countyLoanFacts,
  countyShortAnswer,
  selfEmployedCountyPath,
  selfEmployedFunnelSource,
  selfEmployedIntakeHref,
  type SelfEmployedCountyAngle,
} from "@/content/self-employed-loans";
import { LOCAL_SEO_PROFILES, getLocalSeoPath } from "@/lib/local-seo";
import { faqJsonLd, jsonLdScript } from "@/lib/seo";
import { MARKETING_SITE_URL, marketingUrl } from "@/lib/site";

const HUB_CRUMB = { name: "Self-Employed & Investor Mortgages", href: SELF_EMPLOYED_HUB_PATH };

export function countyPageTitle(county: ReportCounty): string {
  return `Bank Statement and DSCR Loans in ${county.name}, ${county.stateCode}`;
}

function JsonLd({ value }: { value: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(value) }} />;
}

function webPageJsonLd({ path, name, description, county }: { path: string; name: string; description: string; county?: ReportCounty }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${marketingUrl(path)}#webpage`,
    url: marketingUrl(path),
    name,
    description,
    isPartOf: { "@id": `${MARKETING_SITE_URL}/#website` },
    publisher: { "@id": `${MARKETING_SITE_URL}/#organization` },
    inLanguage: "en-US",
    about: [
      { "@type": "Thing", name: "Bank statement loan", url: marketingUrl(BANK_STATEMENT_PATH) },
      { "@type": "Thing", name: "DSCR loan", url: marketingUrl(DSCR_PATH) },
    ],
    ...(county
      ? {
          spatialCoverage: {
            "@type": "AdministrativeArea",
            name: `${county.name}, California`,
            containedInPlace: { "@type": "State", name: "California" },
          },
        }
      : {}),
  };
}

function ShortAnswer({ text }: { text: string }) {
  return (
    <p className="mt-5 text-base leading-7 text-white/80">
      <strong className="text-white">Short answer:</strong> {text}
    </p>
  );
}

function ProgramCards() {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <Link href={BANK_STATEMENT_PATH} className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
        <p className="text-sm font-semibold text-white">Bank statement loan</p>
        <p className="mt-1.5 text-[13px] leading-5 text-white/65">
          For self-employed buyers. Income comes from 12 or 24 months of deposits. Can be used for the home you live in.
        </p>
      </Link>
      <Link href={DSCR_PATH} className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
        <p className="text-sm font-semibold text-white">DSCR loan</p>
        <p className="mt-1.5 text-[13px] leading-5 text-white/65">
          For rental property. The property qualifies on its rent compared with its monthly payment. Investment property only.
        </p>
      </Link>
    </div>
  );
}

function Faqs({ items }: { items: ReadonlyArray<{ q: string; a: string }> }) {
  return (
    <>
      <h2 className="mt-10 text-lg font-semibold text-white">Common questions</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <details key={item.q} className="group rounded-2xl border border-white/10 bg-white/5 p-4 [&_summary]:cursor-pointer">
            <summary className="text-sm font-semibold text-white marker:content-none">{item.q}</summary>
            <p className="mt-2 text-[13px] leading-5 text-white/65">{item.a}</p>
          </details>
        ))}
      </div>
    </>
  );
}

function Cta({ heading, intakeHref, source }: { heading: string; intakeHref: string; source: string }) {
  return (
    <section className="mt-12 rounded-3xl border border-violet-400/30 bg-violet-500/10 p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-white">{heading}</h2>
      <p className="mt-2 text-sm leading-6 text-white/70">
        Tell us how you earn your income, what you want to buy or refinance, and what you have saved. A licensed loan
        officer will follow up with the options that fit. There is no cost and no obligation.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <TrackedLink
          href={intakeHref}
          event="generate_lead_click"
          eventParams={{ source }}
          className="inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold text-[#17152f] transition hover:bg-violet-100"
        >
          Talk to a loan officer
        </TrackedLink>
        <TrackedLink
          href="/check-zip"
          event="pricing_click"
          eventParams={{ source }}
          className="inline-flex rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
        >
          Loan officer? Check your ZIP code
        </TrackedLink>
      </div>
    </section>
  );
}

function Disclaimer() {
  return (
    <p className="mt-10 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-white/65">
      Educational overview only. Nothing on this page is a rate quote, a payment estimate, an eligibility determination,
      or a commitment to lend, and it is not legal or tax advice. Bank statement and DSCR loans are offered by third-party
      lenders whose guidelines change. See{" "}
      <Link href="/licensing-disclosures" className="underline hover:text-white">
        Licensing &amp; Disclosures
      </Link>{" "}
      for current licensing. Equal Housing Opportunity.
    </p>
  );
}

export function SelfEmployedHubPage() {
  const path = SELF_EMPLOYED_HUB_PATH;
  const crumbs = [{ name: "Home", href: "/" }, { name: "Mortgage Loans", href: "/mortgage-loans" }, HUB_CRUMB];
  return (
    <DarkPageShell>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <JsonLd value={webPageJsonLd({ path, name: SELF_EMPLOYED_HUB.title, description: SELF_EMPLOYED_HUB.description })} />
        <JsonLd value={faqJsonLd(SELF_EMPLOYED_HUB.faqs)} />
        <Breadcrumbs items={crumbs} />

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">Self-employed &amp; investors</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{SELF_EMPLOYED_HUB.title}</h1>
        <ShortAnswer text={SELF_EMPLOYED_HUB.shortAnswer} />

        <h2 className="mt-10 text-lg font-semibold text-white">Two ways to qualify without tax returns</h2>
        <ProgramCards />

        <h2 className="mt-10 text-lg font-semibold text-white">Who these loans are for</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-white/70">
          {BANK_STATEMENT_CONTENT.idealFor.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="text-violet-300">&bull;</span>
              {item}
            </li>
          ))}
          <li className="flex gap-2">
            <span aria-hidden className="text-violet-300">&bull;</span>
            Investors buying or refinancing rental property
          </li>
        </ul>

        <h2 className="mt-10 text-lg font-semibold text-white">Central Valley counties</h2>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Each county page covers who uses these loans locally and the county&apos;s latest public home lending numbers.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {REPORT_COUNTIES.map((county) => {
            const facts = countyLoanFacts(county);
            return (
              <li key={county.slug}>
                <Link href={selfEmployedCountyPath(county)} className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
                  <p className="text-sm font-semibold text-white">{county.name}</p>
                  <p className="mt-1 text-xs text-white/55">
                    {county.cities.slice(0, 3).join(", ")} · {facts.total.toLocaleString("en-US")} home loans in {facts.year}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>

        <Faqs items={SELF_EMPLOYED_HUB.faqs} />
        <Cta heading="Self-employed or investing? Talk it through with a licensed loan officer" intakeHref={selfEmployedIntakeHref()} source={selfEmployedFunnelSource()} />
        <SiloNav silo="mortgage" currentPath={path} className="mt-10" />
        <Disclaimer />
      </div>
    </DarkPageShell>
  );
}

export function SelfEmployedCountyPage({ county, angle }: { county: ReportCounty; angle: SelfEmployedCountyAngle }) {
  const path = selfEmployedCountyPath(county);
  const title = countyPageTitle(county);
  const shortAnswer = countyShortAnswer(county);
  const faqs = countyFaqs(county);
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Mortgage Loans", href: "/mortgage-loans" },
    HUB_CRUMB,
    { name: county.name, href: path },
  ];
  const localPages = LOCAL_SEO_PROFILES.filter((profile) => profile.county === county.name);
  const otherCounties = REPORT_COUNTIES.filter((c) => c.slug !== county.slug);

  return (
    <DarkPageShell>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <JsonLd value={webPageJsonLd({ path, name: title, description: shortAnswer, county })} />
        <JsonLd value={faqJsonLd(faqs)} />
        <Breadcrumbs items={crumbs} />

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
          Central Valley · {county.name}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <ShortAnswer text={shortAnswer} />

        <h2 className="mt-10 text-lg font-semibold text-white">Who uses these loans in {county.name}</h2>
        <p className="mt-3 text-sm leading-7 text-white/70">{angle.borrowers}</p>
        <p className="mt-3 text-sm leading-7 text-white/70">{angle.investors}</p>

        <h2 className="mt-10 text-lg font-semibold text-white">Bank statement loan or DSCR loan?</h2>
        <ProgramCards />

        <h2 className="mt-10 text-lg font-semibold text-white">{county.name} home lending by the numbers</h2>
        <p className="mt-3 text-sm leading-7 text-white/70">{countyDataSentence(county)}</p>
        <p className="mt-2 text-xs leading-5 text-white/50">
          Source:{" "}
          <a href={HMDA_SOURCE_URL} className="underline hover:text-white" rel="noopener">
            CFPB / FFIEC HMDA data
          </a>
          , originated loans. HMDA does not identify bank statement or DSCR loans separately.{" "}
          <Link href={`/research/${county.slug}`} className="underline hover:text-white">
            Full {county.name} market report
          </Link>
          .
        </p>

        <h2 className="mt-10 text-lg font-semibold text-white">What to have ready</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-white/70">
          {[
            "12 or 24 months of personal or business bank statements",
            "Proof the business exists, such as a business license or a letter from your CPA or tax preparer",
            "Statements showing your down payment and cash reserves",
            "For a rental: the lease, or the address so the appraiser can estimate market rent",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="text-violet-300">&bull;</span>
              {item}
            </li>
          ))}
        </ul>

        <Faqs items={faqs} />
        <Cta
          heading={`Talk to a licensed loan officer about ${county.name}`}
          intakeHref={selfEmployedIntakeHref(county)}
          source={selfEmployedFunnelSource(county)}
        />

        <nav aria-label="Related pages" className="mt-10">
          <h2 className="text-lg font-semibold text-white">Related</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {localPages.map((profile) => (
              <li key={`${profile.kind}-${profile.slug}`}>
                <Link href={getLocalSeoPath(profile)} className="text-violet-300 underline hover:text-violet-200">
                  {profile.kind === "city"
                    ? `Mortgage broker in ${profile.city}, ${profile.stateCode}`
                    : `${profile.city} mortgage help in ZIP code ${profile.slug}`}
                </Link>
              </li>
            ))}
            <li>
              <Link href={SELF_EMPLOYED_HUB_PATH} className="text-violet-300 underline hover:text-violet-200">
                All Central Valley counties
              </Link>
            </li>
            {otherCounties.map((c) => (
              <li key={c.slug}>
                <Link href={selfEmployedCountyPath(c)} className="text-violet-300 underline hover:text-violet-200">
                  {countyPageTitle(c)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <SiloNav silo="mortgage" currentPath={path} className="mt-10" />
        <Disclaimer />
      </div>
    </DarkPageShell>
  );
}
