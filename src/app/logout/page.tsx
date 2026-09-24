import type { Metadata } from "next";
import { LogoutButton } from "@/components/logout-button";

export const metadata: Metadata = {
  title: "Sign out",
  robots: { index: false, follow: false },
};

export default function LogoutPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16 text-slate-900">
      <h1 className="text-3xl font-semibold tracking-tight">Sign out of YPN USA?</h1>
      <p className="mt-4 text-sm leading-6 text-slate-600">You can sign back in any time with the same email address.</p>
      <LogoutButton className="mt-6 inline-flex items-center justify-center rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:opacity-60" />
    </main>
  );
}
