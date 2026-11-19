import { EquitySnapshot } from "@/components/equity-snapshot";
import { EmbedAttribution } from "@/components/embed/embed-attribution";
import { sanitizeEmbedBranding } from "@/lib/embed-branding";

export default async function EmbedEquityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // ?company= and ?nmls= come from the embedder's snippet: untrusted, validated, shown as text only.
  const { company, nmls } = await searchParams;
  const branding = sanitizeEmbedBranding({ company, nmls });
  return (
    <main aria-label="Home equity snapshot embed" className="mx-auto w-full max-w-xl px-3 py-4">
      <EquitySnapshot />
      <p className="mt-3 text-center text-[10px] leading-4 text-white/50">
        Illustrative estimate from values you enter. Not an appraisal, rate quote or commitment to lend.
        NMLS #787257 · Equal Housing Opportunity.
      </p>
      <EmbedAttribution tone="dark" branding={branding} />
    </main>
  );
}
