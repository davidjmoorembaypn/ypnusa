"use client";

import { useId, useState } from "react";

/**
 * FAQ accordion: each question is a real button with aria-expanded and aria-controls pointing at
 * its answer region. Answers stay in the HTML when collapsed (hidden, not removed), so the visible
 * questions and the FAQPage structured data always match.
 */
export function FaqAccordion({ items }: { items: ReadonlyArray<{ q: string; a: string }> }) {
  const baseId = useId();
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([0]));

  function toggle(index: number) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const expanded = open.has(index);
        const buttonId = `${baseId}-q-${index}`;
        const panelId = `${baseId}-a-${index}`;
        return (
          <div key={item.q} className="rounded-2xl border border-slate-200 bg-white">
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(index)}
                className="flex min-h-[56px] w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left text-base font-semibold text-slate-900"
              >
                <span>{item.q}</span>
                <span aria-hidden className={`shrink-0 text-xl leading-none text-violet-800 transition-transform ${expanded ? "rotate-45" : ""}`}>
                  +
                </span>
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!expanded} className="px-5 pb-5">
              <p className="text-sm leading-relaxed text-slate-800">{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
