"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function AgenticAssistantGate() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      try {
        const res = await fetch("/api/agentic/access", { cache: "no-store" });
        if (!mounted) return;

        if (!res.ok) {
          setAllowed(false);
          return;
        }

        const json = (await res.json()) as { allowed?: boolean };
        setAllowed(Boolean(json.allowed));
      } catch {
        if (mounted) setAllowed(false);
      }
    }

    checkAccess();

    return () => {
      mounted = false;
    };
  }, []);

  if (allowed === null) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        Loading assistant access…
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="rounded-3xl border border-violet-200 bg-violet-50 p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">
          Elite feature
        </div>
        <h3 className="mt-3 text-2xl font-semibold text-slate-900">Agentic Assistant</h3>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          This AI workflow is available on the Elite plan. It helps you automate borrower intake,
          campaign follow-up, and territory-driven lead routing.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="inline-flex rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white"
          >
            See Elite pricing
          </Link>
          <Link
            href="/features/marketing-companion"
            className="inline-flex rounded-full border border-violet-200 bg-white px-5 py-3 text-sm font-semibold text-violet-700"
          >
            Explore the feature
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-violet-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">Ready</div>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">Agentic Assistant</h3>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
          Elite enabled
        </span>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="text-sm text-slate-700">
          Your AI workflow is live. It can help with borrower qualification, campaign strategy,
          and smart follow-up sequencing.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        <button
          type="button"
          className="w-full rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white"
        >
          Launch assistant
        </button>
      </div>
    </div>
  );
}
