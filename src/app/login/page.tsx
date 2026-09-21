import type { Metadata } from "next";
import { DevLoginForm } from "@/components/dev-login-form";
import { marketingUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const ALLOWED_NEXT_PREFIXES = ["/dashboard", "/portal", "/analytics", "/admin", "/onboarding"];

function resolveNext(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    if (ALLOWED_NEXT_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))) {
      return value;
    }
  }
  return "/dashboard";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const next = resolveNext(params.next);
  const signupHref = marketingUrl(`/lo-signup.html?plan=free&app_next=${encodeURIComponent(next)}`);
  const loginHref = marketingUrl(`/lo-dashboard.html?app_next=${encodeURIComponent(next)}`);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16 text-slate-900">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-700">Sign in</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Access your YPN USA dashboard</h1>
      <p className="mt-4 text-sm leading-6 text-slate-600">
        Already have an account? Sign in with the email address you used to join YPN USA.
        New here? Create a free account to get started.
      </p>
      <a
        href={loginHref}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-800"
      >
        Sign in to my account
      </a>
      <a href={signupHref} className="mt-3 inline-flex items-center justify-center rounded-full border border-violet-200 px-5 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50">
        Create a free account
      </a>
      <p className="mt-5 text-sm leading-6 text-slate-600">
        Trouble accessing your account? <a href="mailto:support@ypnus.com" className="font-medium text-violet-700 underline">Contact support</a>.
      </p>

      {process.env.NODE_ENV !== "production" && <DevLoginForm next={next} />}
    </main>
  );
}
