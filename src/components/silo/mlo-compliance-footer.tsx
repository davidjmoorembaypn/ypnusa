import Link from "next/link";

/**
 * Placeholder NMLS disclosure for the /mortgage-loans silo. Mirrors the
 * language on /licensing-disclosures but is intentionally marked as a
 * stand-in until each program stub carries reviewed, program-specific copy.
 */
export function MloComplianceFooter() {
  return (
    <div className="border-t border-white/10 bg-[#050414] px-6 py-6 text-center text-[11px] leading-5 text-white/40">
      <p className="mx-auto max-w-3xl">
        <strong className="text-white/60">Placeholder disclosure &mdash; not final.</strong> YPN
        USA (app.ypnus.com) is marketing technology used by licensed loan officers. It is not a
        lender, and nothing on this page is an offer of credit, a rate quote, or a commitment to
        lend. NMLS ID and state licensing to be confirmed per publishing loan officer. Equal
        Housing Opportunity. See{" "}
        <Link href="/licensing-disclosures" className="underline hover:text-white/70">
          Licensing &amp; Disclosures
        </Link>{" "}
        for the current NMLS record.
      </p>
    </div>
  );
}
