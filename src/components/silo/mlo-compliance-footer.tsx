import Link from "next/link";

/**
 * NMLS disclosure for the /mortgage-loans silo. Mirrors the language on
 * /licensing-disclosures. Each subscriber (loan officer) publishing under
 * this silo carries their own NMLS ID and state licensing on their own
 * site/pages; this disclosure covers the platform (YPN Inc.) itself.
 */
export function MloComplianceFooter() {
  return (
    <div className="border-t border-white/10 bg-[#050414] px-6 py-6 text-center text-[11px] leading-5 text-white/40">
      <p className="mx-auto max-w-3xl">
        YPN USA (app.ypnus.com) is marketing technology used by licensed loan officers. It is not a
        lender, and nothing on this page is an offer of credit, a rate quote, or a commitment to
        lend. Each publishing loan officer&apos;s NMLS ID and state licensing appear on their own
        site. Equal Housing Opportunity. See{" "}
        <Link href="/licensing-disclosures" className="underline hover:text-white/70">
          Licensing &amp; Disclosures
        </Link>{" "}
        for the current NMLS record.
      </p>
    </div>
  );
}
