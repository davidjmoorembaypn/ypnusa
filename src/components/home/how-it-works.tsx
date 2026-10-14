import { CalendarCheck, Gauge, MapPin, MessageSquare } from "lucide-react";
import { SectionHeading } from "./section-heading";

const STEPS = [
  {
    icon: MapPin,
    title: "Lock your ZIP",
    body: "Claim exclusive rights to borrower demand in your territory. One loan officer per ZIP, no shared leads.",
  },
  {
    icon: MessageSquare,
    title: "Agent captures",
    body: "Your AI intake agent greets every visitor 24/7 and adapts to the loan program they need.",
  },
  {
    icon: Gauge,
    title: "Borrowers get scored",
    body: "Credit posture, timeline, and lane-specific signals produce a live qualification score.",
  },
  {
    icon: CalendarCheck,
    title: "Consults get booked",
    body: "Qualified borrowers land on your calendar with full context. Everyone else enters a nurture ladder.",
  },
];

const LIFE_EVENTS = [
  {
    tag: "Probate",
    body: "Supported public probate records can surface potential estate-financing needs before a listing hits the MLS.",
  },
  {
    tag: "Divorce",
    body: "Supported public dissolution records can signal a possible refinance or sell-and-rebuy need.",
  },
  {
    tag: "Marriage",
    body: "Where lawfully available, life-stage signals power relevant homebuyer education without sensitive targeting.",
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" id="how" className="scroll-mt-24 px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          id="how-title"
          eyebrow="How it works"
          title="From ZIP lock to booked consultation, automatically"
        />
        <ol className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="ypn-glass relative rounded-3xl p-6">
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-indigo-300" aria-hidden />
                <span className="text-xs font-semibold tabular-nums text-slate-500">0{i + 1}</span>
              </div>
              <h3 className="mt-6 text-base font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-5 rounded-3xl border border-white/10 bg-white/[0.02] p-6 lg:grid-cols-[1fr_2fr] lg:p-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-300">Pro & Elite</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Life-event intelligence</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Compliant, public-record signals that help you reach borrowers before the market does.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3">
            {LIFE_EVENTS.map((e) => (
              <li key={e.tag} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <span className="inline-flex rounded-full bg-indigo-500/15 px-2.5 py-1 text-[11px] font-semibold text-indigo-200">
                  {e.tag}
                </span>
                <p className="mt-3 text-[13px] leading-relaxed text-slate-400">{e.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
