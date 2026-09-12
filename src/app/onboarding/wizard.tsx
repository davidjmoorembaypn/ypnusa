"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GOAL_COPY } from "@/lib/agent-onboarding";
import type { AgentOnboardingGoal, AgentOnboardingRecord } from "@/lib/types";
import type { PricingTierId } from "@/lib/pricing";

const STEPS = ["Profile", "Goal", "Connections", "Test", "Activate"] as const;
const CHANNELS = [
  ["email", "Email", "Send personalized acknowledgment and nurture messages"],
  ["sms", "SMS", "Use consented texts for time-sensitive follow-up"],
  ["calendar", "Calendar", "Offer booking times when a borrower is ready"],
  ["crm", "YPN CRM", "Record every decision, touch, and handoff"],
] as const;

type FormState = Pick<AgentOnboardingRecord, "goal" | "goalDescription" | "territoryZip" | "connections" | "autonomy" | "confidenceThreshold">;

const DEFAULT_STATE: FormState = {
  goal: "speed_to_lead",
  goalDescription: GOAL_COPY.speed_to_lead.description,
  territoryZip: "",
  connections: { email: true, sms: false, calendar: false, crm: true },
  autonomy: "approval_first",
  confidenceThreshold: 80,
};

export function OnboardingWizard({ email, initialProfile, tier, dailyLimit }: {
  email: string;
  initialProfile: AgentOnboardingRecord | null;
  tier: PricingTierId;
  dailyLimit: number;
}) {
  const [step, setStep] = useState(Math.min(5, Math.max(1, initialProfile?.completedStep ?? 1)));
  const [form, setForm] = useState<FormState>(initialProfile ?? DEFAULT_STATE);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [trace, setTrace] = useState<string[]>([]);
  const [testPassedAt, setTestPassedAt] = useState(initialProfile?.testPassedAt);
  const isPaid = dailyLimit > 0;
  const selectedGoal = GOAL_COPY[form.goal];

  const blueprint = useMemo(() => [
    ["TRIGGER", "New borrower inquiry", "A durable lead event starts the workflow."],
    ["DECIDE", form.goal === "speed_to_lead" ? "Fit, consent, urgency" : "Readiness and next best action", "Cerebro selects one structured action from the current lead state."],
    ["ACT", Object.entries(form.connections).filter(([, on]) => on).map(([name]) => name).join(" · ") || "Approval queue only", form.autonomy === "approval_first" ? "You approve external actions before they run." : "Approved action types can run inside your guardrails."],
    ["GUARDRAIL", `Escalate below ${form.confidenceThreshold}% confidence`, "Consent and tier policy are enforced before execution."],
    ["AUDIT", "Every action logged", "Decisions, results, retries, and human handoffs remain reviewable."],
  ], [form]);

  async function save(nextStep: number, action = "save") {
    setBusy(true); setNotice("");
    const response = await fetch("/api/onboarding", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, completedStep: nextStep, action, testPassedAt }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setNotice(typeof body?.error === "string" ? body.error : "Unable to save."); return false; }
    setStep(nextStep); return true;
  }

  async function runTest() {
    setBusy(true); setNotice(""); setTrace([]);
    const response = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "test" }) });
    const body = await response.json(); setBusy(false);
    if (!response.ok || !body.test?.passed) { setNotice("The safe test did not pass. Nothing was sent."); return; }
    const passedAt = new Date().toISOString();
    setTrace(body.test.trace); setTestPassedAt(passedAt); setNotice("Safe test passed. No email, SMS, or calendar event was sent.");
  }

  return (
    <main className="min-h-screen bg-[#f6f2e9] text-[#102239]">
      <header className="border-b border-[#d8d0c1] bg-[#fbf8f1]/95 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/dashboard" className="text-lg font-black tracking-[-0.03em] text-[#0b2038]">YPN <span className="font-medium">USA</span></Link>
          <div className="text-right"><p className="text-xs font-semibold text-[#0b2038]">{email}</p><p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6421]">{tier} plan</p></div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-7 md:py-10">
        <nav aria-label="Onboarding progress" className="grid grid-cols-5 border-b border-[#d8d0c1] pb-6">
          {STEPS.map((label, index) => {
            const number = index + 1; const done = number < step; const active = number === step;
            return <button key={label} onClick={() => number <= step && setStep(number)} className="group flex flex-col items-center gap-2 text-center" aria-current={active ? "step" : undefined}>
              <span className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-bold ${done ? "border-[#aa7a24] bg-[#aa7a24] text-white" : active ? "border-[#102239] bg-[#102239] text-white" : "border-[#cfc5b4] bg-[#fbf8f1] text-[#817968]"}`}>{done ? "✓" : number}</span>
              <span className={`hidden text-[11px] font-bold uppercase tracking-[0.12em] sm:block ${active ? "text-[#102239]" : "text-[#817968]"}`}>{label}</span>
            </button>;
          })}
        </nav>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.08fr_.92fr]">
          <section className="rounded-[28px] border border-[#d8d0c1] bg-[#fffdf8] p-6 shadow-[0_18px_55px_rgba(30,38,48,.08)] md:p-10">
            {step === 1 && <>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9a6b19]">Step 1 · Confirm your workspace</p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-[-0.045em] md:text-5xl">Give Cerebro a territory to work.</h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#536070]">Your ZIP anchors local context and routing. You can compare and claim territories later; onboarding only saves your working ZIP.</p>
              <details className="mt-7 overflow-hidden rounded-2xl border border-[#d8d0c1] bg-white">
                <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-[#102239] marker:hidden">
                  See how YPN USA and Cerebro work <span className="ml-2 font-medium text-[#9a6b19]">Optional video</span>
                </summary>
                <div className="border-t border-[#e4ddcf] p-3">
                  <div className="aspect-video overflow-hidden rounded-xl bg-[#102239]">
                    <iframe
                      className="h-full w-full"
                      src="https://www.youtube-nocookie.com/embed/MdwrE3LjLMA?rel=0"
                      title="YPN USA overview"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                  <p className="px-2 pb-1 pt-3 text-xs leading-5 text-[#647080]">Watch for context, then continue when you are ready. The video is never required to activate your agent.</p>
                </div>
              </details>
              <label className="mt-8 block text-sm font-bold" htmlFor="zip">Primary ZIP code</label>
              <input id="zip" inputMode="numeric" maxLength={5} value={form.territoryZip ?? ""} onChange={e => setForm({ ...form, territoryZip: e.target.value.replace(/\D/g, "").slice(0,5) })} placeholder="e.g. 78701" className="mt-2 w-full rounded-2xl border border-[#cfc5b4] bg-white px-4 py-4 text-lg outline-none focus:border-[#9a6b19] focus:ring-2 focus:ring-[#e9d7b3]" />
              <button disabled={busy || !/^\d{5}$/.test(form.territoryZip ?? "")} onClick={() => save(2)} className="mt-7 rounded-full bg-[#102239] px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Continue to goal</button>
            </>}

            {step === 2 && <>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9a6b19]">Step 2 · Set the mission</p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-[-0.045em] md:text-5xl">What should Cerebro own first?</h1>
              <p className="mt-5 text-base leading-7 text-[#536070]">Describe the outcome in plain language. Cerebro turns it into a governed agent plan—not a pile of settings.</p>
              <textarea value={form.goalDescription} onChange={e => setForm({ ...form, goalDescription: e.target.value })} rows={4} className="mt-7 w-full resize-none rounded-2xl border border-[#cfc5b4] bg-white p-4 text-base leading-7 outline-none focus:border-[#9a6b19] focus:ring-2 focus:ring-[#e9d7b3]" />
              <div className="mt-4 flex flex-wrap gap-2">{(Object.keys(GOAL_COPY) as AgentOnboardingGoal[]).map(goal => <button key={goal} onClick={() => setForm({ ...form, goal, goalDescription: GOAL_COPY[goal].description })} className={`rounded-full border px-4 py-2 text-xs font-bold ${form.goal === goal ? "border-[#aa7a24] bg-[#f4ead5] text-[#734c0b]" : "border-[#d8d0c1] bg-white text-[#536070]"}`}>{GOAL_COPY[goal].label}</button>)}</div>
              <div className="mt-7 flex gap-3"><button onClick={() => setStep(1)} className="rounded-full border border-[#cfc5b4] px-5 py-3 text-sm font-bold">Back</button><button disabled={busy || form.goalDescription.trim().length < 12} onClick={() => save(3)} className="rounded-full bg-[#102239] px-6 py-3 text-sm font-bold text-white disabled:opacity-40">Build my agent plan</button></div>
            </>}

            {step === 3 && <>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9a6b19]">Step 3 · Connections & authority</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em]">Choose where Cerebro may act.</h1>
              <p className="mt-4 text-[#536070]">These switches configure permission intent. Provider credentials are connected separately and are never stored here.</p>
              <div className="mt-7 space-y-3">{CHANNELS.map(([key,label,description]) => <label key={key} className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#d8d0c1] bg-white p-4"><span><span className="block font-bold">{label}</span><span className="mt-1 block text-sm text-[#647080]">{description}</span></span><input type="checkbox" checked={form.connections[key]} onChange={e => setForm({...form,connections:{...form.connections,[key]:e.target.checked}})} className="h-5 w-5 accent-[#aa7a24]" /></label>)}</div>
              <fieldset className="mt-7"><legend className="text-sm font-bold">Action policy</legend><div className="mt-2 grid gap-3 sm:grid-cols-2">{(["approval_first","autonomous_with_guardrails"] as const).map(mode => <button key={mode} onClick={() => setForm({...form,autonomy:mode})} className={`rounded-2xl border p-4 text-left ${form.autonomy===mode ? "border-[#aa7a24] bg-[#f4ead5]" : "border-[#d8d0c1] bg-white"}`}><span className="font-bold">{mode === "approval_first" ? "Approve first" : "Autonomous with guardrails"}</span><span className="mt-1 block text-xs leading-5 text-[#647080]">{mode === "approval_first" ? "External actions wait for you." : "Allowed actions run; uncertainty escalates."}</span></button>)}</div></fieldset>
              <label className="mt-6 block text-sm font-bold">Escalate below {form.confidenceThreshold}% confidence<input type="range" min="60" max="95" value={form.confidenceThreshold} onChange={e => setForm({...form,confidenceThreshold:Number(e.target.value)})} className="mt-3 block w-full accent-[#aa7a24]" /></label>
              <div className="mt-7 flex gap-3"><button onClick={() => setStep(2)} className="rounded-full border border-[#cfc5b4] px-5 py-3 text-sm font-bold">Back</button><button disabled={busy} onClick={() => save(4)} className="rounded-full bg-[#102239] px-6 py-3 text-sm font-bold text-white">Continue to safe test</button></div>
            </>}

            {step === 4 && <>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9a6b19]">Step 4 · Safe agent test</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em]">Watch Cerebro make one decision.</h1>
              <p className="mt-4 leading-7 text-[#536070]">A synthetic consented lead enters the real decision layer. Delivery adapters stay disabled, so nobody is contacted.</p>
              <button disabled={busy} onClick={runTest} className="mt-7 rounded-full bg-[#aa7a24] px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Running safe test…" : "Run safe agent test"}</button>
              {trace.length > 0 && <ol className="mt-7 space-y-3">{trace.map((item,index)=><li key={item} className="flex gap-3 rounded-2xl border border-[#d8d0c1] bg-white p-4"><span className="font-black text-[#aa7a24]">0{index+1}</span><span className="text-sm font-medium">{item}</span></li>)}</ol>}
              <div className="mt-7 flex gap-3"><button onClick={() => setStep(3)} className="rounded-full border border-[#cfc5b4] px-5 py-3 text-sm font-bold">Back</button><button disabled={!testPassedAt || busy} onClick={() => save(5)} className="rounded-full bg-[#102239] px-6 py-3 text-sm font-bold text-white disabled:opacity-40">Review activation</button></div>
            </>}

            {step === 5 && <>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9a6b19]">Step 5 · Activate</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em]">Your agent is ready for its first mission.</h1>
              <p className="mt-4 leading-7 text-[#536070]">Cerebro will follow the goal, channels, consent rules, and escalation threshold you approved.</p>
              <div className="mt-7 rounded-2xl border border-[#d8d0c1] bg-white p-5"><p className="text-sm font-bold">Plan capacity</p><p className="mt-2 text-3xl font-semibold">{Number.isFinite(dailyLimit) ? dailyLimit : "Unlimited"} <span className="text-sm font-medium text-[#647080]">agent actions / day</span></p></div>
              {!isPaid && <p className="mt-4 rounded-2xl border border-[#d6a94f] bg-[#fff6df] p-4 text-sm leading-6 text-[#6f4a0d]">Your safe test is complete. A paid plan is required before external automations can run.</p>}
              <div className="mt-7 flex flex-wrap gap-3"><button onClick={() => setStep(4)} className="rounded-full border border-[#cfc5b4] px-5 py-3 text-sm font-bold">Back</button>{isPaid ? <button disabled={busy} onClick={async()=>{if(await save(5,"activate")) setNotice("Cerebro is active. Your guardrails are now the operating policy.");}} className="rounded-full bg-[#aa7a24] px-6 py-3 text-sm font-bold text-white">Activate Cerebro</button> : <Link href="/dashboard?upgrade=starter" className="rounded-full bg-[#aa7a24] px-6 py-3 text-sm font-bold text-white">See agent plans</Link>}<Link href="/dashboard" className="rounded-full px-5 py-3 text-sm font-bold text-[#536070]">Return to dashboard</Link></div>
            </>}
            {notice && <p role="status" className="mt-5 text-sm font-semibold text-[#7a571b]">{notice}</p>}
          </section>

          <aside className="self-start rounded-[28px] bg-[#102239] p-6 text-white shadow-[0_18px_55px_rgba(16,34,57,.18)] md:p-8 lg:sticky lg:top-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#e6bb68]">Your agent blueprint</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{selectedGoal.label}</h2>
            <p className="mt-3 text-sm leading-6 text-[#c7d0db]">{form.goalDescription}</p>
            <div className="mt-7 space-y-5">{blueprint.map(([label,value,detail])=><div key={label} className="border-l-2 border-[#b8872d] pl-4"><p className="text-[10px] font-bold tracking-[0.18em] text-[#e6bb68]">{label}</p><p className="mt-1 text-sm font-bold capitalize">{value}</p><p className="mt-1 text-xs leading-5 text-[#aebbc9]">{detail}</p></div>)}</div>
            <p className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-4 text-xs leading-5 text-[#c7d0db]">Nothing goes live until the safe test passes and you explicitly activate. Provider credentials and borrower consent remain separate enforcement gates.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
