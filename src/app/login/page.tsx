import type { Metadata } from "next";
import Link from "next/link";
import { DevLoginForm } from "@/components/dev-login-form";
import { EmailLoginForm } from "@/components/email-login-form";
import { safeNextPath } from "@/lib/email-login";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const ERROR_MESSAGES: Record<string, string> = {
  expired: "That sign-in link expired. Enter your email for a fresh one.",
  used: "That sign-in link was already used. Enter your email for a fresh one.",
  invalid: "That sign-in link isn't valid. Enter your email for a fresh one.",
  failed: "We couldn't sign you in just now. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(Array.isArray(params.next) ? params.next[0] : params.next);
  const errorKey = Array.isArray(params.error) ? params.error[0] : params.error;
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] : undefined;

  const isSignup = next === "/onboarding";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16 text-slate-900">
      <Link href="/" className="text-sm font-semibold text-[#13254a] hover:underline">&larr; YPN USA home</Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">
        {isSignup ? "Free account" : "Sign in"}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#13254a]">
        {isSignup ? "Create your free account" : "Sign in to YPN USA"}
      </h1>
      <p className="mt-4 text-sm leading-6 text-slate-600">
        Enter your email and we&apos;ll send you a one-time sign-in link. If you&apos;re new, the same link creates
        your free account.
      </p>
      {isSignup && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-semibold">The Free plan does not lock your ZIP code.</p>
          <p className="mt-1">
            Another loan officer can claim it at any time. To keep your ZIP code exclusive,{" "}
            <Link href="/pricing" className="font-semibold underline">
              start a paid plan
            </Link>{" "}
            (15-day free trial, from $99/mo).
          </p>
        </div>
      )}
      {errorMessage && (
        <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {errorMessage}
        </p>
      )}
      <EmailLoginForm next={next} />
      <p className="mt-6 text-sm leading-6 text-slate-600">
        Trouble signing in?{" "}
        <a href="mailto:support@ypnus.com" className="font-medium text-[#13254a] underline">
          Contact support
        </a>
        .
      </p>

      {process.env.NODE_ENV !== "production" && <DevLoginForm next={next} />}
    </main>
  );
}
