import type { Metadata } from "next";
import { SiloNav } from "@/components/silo-nav";
import Link from "next/link";
import { CopySnippet } from "@/components/copy-snippet";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { marketingMetadata } from "@/lib/seo";
import { getSiteOrigin } from "@/lib/request-host";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getSiteOrigin();
  return marketingMetadata({
    title: "Free Embeddable Tools for Loan Officers and Realtors",
    description:
      "Add a free home equity calculator and an AI borrower intake assistant to your own website. Copy-paste embed code, no coding needed.",
    path: "/embed",
    origin,
  });
}

const BREADCRUMB_ITEMS = [
  { name: "Home", href: "/" },
  { name: "Embeddable tools", href: "/embed" },
];

function snippet(origin: string, path: string, height: number, title: string, creditPath: string, credit: string) {
  return `<iframe src="${origin}${path}" title="${title}" width="100%" height="${height}" style="border:0;max-width:640px" loading="lazy"></iframe>
<p style="font-size:12px"><a href="${origin}${creditPath}">${credit}</a></p>`;
}

export default async function EmbedLandingPage() {
  const origin = await getSiteOrigin();
  const equity = snippet(origin, "/embed/equity", 820, "Home equity snapshot", "/tools/equity", "Home equity calculator by YPN USA");
  const intake = snippet(origin, "/embed/intake", 760, "Mortgage borrower intake assistant", "/ai-platform", "Mortgage lead assistant by YPN USA");

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Breadcrumbs items={BREADCRUMB_ITEMS} />
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">Free for your website</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Embeddable tools for loan officers and realtors
      </h1>
      <p className="mt-4 text-base leading-7 text-white/70">
        Give your visitors something useful to do on your own site. Copy one of the snippets below into
        your page (WordPress custom HTML block, Wix, Squarespace or any HTML page). Both tools are free.
        The small credit line under each widget links back to YPN USA, and we appreciate you keeping it.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Home Equity Snapshot</h2>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Visitors enter their home value and mortgage balance and see estimated equity and loan-to-value.
          Results are illustrative only.
        </p>
        <CopySnippet code={equity} label="Home equity snapshot" />
        <p className="mt-2 text-xs text-white/50">
          <Link href="/tools/equity" className="underline hover:text-white">
            See the full-page version
          </Link>
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">AI borrower intake assistant</h2>
        <p className="mt-2 text-sm leading-6 text-white/65">
          A chat assistant that answers common mortgage questions and collects a borrower&apos;s details for
          follow-up. It is informational only and does not make credit decisions.
        </p>
        <CopySnippet code={intake} label="AI intake assistant" />
      </section>

      <p className="mt-12 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-white/50">
        Licensed professionals remain responsible for their own advertising and disclosure compliance.
        See{" "}
        <Link href="/licensing-disclosures" className="underline hover:text-white">
          Licensing &amp; Disclosures
        </Link>
        . Equal Housing Opportunity.
      </p>

      <SiloNav silo="growth" currentPath="/embed" className="mt-10" />

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/pricing" className="text-violet-300 underline hover:text-violet-200">
          See plans
        </Link>
        <Link href="/mortgage-loans/tools" className="text-violet-300 underline hover:text-violet-200">
          More free tools
        </Link>
      </div>
    </div>
  );
}
