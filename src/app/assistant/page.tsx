import type { Metadata } from "next";
import Link from "next/link";
import { AssistantPreviewTabs } from "@/components/assistant/assistant-preview-tabs";

export const metadata: Metadata = {
  title: "AI Assistant Preview",
  description:
    "Internal preview of the public-site, MLO-dashboard, and lead-qualification chat assistant modes.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AssistantPreviewPage() {
  return (
    <main className="min-h-screen bg-[#09081b] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <nav className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-sm font-black">
              Y
            </span>
            YPN <span className="-ml-1 text-violet-300">USA</span>
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10"
          >
            Back to home
          </Link>
        </nav>

        <header className="mx-auto max-w-3xl py-12 text-center sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
            Internal preview
          </p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            AI assistant, three modes
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/60 sm:text-lg">
            A live demo of the assistant that backs the public site, the MLO dashboard, and
            consumer lead qualification. Each tab below talks to the same{" "}
            <code className="text-white/80">/api/assistant/chat</code> route in a different mode —
            switch tabs to compare behavior side by side.
          </p>
        </header>

        <AssistantPreviewTabs />

        <footer className="mt-10 border-t border-white/10 py-8 text-center text-xs leading-5 text-white/35">
          Internal preview only — not indexed, not linked from the public marketing site.
        </footer>
      </div>
    </main>
  );
}
