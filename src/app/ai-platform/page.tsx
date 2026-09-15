import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { AiPlatformEducationalOrganizationSchema } from "@/components/seo/silo-schema";
import { StubNotice } from "@/components/silo/stub-notice";

export const metadata: Metadata = {
  title: "Cerebro AI Assistant Workspace",
  description: "Workspace stub for the Cerebro AI assistant silo.",
  robots: { index: false, follow: true },
};

const BREADCRUMB_ITEMS = [
  { name: "Home", href: "/" },
  { name: "AI Platform", href: "/ai-platform" },
];

export default function AiPlatformPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Breadcrumbs items={BREADCRUMB_ITEMS} />
      <AiPlatformEducationalOrganizationSchema />

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
        Cerebro workspace
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Cerebro AI assistant workspace
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
        Entry point for the ai-platform content silo, covering the Cerebro assistant and
        MLO autopilot configuration.
      </p>
      <StubNotice>Workspace layout only &mdash; feature copy below is placeholder.</StubNotice>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        <li>
          <Link
            href="/ai-platform/autopilot"
            className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
          >
            <p className="text-sm font-semibold text-white">MLO autopilot</p>
            <p className="mt-1 text-xs text-white/50">Autopilot configuration route stub &rarr;</p>
          </Link>
        </li>
        <li>
          <Link
            href="/assistant"
            className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
          >
            <p className="text-sm font-semibold text-white">Assistant preview</p>
            <p className="mt-1 text-xs text-white/50">Live chat-assistant demo &rarr;</p>
          </Link>
        </li>
      </ul>

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/mortgage-loans" className="text-violet-300 underline hover:text-violet-200">
          Mortgage loans
        </Link>
        <Link href="/real-estate-leads" className="text-violet-300 underline hover:text-violet-200">
          Real estate leads
        </Link>
      </div>
    </div>
  );
}
