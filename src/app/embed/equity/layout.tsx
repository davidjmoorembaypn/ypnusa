import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "YPN USA · Home Equity Snapshot (embed)",
  description: "Iframe-friendly Home Equity Snapshot from YPN USA.",
  robots: { index: false, follow: false },
};

export default function EmbedEquityLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-0 bg-[#09081b] text-white antialiased">{children}</div>;
}
