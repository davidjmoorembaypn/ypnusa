import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { StubNotice } from "@/components/silo/stub-notice";

export const metadata: Metadata = {
  title: "MLO Portal Tools",
  description: "Directory stub for loan-officer portal tools linked from the mortgage-loans silo.",
  robots: { index: false, follow: true },
};

const BREADCRUMB_ITEMS = [
  { name: "Home", href: "/" },
  { name: "Mortgage Loans", href: "/mortgage-loans" },
  { name: "Portal Tools", href: "/mortgage-loans/tools" },
];

const TOOLS = [
  {
    name: "Home equity snapshot",
    description: "Borrower-facing equity and LTV estimate tool.",
    href: "/tools/equity",
    status: "live" as const,
  },
  {
    name: "ZIP territories",
    description: "Manage exclusive ZIP-territory claims.",
    href: "/dashboard/territories",
    status: "live" as const,
  },
  {
    name: "Funnels",
    description: "Lead-capture funnel configuration.",
    href: "/dashboard/funnels",
    status: "live" as const,
  },
  {
    name: "Autopilot",
    description: "Automated nurture and outreach configuration.",
    href: "/dashboard/autopilot",
    status: "live" as const,
  },
];

export default function MloPortalToolsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Breadcrumbs items={BREADCRUMB_ITEMS} />

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
        Portal tools
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">MLO portal tools</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
        Stub layout for the tools directory linked from every mortgage-loans program page.
        Authenticated tools route through the existing loan-officer dashboard.
      </p>
      <StubNotice>Layout and links only &mdash; tool descriptions are placeholders.</StubNotice>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <li key={tool.href}>
            <Link
              href={tool.href}
              className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
            >
              <p className="text-sm font-semibold text-white">{tool.name}</p>
              <p className="mt-1 text-xs text-white/50">{tool.description}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/mortgage-loans" className="text-violet-300 underline hover:text-violet-200">
          All programs
        </Link>
        <Link href="/ai-platform" className="text-violet-300 underline hover:text-violet-200">
          AI platform
        </Link>
      </div>
    </div>
  );
}
