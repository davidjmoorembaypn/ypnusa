import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { StubNotice } from "@/components/silo/stub-notice";

export const metadata: Metadata = {
  title: "MLO Autopilot Config",
  description: "MLO autopilot configuration route stub for the ai-platform silo.",
  robots: { index: false, follow: true },
};

const BREADCRUMB_ITEMS = [
  { name: "Home", href: "/" },
  { name: "AI Platform", href: "/ai-platform" },
  { name: "Autopilot", href: "/ai-platform/autopilot" },
];

export default function AiPlatformAutopilotPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Breadcrumbs items={BREADCRUMB_ITEMS} />

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
        Autopilot config
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        MLO autopilot configuration
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
        Public entry point that will introduce autopilot configuration before handing off to the
        authenticated dashboard.
      </p>
      <StubNotice>
        Route reserved only &mdash; live configuration happens in the authenticated dashboard.
      </StubNotice>

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/ai-platform" className="text-violet-300 underline hover:text-violet-200">
          AI platform
        </Link>
        <Link href="/dashboard/autopilot" className="text-violet-300 underline hover:text-violet-200">
          Dashboard autopilot
        </Link>
      </div>
    </div>
  );
}
