import { YpnEmbedIntake } from "@/components/loanpilot-floating-assistant";
import { parseFunnelSourceParam } from "@/lib/local-seo";
import { findPublicOfficerPage, shortIdFromSlug } from "@/lib/officer-profile";

// Reads ?zip=/?lo= and the officer's live plan state on every request.
export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

/** ?zip= is offered to the borrower as a one-tap answer only when it is exactly 5 digits. */
function parseZipParam(value: string | string[] | undefined): string | undefined {
  const zip = firstParam(value);
  return zip && /^\d{5}$/.test(zip) ? zip : undefined;
}

/** ?lo= must look like an officer page slug ("jane-doe-1a2b3c4d"); the server re-checks it. */
function parseOfficerParam(value: string | string[] | undefined): string | undefined {
  const slug = firstParam(value)?.toLowerCase();
  return slug && shortIdFromSlug(slug) ? slug : undefined;
}

export default async function EmbedIntakePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Borrower CTAs tag their leads: local ZIP code pages pass ?funnelSource= and ?zip=,
  // loan officer pages (/lo/[slug]) also pass ?lo= so the lead routes to that officer.
  const { funnelSource, zip, lo } = await searchParams;
  const officerSlug = parseOfficerParam(lo);
  // When the borrower came from a live officer page, disclose that officer's NMLS ID.
  const officerPage = officerSlug ? findPublicOfficerPage(officerSlug) : null;
  const nmlsLine = officerPage
    ? `${officerPage.profile.fullName} · NMLS #${officerPage.profile.nmlsId}`
    : "NMLS #787257";
  return (
    <main
      aria-label="YPN borrower intake embed"
      className="flex min-h-[720px] flex-col items-center overflow-x-hidden bg-[#f6fbff] px-2 py-3 md:min-h-[min(100dvh,900px)] md:px-4 md:py-6"
    >
      <div className="flex w-full flex-1 justify-center md:items-start">
        <YpnEmbedIntake
          funnelSource={parseFunnelSourceParam(funnelSource)}
          prefillZip={parseZipParam(zip)}
          officerSlug={officerPage ? officerSlug : undefined}
        />
      </div>
      <p className="mt-2 max-w-lg text-center text-[10px] leading-4 text-slate-500">
        {nmlsLine} · Equal Housing Opportunity · Marketing technology only — not a commitment to
        lend.
      </p>
    </main>
  );
}
