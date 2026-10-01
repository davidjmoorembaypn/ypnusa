"use client";

import { FormEvent, useState } from "react";

type Tool = "gbp" | "social";

export function MarketingToolForm({ tool }: { tool: Tool }) {
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setOutput("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const response = await fetch("/api/tools/marketing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, tool }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed.");
      setOutput(data.output);
    } catch (e) { setError(e instanceof Error ? e.message : "Generation failed."); }
    finally { setBusy(false); }
  }

  const inputClass = "mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-violet-400";
  return <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
    <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-white/70">Profession<select name="profession" className={inputClass} defaultValue="mortgage"><option className="text-black" value="mortgage">Mortgage professional</option><option className="text-black" value="real_estate">Real estate professional</option></select></label>
        <label className="text-sm text-white/70">Business name<input required name="businessName" maxLength={120} className={inputClass} placeholder="Your business or brand" /></label>
        <label className="text-sm text-white/70">Market<input required name="market" maxLength={120} className={inputClass} placeholder="Fresno, CA" /></label>
        <label className="text-sm text-white/70">Services<input required name="services" maxLength={600} className={inputClass} placeholder="Purchase loans, FHA, VA..." /></label>
      </div>
      {tool === "gbp" ? <label className="mt-4 block text-sm text-white/70">Current profile notes<textarea name="currentProfile" maxLength={1800} rows={5} className={inputClass} placeholder="Paste your current description, categories, services, or profile notes." /></label> :
      <><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm text-white/70">Audience<input name="audience" maxLength={300} className={inputClass} placeholder="First-time buyers, Realtors..." /></label><label className="text-sm text-white/70">Platform<input name="platform" maxLength={80} className={inputClass} placeholder="Instagram, LinkedIn..." /></label></div><label className="mt-4 block text-sm text-white/70">Topic or offer<textarea name="topic" maxLength={300} rows={3} className={inputClass} placeholder="What should this campaign talk about?" /></label></>}
      <button disabled={busy} className="mt-5 w-full rounded-xl bg-violet-500 px-5 py-3.5 font-bold text-white transition hover:bg-violet-400 disabled:opacity-60">{busy ? "Generating…" : tool === "gbp" ? "Run GBP Optimizer" : "Write My Social Campaign"}</button>
      <p className="mt-3 text-xs leading-5 text-white/40">AI-generated draft. Review facts, licensing, advertising and compliance requirements before publishing.</p>
    </form>
    <section aria-live="polite" className="min-h-[28rem] rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Your output</p>
      {error && <p className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{error}</p>}
      {output ? <pre className="mt-5 whitespace-pre-wrap font-sans text-sm leading-7 text-white/80">{output}</pre> : <p className="mt-5 text-sm leading-7 text-white/45">{tool === "gbp" ? "Your readiness score, profile copy, Google Post ideas and local SEO actions will appear here." : "Your post drafts, hooks, CTAs and follow-up ideas will appear here."}</p>}
    </section>
  </div>;
}
