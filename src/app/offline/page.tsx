import type { Metadata } from "next";

/**
 * Shown by the service worker (public/sw.js) when the phone app is opened without a
 * connection. Static and generic on purpose: it never holds lead or borrower details.
 */
export const metadata: Metadata = {
  title: "You're offline",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09081b] px-6 text-center text-white">
      <div className="max-w-sm">
        <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
        <p className="mt-3 text-base leading-7 text-white/70">
          YPN USA needs a connection to show your leads. Check your signal or Wi-Fi, then try again.
        </p>
        {/* A full page load on purpose: it retries the network instead of a client-side hop. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/dashboard"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-violet-600 px-6 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Try again
        </a>
      </div>
    </main>
  );
}
