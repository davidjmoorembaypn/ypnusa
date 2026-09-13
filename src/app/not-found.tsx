import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#09081b] px-6 py-16 text-center text-white">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-2xl font-black">
        Y
      </div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
        404
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        This page doesn&apos;t exist.
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-white/60">
        The link may be outdated, or the page moved. Head back to the app, or check the
        ZIP territory tool.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
        >
          Back to YPN USA
        </Link>
        <Link
          href="/dashboard"
          className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
