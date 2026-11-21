"use client";

import type { ReactNode } from "react";
import { track } from "@/lib/track";

/** An in-page or plain link that records which home page call to action was used. */
export function TrackedAnchor({ href, cta, className, children }: { href: string; cta: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} className={className} onClick={() => track("home_cta_click", { cta, link_url: href })}>
      {children}
    </a>
  );
}
