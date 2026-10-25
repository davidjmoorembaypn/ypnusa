import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BreadcrumbSchema } from "@/components/seo/breadcrumbs";
import { TerritoryClaim } from "@/components/territory-claim";
import { marketingMetadata } from "@/lib/seo";
import { getSiteOrigin } from "@/lib/request-host";
import claimTerritoryContent from "@/content/wp-import/claim-territory.json";

/**
 * Migrated from ypnus.com's WordPress /claim-territory page (see
 * src/content/wp-import/index.ts), with one deliberate change: the original
 * embedded a WPForms shortcode whose <form action="..."> only resolves
 * correctly when WordPress itself renders the page for a real visitor — the
 * export script fetched it via the REST API, which baked in that request's
 * URL instead of a submittable endpoint, so the form as exported is dead.
 * The surrounding hand-written copy is real and kept; the broken form block
 * is replaced with this app's own working <TerritoryClaim /> (already wired
 * to /api/territory/check and /api/demo-request).
 */
export async function generateMetadata(): Promise<Metadata> {
  const origin = await getSiteOrigin();
  return marketingMetadata({
    title: claimTerritoryContent.title,
    description: claimTerritoryContent.description,
    path: "/claim-territory",
    origin,
  });
}

export default function ClaimTerritoryPage() {
  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />
      <BreadcrumbSchema items={[{ name: "Home", href: "/" }, { name: "Claim Territory", href: "/claim-territory" }]} />
      <main id="main-content" className="flex-1">
        <section className="mx-auto w-full max-w-3xl px-5 py-16 md:py-20">
          <h1 className="text-3xl font-semibold leading-tight md:text-5xl">Claim your exclusive zip code</h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            One licensed loan officer per zip code. Tell us which zip code you want and we&rsquo;ll confirm
            availability and get you started. Free to start, no credit card.
          </p>
          <div className="mt-6 max-w-xl rounded-2xl border border-white/15 bg-white/[0.06] p-4 text-sm text-white/85">
            <p>
              <strong className="text-white">David Moore, MBA</strong> &middot; 25-year loan officer &middot; NMLS
              #787257
            </p>
            <p className="mt-1">
              Territory is first-come, first-served. Once your zip code is claimed, no other YPN USA loan officer
              can take it from you.
            </p>
          </div>
          <div className="mt-8">
            <TerritoryClaim source="claim_territory_page" />
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-white/85">
            <li>&#10003; No credit card</li>
            <li>&#10003; Cancel anytime</li>
            <li>&#10003; One loan officer per zip code</li>
          </ul>
          <div className="mt-12 max-w-xl">
            <h2 className="text-lg font-semibold">What happens after you submit</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-white/85">
              <li>We confirm your zip code is still open. Territory locks only after you are on a paid plan.</li>
              <li>You get a free borrower page and zip code access right away.</li>
              <li>Lock the zip code whenever you are ready by choosing Growth, Pro or Elite.</li>
            </ol>
          </div>
          <p className="mt-8 text-white/85">
            Haven&rsquo;t seen the numbers for your zip code yet?{" "}
            <Link href="/check-zip" className="font-semibold text-amber-300 underline underline-offset-4">
              Check your 60-day demand report free
            </Link>
            <br />
            Ready to lock your zip code today?{" "}
            <Link href="/pricing" className="font-semibold text-amber-300 underline underline-offset-4">
              See plans &amp; pricing
            </Link>
          </p>
          <p className="mt-10 max-w-2xl border-t border-white/15 pt-6 text-xs leading-6 text-white/75">
            YPN INC &middot; NMLS #787257 &middot; Equal Housing Opportunity &middot;{" "}
            <a
              href="https://www.nmlsconsumeraccess.org/EntityDetails.aspx/individual/787257"
              target="_blank"
              rel="noopener nofollow"
              className="underline"
            >
              NMLS Consumer Access
            </a>{" "}
            &middot; Not a commitment to lend. You remain responsible for RESPA, TCPA and state licensing
            compliance.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
