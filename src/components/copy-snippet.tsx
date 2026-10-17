"use client";

import { useState } from "react";
import { track } from "@/lib/track";

/** Read-only code box with a copy button. Falls back to manual selection if the clipboard is blocked. */
export function CopySnippet({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      track("embed_code_copied", { widget: label });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /** clipboard unavailable: the code is still selectable in the box below */
    }
  }

  return (
    <div className="mt-3">
      <textarea
        readOnly
        aria-label={`${label} embed code`}
        value={code}
        rows={6}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-xl border border-white/15 bg-black/40 p-3 font-mono text-xs leading-5 text-violet-100"
      />
      <button
        type="button"
        onClick={copy}
        className="mt-2 inline-flex rounded-full bg-white px-5 py-2 text-sm font-bold text-[#17152f] transition hover:bg-violet-100"
      >
        {copied ? "Copied" : "Copy code"}
      </button>
    </div>
  );
}
