import Link from "next/link";
import type { Metadata } from "next";
import { SessionBar } from "@/components/session-bar";
import { CrmLinkConsole } from "@/components/portal/crm-link-console";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CRM link",
  robots: { index: false, follow: false },
};

export default async function CrmLinkPage() {
  await requireSession("/portal/crm");
  return (
    <main className="min-h-screen bg-[#09081b] px-4 py-8 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">CRM link</p>
            <h1 className="text-3xl font-semibold tracking-tight">Send your leads to your CRM</h1>
            <p className="max-w-2xl text-sm leading-6 text-white/60">
              Every new lead routed to you goes to your CRM in seconds, through Zapier or any webhook. Updates
              from your CRM come back without creating duplicate leads.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="w-fit rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Dashboard
            </Link>
            <SessionBar tone="dark" />
          </div>
        </header>
        <CrmLinkConsole />
      </div>
    </main>
  );
}
