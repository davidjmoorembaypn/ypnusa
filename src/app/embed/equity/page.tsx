import { EquitySnapshot } from "@/components/equity-snapshot";

export default function EmbedEquityPage() {
  return (
    <main aria-label="Home equity snapshot embed" className="mx-auto w-full max-w-xl px-3 py-4">
      <EquitySnapshot />
      <p className="mt-3 text-center text-[10px] leading-4 text-white/50">
        Illustrative estimate from values you enter. Not an appraisal, rate quote or commitment to lend.
        NMLS #787257 · Equal Housing Opportunity.
      </p>
    </main>
  );
}
