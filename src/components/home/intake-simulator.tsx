"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, CalendarCheck, RotateCcw, Sparkles } from "lucide-react";

type Lane = "FHA" | "VA" | "Conventional" | "DSCR" | "HELOC" | "Refi" | "Jumbo";

interface Option {
  label: string;
  points: number;
}

interface Question {
  id: string;
  prompt: string;
  options: Option[];
}

const LANES: { id: Lane; hint: string }[] = [
  { id: "FHA", hint: "Low down payment" },
  { id: "VA", hint: "Veterans & service members" },
  { id: "Conventional", hint: "Standard purchase" },
  { id: "DSCR", hint: "Investor, rent-qualified" },
  { id: "HELOC", hint: "Tap home equity" },
  { id: "Refi", hint: "Lower rate or cash-out" },
  { id: "Jumbo", hint: "High-balance loans" },
];

const CREDIT: Question = {
  id: "credit",
  prompt: "Roughly where does your credit score land?",
  options: [
    { label: "740+", points: 35 },
    { label: "680–739", points: 28 },
    { label: "620–679", points: 18 },
    { label: "Under 620", points: 8 },
  ],
};

const TIMELINE: Question = {
  id: "timeline",
  prompt: "When are you hoping to move forward?",
  options: [
    { label: "Within 30 days", points: 30 },
    { label: "1–3 months", points: 22 },
    { label: "3–6 months", points: 12 },
    { label: "Just researching", points: 4 },
  ],
};

const LANE_QUESTION: Record<Lane, Question> = {
  FHA: {
    id: "lane",
    prompt: "Do you have at least 3.5% saved for a down payment?",
    options: [
      { label: "Yes, plus reserves", points: 35 },
      { label: "About 3.5%", points: 26 },
      { label: "Looking at assistance", points: 16 },
    ],
  },
  VA: {
    id: "lane",
    prompt: "Do you have your Certificate of Eligibility (COE)?",
    options: [
      { label: "Yes, in hand", points: 35 },
      { label: "Eligible, need it pulled", points: 28 },
      { label: "Not sure I qualify", points: 12 },
    ],
  },
  Conventional: {
    id: "lane",
    prompt: "How much are you planning to put down?",
    options: [
      { label: "20% or more", points: 35 },
      { label: "10–19%", points: 28 },
      { label: "3–9%", points: 20 },
    ],
  },
  DSCR: {
    id: "lane",
    prompt: "Does expected rent cover the full monthly payment (PITIA)?",
    options: [
      { label: "Yes, 1.25x or better", points: 35 },
      { label: "About 1.0x", points: 24 },
      { label: "Below 1.0x", points: 10 },
    ],
  },
  HELOC: {
    id: "lane",
    prompt: "Roughly how much equity do you have in the home?",
    options: [
      { label: "40% or more", points: 35 },
      { label: "20–39%", points: 26 },
      { label: "Under 20%", points: 10 },
    ],
  },
  Refi: {
    id: "lane",
    prompt: "What is the main goal of refinancing?",
    options: [
      { label: "Lower my rate", points: 32 },
      { label: "Cash-out", points: 30 },
      { label: "Remove mortgage insurance", points: 26 },
    ],
  },
  Jumbo: {
    id: "lane",
    prompt: "Do you have 6+ months of reserves after closing?",
    options: [
      { label: "12+ months", points: 35 },
      { label: "6–11 months", points: 28 },
      { label: "Less than 6", points: 12 },
    ],
  },
};

const STAGES = ["Lane", "Qualify", "Score", "Book"] as const;

type Message = { from: "agent" | "borrower"; text: string };

function scoreBand(score: number) {
  if (score >= 80) return { label: "Hot · route now", tone: "text-emerald-300", bar: "from-emerald-400 to-sky-400" };
  if (score >= 55) return { label: "Warm · book consult", tone: "text-sky-300", bar: "from-sky-400 to-indigo-400" };
  return { label: "Nurture · drip sequence", tone: "text-amber-300", bar: "from-amber-400 to-orange-400" };
}

function upcomingSlots(): { key: string; label: string }[] {
  const slots: { key: string; label: string }[] = [];
  const day = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
  while (slots.length < 6) {
    day.setDate(day.getDate() + 1);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;
    for (const time of ["10:00 AM", "2:30 PM"]) {
      slots.push({ key: `${day.toDateString()}-${time}`, label: `${fmt.format(day)} · ${time}` });
    }
  }
  return slots;
}

export function IntakeSimulator() {
  const [lane, setLane] = useState<Lane | null>(null);
  const [answers, setAnswers] = useState<Option[]>([]);
  const [booked, setBooked] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ key: string; label: string }[]>([]);
  const logRef = useRef<HTMLOListElement>(null);

  const questions = lane ? [CREDIT, TIMELINE, LANE_QUESTION[lane]] : [];
  const currentQuestion = lane && answers.length < questions.length ? questions[answers.length] : null;
  const scored = lane !== null && answers.length === questions.length;
  const score = Math.min(100, answers.reduce((sum, a) => sum + a.points, 0));
  const band = scoreBand(score);
  const stageIndex = !lane ? 0 : !scored ? 1 : booked ? 3 : 2;

  const messages: Message[] = [
    { from: "agent", text: "Hi! I'm the YPN intake assistant. Which loan are you exploring today?" },
  ];
  if (lane) {
    messages.push({ from: "borrower", text: lane });
    questions.forEach((q, i) => {
      if (i <= answers.length) messages.push({ from: "agent", text: q.prompt });
      if (answers[i]) messages.push({ from: "borrower", text: answers[i].label });
    });
  }
  if (scored) {
    messages.push({
      from: "agent",
      text: `Thanks! You look like a strong fit for a ${lane} conversation. Pick a time to talk with your loan officer.`,
    });
  }
  if (booked) {
    messages.push({ from: "borrower", text: booked });
    messages.push({ from: "agent", text: "You're booked. A confirmation is on its way by email and text." });
  }

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function chooseLane(next: Lane) {
    setLane(next);
    setAnswers([]);
    setBooked(null);
  }

  function answer(option: Option) {
    const nextAnswers = [...answers, option];
    setAnswers(nextAnswers);
    if (lane && nextAnswers.length === 3) setSlots(upcomingSlots());
  }

  function reset() {
    setLane(null);
    setAnswers([]);
    setBooked(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
      <div className="ypn-glass ypn-glow flex min-h-[520px] flex-col overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600">
              <Bot className="h-5 w-5 text-white" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">YPN Intake Agent</p>
              <p className="flex items-center gap-1.5 text-[11px] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                Online · simulated preview
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Restart
          </button>
        </div>

        <ol
          ref={logRef}
          aria-live="polite"
          aria-label="Conversation"
          className="thin-scroll flex max-h-[300px] flex-1 flex-col gap-3 overflow-y-auto px-5 py-5"
        >
          {messages.map((m, i) => (
            <li
              key={`${i}-${m.text}`}
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.from === "agent"
                  ? "self-start rounded-tl-sm bg-white/[0.07] text-slate-100"
                  : "self-end rounded-tr-sm bg-gradient-to-r from-violet-500 to-indigo-500 text-white"
              }`}
            >
              <span className="sr-only">{m.from === "agent" ? "Agent: " : "Borrower: "}</span>
              {m.text}
            </li>
          ))}
        </ol>

        <div className="border-t border-white/10 bg-black/20 px-5 py-4">
          {!lane ? (
            <div role="group" aria-label="Choose a loan lane" className="flex flex-wrap gap-2">
              {LANES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => chooseLane(l.id)}
                  title={l.hint}
                  className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3.5 py-2 text-xs font-semibold text-indigo-100 transition hover:border-indigo-300 hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                >
                  {l.id}
                </button>
              ))}
            </div>
          ) : currentQuestion ? (
            <div role="group" aria-label={currentQuestion.prompt} className="flex flex-wrap gap-2">
              {currentQuestion.options.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => answer(o)}
                  className="rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-100 transition hover:border-indigo-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                >
                  {o.label}
                </button>
              ))}
            </div>
          ) : !booked ? (
            <div role="group" aria-label="Choose a consultation time" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {slots.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setBooked(s.label)}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-left text-xs font-medium text-slate-100 transition hover:border-emerald-300 hover:bg-emerald-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <CalendarCheck className="h-4 w-4" aria-hidden />
              Consultation booked to the loan officer&apos;s calendar.
            </p>
          )}
        </div>
      </div>

      <aside aria-label="Live qualification readout" className="flex flex-col gap-4">
        <div className="ypn-glass rounded-3xl p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Pipeline stage</p>
          <ol className="mt-4 grid grid-cols-4 gap-2">
            {STAGES.map((stage, i) => (
              <li key={stage} className="flex flex-col gap-2">
                <span
                  className={`h-1.5 rounded-full ${i <= stageIndex ? "bg-gradient-to-r from-violet-400 to-sky-400" : "bg-white/10"}`}
                  aria-hidden
                />
                <span className={`text-[11px] font-medium ${i <= stageIndex ? "text-white" : "text-slate-500"}`}>
                  {stage}
                  {i === stageIndex ? <span className="sr-only"> (current)</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="ypn-glass rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Qualification score</p>
            <Sparkles className="h-4 w-4 text-indigo-300" aria-hidden />
          </div>
          <p className="mt-3 text-5xl font-semibold tabular-nums text-white">
            {scored ? score : "--"}
            <span className="text-lg font-medium text-slate-500">/100</span>
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${band.bar} transition-[width] duration-700`}
              style={{ width: `${scored ? score : (answers.reduce((s, a) => s + a.points, 0) / 100) * 100}%` }}
            />
          </div>
          <p className={`mt-3 text-sm font-semibold ${scored ? band.tone : "text-slate-500"}`}>
            {scored ? band.label : "Scoring as the borrower answers"}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <dt className="text-slate-500">Lane</dt>
              <dd className="mt-0.5 font-semibold text-white">{lane ?? "Pending"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Signals captured</dt>
              <dd className="mt-0.5 font-semibold text-white">{answers.length} / 3</dd>
            </div>
          </dl>
        </div>

        <p className="px-1 text-[11px] leading-relaxed text-slate-500">
          Interactive simulation for demonstration only. No information is collected or submitted, and the score is
          illustrative, not a credit decision or commitment to lend.
        </p>
      </aside>
    </div>
  );
}
