import { VerifyEmailLogin } from "@/components/email-login-form";
export const metadata = { title: "Confirm sign-in", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function VerifyPage() {
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16 text-slate-900">
    <h1 className="text-3xl font-semibold">Confirm your sign-in</h1>
    <p className="mt-4 text-sm text-slate-600">Continue in the same browser where you requested your email link.</p>
    <VerifyEmailLogin />
  </main>;
}
