import { YpnEmbedIntake } from "@/components/loanpilot-floating-assistant";

export default function EmbedIntakePage() {
  return (
    <main
      aria-label="YPN borrower intake embed"
      className="flex min-h-[720px] flex-col items-center overflow-x-hidden bg-[#f6fbff] px-2 py-3 md:min-h-[min(100dvh,900px)] md:px-4 md:py-6"
    >
      <div className="flex w-full flex-1 justify-center md:items-start">
        <YpnEmbedIntake />
      </div>
      <p className="mt-2 max-w-lg text-center text-[10px] leading-4 text-slate-500">
        NMLS #787257 · Equal Housing Opportunity · Marketing technology only — not a commitment to
        lend.
      </p>
    </main>
  );
}
