import Link from "next/link";
import { appUrl } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#09081b] text-white/70">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 md:grid-cols-4">
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
            The mortgage growth platform for loan officers: exclusive ZIP territories, AI borrower
            intake, and leads you own for life. Also at{" "}
            <a href={appUrl("/")} className="underline hover:text-white">
              app.ypnus.com
            </a>
            .
          </p>
          <p className="mt-4 max-w-sm text-xs text-white/50">
            Founded by David J. Moore, MBA (Cal State Fresno) — former top-producing loan officer
            at Chase Bank and Wells Fargo Home Mortgage, Amazon-published real estate author, and
            nationwide speaker.{" "}
            <a
              href="https://orcid.org/0009-0008-8069-8897"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              ORCID
            </a>{" "}
            ·{" "}
            <a
              href="https://www.linkedin.com/in/davidjmoorembaypninc/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              LinkedIn
            </a>{" "}
            ·{" "}
            <a
              href="https://www.facebook.com/DavidjMooreMBA/about/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              Facebook
            </a>
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Product</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/features" className="transition hover:text-white">Features</Link></li>
            <li><Link href="/#how" className="transition hover:text-white">How it works</Link></li>
            <li><Link href="/#territories" className="transition hover:text-white">Territories</Link></li>
            <li><Link href="/#demo" className="transition hover:text-white">Live demo</Link></li>
            <li><Link href="/analytics" className="transition hover:text-white">Analytics</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Resources</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/pricing" className="transition hover:text-white">Pricing</Link></li>
            <li><Link href="/blog" className="transition hover:text-white">Blog</Link></li>
            <li><Link href="/signup?plan=free" className="transition hover:text-white">Free LO signup</Link></li>
            <li><Link href="/embed/intake" className="transition hover:text-white">Embed the assistant</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-5 text-xs text-white/50">
          <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} YPN Inc. / YPN USA. All rights reserved.</p>
            <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link href="/privacy-policy" className="underline transition hover:text-white">
                Privacy Policy
              </Link>
              <Link href="/terms-of-service" className="underline transition hover:text-white">
                Terms of Service
              </Link>
              <Link href="/licensing-disclosures" className="underline transition hover:text-white">
                Licensing &amp; Disclosures
              </Link>
              <Link href="/accessibility-statement" className="underline transition hover:text-white">
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
              className="underline transition hover:text-white"
            >
              NMLS Consumer Access
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
