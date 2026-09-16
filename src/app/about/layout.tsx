import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function AboutLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#09081b] text-white">{children}</main>
      <SiteFooter />
    </>
  );
}
