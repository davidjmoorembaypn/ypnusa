"use client";

import { useState } from "react";
import { track } from "@/lib/track";

/** A citation in a read-only box with a one-click copy button. Falls back to manual selection. */
export function CopyCitation({ label, text }: { label: string; text: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
      track("report_citation_copied", { format: label });
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-[#13254a]">{label}</p>
      <textarea
        readOnly
        aria-label={`${label} citation`}
        value={text}
        rows={3}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-800"
      />
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-2 min-h-[44px] rounded-full bg-[#13254a] px-5 py-2 text-sm font-bold text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        {state === "done" ? "Copied" : state === "failed" ? "Select the text and copy it" : "Copy citation"}
      </button>
    </div>
  );
}
