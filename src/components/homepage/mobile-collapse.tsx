"use client";

import { useId, useState, type ReactNode } from "react";
import { track } from "@/lib/track";

/**
 * Keeps a long block one tap away on phones and fully open from the md breakpoint up.
 * The content is always in the HTML (hidden with CSS only on small screens), so search engines
 * and larger screens see everything; only the phone layout gets shorter.
 */
export function MobileCollapse({
  label,
  name,
  children,
  className,
}: {
  /** Button text, e.g. "See everything Cerebro does". */
  label: string;
  /** Short id for analytics, e.g. "cerebro_features". */
  name: string;
  children: ReactNode;
  className?: string;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current);
          if (!open) track("home_section_expand", { section: name });
        }}
        className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-2xl border border-slate-400 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 md:hidden"
      >
        <span>{open ? "Hide" : label}</span>
        <span aria-hidden className={`text-xl leading-none text-violet-800 transition-transform ${open ? "rotate-45" : ""}`}>
          +
        </span>
      </button>
      <div id={panelId} className={`${open ? "mt-4 block" : "hidden"} md:mt-0 md:block`}>
        {children}
      </div>
    </div>
  );
}
