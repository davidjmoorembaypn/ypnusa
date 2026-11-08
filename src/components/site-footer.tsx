import Link from "next/link";
import { PROGRAM_CONTENT } from "@/content/mortgage-programs";
import { PROGRAM_LIST } from "@/lib/programs";
import { LOCAL_SEO_PROFILES, getLocalSeoPath } from "@/lib/local-seo";
import { FREE_SIGNUP_HREF } from "@/lib/checkout";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#09081b] text-white/70">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 md:grid-cols-5">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-xs font-black text-white">
              Y
            </span>
            <span className="text-sm font-semibold text-white">
              YPN<span className="text-violet-300"> USA</span>
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm">
            The mortgage growth platform for loan officers: an exclusive ZIP code, local pages, and an AI
            assistant that answers, qualifies and follows up for you.
          </p>
          <p className="mt-4 max-w-sm text-xs text-white/70">
            Founded by David J. Moore, MBA (Fresno State) — 25+ years as a loan officer, 2,000+
            loans closed, formerly with Wells Fargo and JPMorgan Chase.{" "}
            <a
              href="https://orcid.org/0009-0008-8069-8897"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block py-1 underline hover:text-white"
            >
              ORCID
            </a>{" "}
            ·{" "}
            <a
              href="https://www.linkedin.com/in/davidjmoorembaypninc/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block py-1 underline hover:text-white"
            >
              LinkedIn
            </a>{" "}
            ·{" "}
            <a
              href="https://www.facebook.com/DavidjMooreMBA/about/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block py-1 underline hover:text-white"
            >
              Facebook
            </a>
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Product</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/features" className="transition hover:text-white">Features</Link></li>
            <li><Link href="/cerebro" className="transition hover:text-white">Cerebro AI assistant</Link></li>
            <li><Link href="/teams" className="transition hover:text-white">For teams</Link></li>
            <li><Link href="/roi" className="transition hover:text-white">ROI calculator</Link></li>
            <li><Link href="/claim-territory" className="transition hover:text-white">Claim your ZIP code</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Loan programs</p>
          <ul className="mt-4 space-y-2 text-sm">
            {PROGRAM_LIST.map((program) => (
              <li key={program}>
                <Link href={`/mortgage-loans/${program.toLowerCase()}`} className="transition hover:text-white">
                  {PROGRAM_CONTENT[program].label}
                </Link>
              </li>
            ))}
            {LOCAL_SEO_PROFILES.filter((profile) => profile.kind === "city").map((profile) => (
              <li key={profile.slug}>
                <Link href={getLocalSeoPath(profile)} className="transition hover:text-white">
                  Mortgage broker in {profile.city}, {profile.stateCode}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Resources</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/pricing" className="transition hover:text-white">Pricing</Link></li>
            <li><Link href="/loan-officers" className="transition hover:text-white">Loan officer markets</Link></li>
            <li><Link href="/loan-officers/visalia-ca" className="transition hover:text-white">Visalia loan officers</Link></li>
            <li><Link href="/blog" className="transition hover:text-white">Blog</Link></li>
            <li><Link href="/about" className="transition hover:text-white">About David</Link></li>
            <li><Link href="/book" className="transition hover:text-white">The book</Link></li>
            <li><Link href="/consultation" className="transition hover:text-white">Book a consultation</Link></li>
            <li><a href={FREE_SIGNUP_HREF} className="transition hover:text-white">Free LO signup</a></li>
            <li><Link href="/embed" className="transition hover:text-white">Free embeddable tools</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-5 text-xs text-white/70">
          <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} YPN Inc. / YPN USA. All rights reserved.</p>
            <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link href="/privacy-policy" className="inline-block py-2 underline transition hover:text-white">
                Privacy Policy
              </Link>
              <Link href="/terms-of-service" className="inline-block py-2 underline transition hover:text-white">
                Terms of Service
              </Link>
              <Link href="/licensing-disclosures" className="inline-block py-2 underline transition hover:text-white">
                Licensing &amp; Disclosures
              </Link>
              <Link href="/accessibility-statement" className="inline-block py-2 underline transition hover:text-white">
                Accessibility
              </Link>
            </nav>
          </div>
          <p>
            David J. Moore, MBA · NMLS #787257 · DRE #01852847 · Equal Housing Opportunity · Marketing
            technology only — not a commitment to lend. ·{" "}
            <a
              href="https://www.nmlsconsumeraccess.org/EntityDetails.aspx/individual/787257"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block py-2 underline transition hover:text-white"
            >
              NMLS Consumer Access
            </a>
          </p>
          <p>YPN Inc. · 247 N L Street, Dinuba, CA 93618</p>
        </div>
      </div>
    </footer>
  );
}
