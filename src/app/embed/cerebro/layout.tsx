import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Outfit } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "Arial"],
});

export const metadata: Metadata = {
  title: "Cerebro - YPN USA assistant (embed)",
  description: "Cerebro, the YPN USA AI assistant, in an iframe-friendly surface.",
  robots: { index: false, follow: false },
};

export default function EmbedCerebroLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${outfit.className} min-h-dvh bg-[#0A1628] text-white antialiased`}>{children}</div>
  );
}
