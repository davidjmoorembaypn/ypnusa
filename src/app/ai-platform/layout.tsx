import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: { default: "AI Platform", template: "%s · AI Platform · YPN USA" },
};

export default function AiPlatformLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#09081b] text-white">{children}</main>
      <div className="border-t border-white/10 bg-[#050414] px-6 py-6 text-center text-[11px] leading-5 text-white/40">
        <p className="mx-auto max-w-3xl">
          <strong className="text-white/60">Placeholder disclosure &mdash; not final.</strong> AI
          assistant output is informational only, not financial or legal advice, and is not a
          credit decision. All loan origination decisions are made by a licensed loan officer. See{" "}
          <Link href="/licensing-disclosures" className="underline hover:text-white/70">
            Licensing &amp; Disclosures
          </Link>
          .
        </p>
      </div>
      <SiteFooter />
    </>
  );
}
