import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Confirm sign-in",
  robots: { index: false, follow: false },
};

/**
 * Landing page for the emailed link. Signing in takes one more tap on purpose: email
 * security scanners open links automatically, and a GET that signed people in would let
 * them burn the one-time token before the person ever clicks.
 */
export default async function VerifyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16 text-slate-900">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">Sign in</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#13254a]">Finish signing in to YPN USA</h1>
      {token ? (
        <form method="post" action="/api/auth/email-link/verify" className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full rounded-full bg-[#13254a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1c3566]"
          >
            Sign me in
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-slate-600">
          This sign-in link is missing its code. <Link href="/login" className="font-semibold underline">Request a new link</Link>.
        </p>
      )}
    </main>
  );
}
