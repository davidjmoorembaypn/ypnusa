import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function LegalPageLayout({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string;
  lastUpdated: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="bg-[#09081b] text-white">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">Legal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-white/50">Last updated: {lastUpdated}</p>
          {intro ? <p className="mt-6 text-sm leading-7 text-white/70">{intro}</p> : null}
          <div
            className="mt-10 space-y-6 text-sm leading-7 text-white/70
              [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-white
              [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white
              [&_p]:leading-7
              [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5
              [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5
              [&_li]:leading-7
              [&_a]:text-violet-300 [&_a]:underline [&_a:hover]:text-violet-200
              [&_strong]:font-semibold [&_strong]:text-white/90"
          >
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
