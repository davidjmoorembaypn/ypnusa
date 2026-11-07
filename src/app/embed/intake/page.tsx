import { YpnEmbedIntake } from "@/components/loanpilot-floating-assistant";
import { parseFunnelSourceParam } from "@/lib/local-seo";

export default async function EmbedIntakePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Borrower CTAs (e.g. local ZIP/city pages) tag their leads with ?funnelSource=.
  const { funnelSource } = await searchParams;
  return (
    <main
      aria-label="YPN borrower intake embed"
      className="flex min-h-[720px] flex-col items-center overflow-x-hidden bg-[#f6fbff] px-2 py-3 md:min-h-[min(100dvh,900px)] md:px-4 md:py-6"
    >
      <div className="flex w-full flex-1 justify-center md:items-start">
        <YpnEmbedIntake funnelSource={parseFunnelSourceParam(funnelSource)} />
      </div>
      <p className="mt-2 max-w-lg text-center text-[10px] leading-4 text-slate-500">
        NMLS #787257 · Equal Housing Opportunity · Marketing technology only — not a commitment to
        lend.
      </p>
    </main>
  );
}
