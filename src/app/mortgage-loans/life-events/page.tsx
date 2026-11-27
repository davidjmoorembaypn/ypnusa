import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { SiloNav } from "@/components/silo-nav";
import { LIFE_EVENT_GUIDES, LIFE_EVENT_HUB_PATH, LIFE_EVENT_INTAKE_HREF, lifeEventGuidePath } from "@/content/life-event-mortgages";
import { marketingMetadata } from "@/lib/seo";

const TITLE = "Mortgages for Life Changes";
const DESCRIPTION =
  "Plain-language mortgage guides for divorce, an inherited home, marriage, a growing family, a job move and retirement, with links to the program rules.";

export const metadata: Metadata = {
  ...marketingMetadata({ title: `${TITLE} | YPN USA`, description: DESCRIPTION, path: LIFE_EVENT_HUB_PATH, absoluteTitle: true }),
  robots: { index: true, follow: true },
};

const BREADCRUMB_ITEMS = [
  { name: "Home", href: "/" },
  { name: "Mortgage Loans", href: "/mortgage-loans" },
  { name: "Life events", href: LIFE_EVENT_HUB_PATH },
];

export default function LifeEventHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Breadcrumbs items={BREADCRUMB_ITEMS} />

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">Mortgage guides</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Mortgages for life changes</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
        Most people look for a mortgage because something in their life changed. Each guide below covers one of
        those changes: what lenders look at, which documents matter, and where the rule is written down.
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {LIFE_EVENT_GUIDES.map((guide) => (
          <li key={guide.slug}>
            <Link href={lifeEventGuidePath(guide)} className="block h-full rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
              <p className="text-sm font-semibold text-white">{guide.title}</p>
              <p className="mt-1 text-xs leading-5 text-white/60">{guide.description}</p>
            </Link>
          </li>
        ))}
      </ul>

      <SiloNav silo="mortgage" currentPath={LIFE_EVENT_HUB_PATH} className="mt-10" />

      <p className="mt-10 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-white/65">
        Educational overviews only, not legal or tax advice, a rate quote, or a commitment to lend. See{" "}
        <Link href="/licensing-disclosures" className="underline hover:text-white">Licensing &amp; Disclosures</Link>.
        Equal Housing Opportunity.
      </p>

      <p className="mt-8 text-sm">
        <Link href={LIFE_EVENT_INTAKE_HREF} className="text-violet-300 underline hover:text-violet-200">Talk to a licensed loan officer</Link>
      </p>
    </div>
  );
}
