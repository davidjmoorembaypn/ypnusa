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
      <p className="mt-3 max-w-md text-sm leading-6 text-white/70">
        The link may be outdated, or the page moved. Check whether your ZIP code is open, compare plans, or head back to the
        homepage.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/claim-territory"
          className="inline-flex min-h-[44px] items-center rounded-full bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
        >
          Check my ZIP code
        </Link>
        <Link
          href="/pricing"
          className="inline-flex min-h-[44px] items-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
        >
          See pricing
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
        >
          Back to YPN USA
        </Link>
      </div>
      <p className="mt-6 text-xs text-white/60">
        Already a member?{" "}
        <Link href="/dashboard" className="font-semibold text-white/80 underline underline-offset-4 hover:text-white">
          Go to your dashboard
        </Link>
      </p>
    </main>
  );
}
