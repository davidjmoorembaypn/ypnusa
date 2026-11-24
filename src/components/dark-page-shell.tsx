import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/**
 * Site header, a dark main area and the footer, for pages whose content is styled
 * light-on-dark (text-white/70, violet-300). The root layout's body is white, so such a
 * page rendered on its own showed white text on white with no menu (found Nov 24 2026 on
 * /embed and the /self-employed-mortgage pages).
 */
export function DarkPageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1 bg-[#09081b] text-white">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
