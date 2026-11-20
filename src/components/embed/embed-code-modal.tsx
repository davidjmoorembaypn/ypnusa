"use client";

import { useId, useMemo, useRef, useState } from "react";
import { track } from "@/lib/track";
import { buildEmbedSnippet, sanitizeEmbedBranding } from "@/lib/embed-branding";

interface Props {
  origin: string;
  path: string;
  height: number;
  title: string;
  creditPath: string;
  creditText: string;
  /** Show the company / NMLS fields. Only for the calculator, which collects no borrower details. */
  allowBranding?: boolean;
}

const FIELD = "mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-violet-300 focus:ring-2";

/** "Copy Embed Code" button that opens a dialog with the snippet and, for the calculator, company / NMLS fields. */
export function EmbedCodeModal({ origin, path, height, title, creditPath, creditText, allowBranding = false }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const companyId = useId();
  const nmlsId = useId();
  const [company, setCompany] = useState("");
  const [nmls, setNmls] = useState("");
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  const code = useMemo(
    () => buildEmbedSnippet({ origin, path, height, title, creditPath, creditText, branding: allowBranding ? sanitizeEmbedBranding({ company, nmls }) : undefined }),
    [origin, path, height, title, creditPath, creditText, allowBranding, company, nmls],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied("done");
      track("embed_code_copied", { widget: title, branded: allowBranding && Boolean(company || nmls) });
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-[#09081b] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
      >
        Copy Embed Code
      </button>
      <dialog ref={dialog} aria-labelledby={headingId} className="w-[min(92vw,36rem)] rounded-2xl p-0 text-slate-900 backdrop:bg-black/60">
        <div className="p-6">
          <h3 id={headingId} className="text-lg font-semibold">
            Embed: {title}
          </h3>
          {allowBranding ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={companyId} className="block text-sm font-semibold">
                  Company name <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <input id={companyId} value={company} maxLength={60} onChange={(e) => setCompany(e.target.value)} className={FIELD} autoComplete="organization" />
              </div>
              <div>
                <label htmlFor={nmlsId} className="block text-sm font-semibold">
                  NMLS # <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <input id={nmlsId} value={nmls} inputMode="numeric" maxLength={10} onChange={(e) => setNmls(e.target.value.replace(/\D/g, ""))} className={FIELD} />
              </div>
              <p className="text-xs text-slate-600 sm:col-span-2">
                Shown in the widget footer as &ldquo;Provided by&rdquo;. Use only your own company name and NMLS number. You stay responsible for your advertising
                and disclosure compliance.
              </p>
            </div>
          ) : null}
          <textarea
            readOnly
            aria-label={`${title} embed code`}
            value={code}
            rows={6}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-4 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-800"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void copy()} className="min-h-[44px] rounded-full bg-[#13254a] px-5 py-2 text-sm font-bold text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
              {copied === "done" ? "Copied" : copied === "failed" ? "Select the code and copy it" : "Copy Embed Code"}
            </button>
            <button type="button" onClick={() => dialog.current?.close()} className="min-h-[44px] rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
              Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
