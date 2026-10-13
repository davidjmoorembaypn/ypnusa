"use client";

import { useEffect, useState } from "react";

export function AgenticAssistant() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const res = await fetch("/api/agentic/access");
        if (!mounted) return;
        if (res.ok) {
          const json = await res.json();
          setAllowed(Boolean(json?.allowed));
        } else setAllowed(false);
      } catch {
        if (mounted) setAllowed(false);
      }
    }
    check();
    return () => {
      mounted = false;
    };
  }, []);

  if (allowed === null) return <div className="p-4">Loading assistant…</div>;
  if (!allowed)
    return (
      <div className="rounded p-4 border bg-yellow-50 text-yellow-800">
        Agentic Assistant is available on Elite plans. <a href="/pricing" className="underline">See plans</a>.
      </div>
    );

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="font-semibold">Agentic Assistant</h3>
      <p className="mt-2 text-sm text-slate-700">Your task-oriented AI assistant for high-touch automation and campaign execution.</p>
      <div className="mt-4">{/* Chat UI placeholder — integrate your chat widget here */}</div>
    </div>
  );
}
