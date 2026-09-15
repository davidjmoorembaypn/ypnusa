import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MloComplianceFooter } from "@/components/silo/mlo-compliance-footer";

export const metadata: Metadata = {
  title: { default: "Mortgage Loans", template: "%s · Mortgage Loans · YPN USA" },
};

export default function MortgageLoansLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#09081b] text-white">{children}</main>
      <MloComplianceFooter />
      <SiteFooter />
    </>
  );
}
