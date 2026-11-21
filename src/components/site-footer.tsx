import Link from "next/link";
import { PROGRAM_CONTENT } from "@/content/mortgage-programs";
import { PROGRAM_LIST } from "@/lib/programs";
import { LOCAL_SEO_PROFILES, getLocalSeoPath } from "@/lib/local-seo";
import { FREE_SIGNUP_HREF } from "@/lib/checkout";
import { BUSINESS_ADDRESS_LINE, BUSINESS_NAME, BUSINESS_TELEPHONE_DISPLAY } from "@/lib/business-profile";
import { BUSINESS_PHONE_E164 } from "@/lib/author";

interface FooterLink {
  href: string;
  label: string;
  /** Shown first and in bold: the market we lead with. */
  featured?: boolean;
}

const PRODUCT: FooterLink[] = [
  { href: "/features", label: "Features" },
  { href: "/cerebro", label: "Cerebro AI" },
  { href: "/pricing", label: "Pricing" },
  { href: "/teams", label: "For Teams" },
  { href: "/roi", label: "ROI Calculator" },
  { href: "/claim-territory", label: "Claim ZIP" },
];

/** Loan programs only: FHA, VA, Conventional, DSCR, HELOC, Refinance, Jumbo. City pages live under Markets. */
const LOAN_PROGRAMS: FooterLink[] = PROGRAM_LIST.map((program) => ({
  href: `/mortgage-loans/${program.toLowerCase()}`,
  label: PROGRAM_CONTENT[program].label,
}));

const MARKETS: FooterLink[] = [
  { href: "/loan-officers/visalia-ca", label: "Visalia, CA", featured: true },
  ...LOCAL_SEO_PROFILES.filter((profile) => profile.kind === "city").map((profile) => ({
    href: getLocalSeoPath(profile),
    label: `${profile.city}, ${profile.stateCode}`,
  })),
  { href: "/markets", label: "Markets we cover" },
];

const COMPANY_LEGAL: FooterLink[] = [
  { href: "/about", label: "About David" },
  { href: "/book", label: "The Book" },
  { href: "/blog", label: "Blog" },
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/terms-of-service", label: "Terms" },
  { href: "/licensing-disclosures", label: "Licensing & Disclosures" },
  { href: "/accessibility-statement", label: "Accessibility" },
  { href: "/refund-policy", label: "Refunds" },
  { href: "/cancellation-policy", label: "Cancellations" },
  { href: "/editorial-policy", label: "Editorial Policy" },
];

/** Guides and tools that used to sit in a long "Resources" column, kept as one compact row so none is orphaned. */
const MORE: FooterLink[] = [
  { href: "/loan-officers", label: "Loan officer markets" },
  { href: "/research", label: "Market report" },
  { href: "/topics", label: "Guides by topic" },
  { href: "/loan-types", label: "Leads by loan type" },
  { href: "/self-employed-mortgage", label: "Self-employed and investor loans" },
  { href: "/topics/loan-officer-websites", label: "Loan officer websites" },
  { href: "/best-ai-assistants-for-loan-officers", label: "Best AI assistants" },
  { href: "/best-crm-for-loan-officers", label: "Best CRM" },
  { href: "/vs", label: "Compare platforms" },
  { href: "/mortgage-payment-calculator", label: "Payment calculator" },
  { href: "/embed", label: "Free embeddable tools" },
  { href: "/consultation", label: "Book a consultation" },
];

const SOCIAL: Array<{ href: string; label: string }> = [
  { href: "https://orcid.org/0009-0008-8069-8897", label: "ORCID" },
  { href: "https://www.linkedin.com/in/davidjmoorembaypninc/", label: "LinkedIn" },
  { href: "https://www.facebook.com/DavidjMooreMBA/about/", label: "Facebook" },
];

/**
 * Site footer: four labelled <nav> columns (Product, Loan Programs, Markets, Company & Legal),
 * one compact row of further guides, then the licensing line and business address.
 * `tone="light"` is the homepage's white footer; every other page keeps the dark one.
 */
export function SiteFooter({ tone = "dark" }: { tone?: "dark" | "light" } = {}) {
  const light = tone === "light";
  const c = light
    ? {
        footer: "border-slate-200 bg-slate-50 text-slate-700",
        strong: "text-slate-900",
        accent: "text-violet-700",
        heading: "text-slate-900",
        link: "hover:text-slate-950 hover:underline",
        rule: "border-slate-200",
      }
    : {
        footer: "border-white/10 bg-[#09081b] text-white/70",
        strong: "text-white",
        accent: "text-violet-300",
        heading: "text-white/70",
        link: "hover:text-white",
        rule: "border-white/10",
      };

  const column = (id: string, title: string, links: FooterLink[]) => (
    <nav aria-labelledby={id}>
      <h2 id={id} className={`text-xs font-semibold uppercase tracking-[0.2em] ${c.heading}`}>
        {title}
      </h2>
      <ul className="mt-4 space-y-1 text-sm">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`inline-block py-1 transition ${c.link} ${item.featured ? `font-semibold ${c.strong}` : ""}`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <footer className={`border-t ${c.footer}`}>
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2 md:gap-12">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-xs font-black text-white">
                Y
              </span>
              <span className={`text-sm font-semibold ${c.strong}`}>
                YPN<span className={c.accent}> USA</span>
              </span>
            </div>
            <p className="mt-4 max-w-md text-sm">
              The mortgage growth platform for loan officers: an exclusive ZIP code, local pages, and an AI
              assistant that answers, qualifies and follows up for you.
            </p>
          </div>
          <p className="max-w-md text-xs leading-5 md:pt-10">
            Founded by David J. Moore, MBA (Fresno State) — 25+ years as a loan officer, 2,000+
            loans closed, formerly with Wells Fargo and JPMorgan Chase.{" "}
            {SOCIAL.map((item, i) => (
              <span key={item.href}>
                {i > 0 ? " · " : null}
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-block py-1 underline ${light ? "hover:text-slate-950" : "hover:text-white"}`}
                >
                  {item.label}
                </a>
              </span>
            ))}
          </p>
        </div>

        <div className={`mt-10 grid grid-cols-2 gap-x-6 gap-y-10 border-t pt-10 md:grid-cols-4 ${c.rule}`}>
          {column("footer-product", "Product", PRODUCT)}
          {column("footer-loan-programs", "Loan Programs", LOAN_PROGRAMS)}
          {column("footer-markets", "Markets", MARKETS)}
          {column("footer-company-legal", "Company & Legal", COMPANY_LEGAL)}
        </div>

        <nav aria-label="More guides and tools" className={`mt-10 border-t pt-6 text-xs ${c.rule}`}>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {MORE.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={`inline-block py-1.5 transition ${c.link}`}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={FREE_SIGNUP_HREF} className={`inline-block py-1.5 transition ${c.link}`}>
                Free LO signup
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className={`border-t ${c.rule}`}>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 text-xs sm:px-6">
          <p>
            David J. Moore, MBA · NMLS #787257 · California DRE #01852847 · Equal Housing Opportunity · Marketing
            technology only — not a commitment to lend. ·{" "}
            <a
              href="https://www.nmlsconsumeraccess.org/EntityDetails.aspx/individual/787257"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-block py-2 underline transition ${light ? "hover:text-slate-950" : "hover:text-white"}`}
            >
              NMLS Consumer Access
            </a>
          </p>
          <p>
            {BUSINESS_NAME} · {BUSINESS_ADDRESS_LINE} ·{" "}
            <a
              href={`tel:${BUSINESS_PHONE_E164}`}
              className={`inline-block py-2 underline transition ${light ? "hover:text-slate-950" : "hover:text-white"}`}
            >
              {BUSINESS_TELEPHONE_DISPLAY}
            </a>
          </p>
          <p>© {new Date().getFullYear()} YPN Inc. / YPN USA. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
