import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cerebro (embed)",
  description: "Cerebro AI growth diagnostic in an iframe-friendly surface, embedded from ypnus.com.",
  robots: { index: false, follow: false },
};

/**
 * This is the surface the ypnus.com homepage's "Chat with Cerebro" launcher
 * iframes in (see the ypnus-cerebro-js inline script on the WordPress
 * homepage: it points an <iframe> at https://app.ypnus.com/embed/cerebro).
 * Keep this route's path stable — WordPress has it hardcoded, not driven by
 * an env var, so renaming this directory silently breaks that launcher again.
 */
export default function EmbedCerebroLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-0 bg-[#09081b] text-white antialiased">{children}</div>;
}
