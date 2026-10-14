import { Check, Database, Globe, KeyRound, X } from "lucide-react";
import { SectionHeading } from "./section-heading";

const PILLARS = [
  {
    icon: Database,
    title: "Your leads, exportable anytime",
    body: "Every borrower record, conversation, and score is yours. Export the full pipeline in one click.",
  },
  {
    icon: Globe,
    title: "Your domain, your brand",
    body: "Your MLO site and domain move with you. Change brokerages without rebuilding your presence.",
  },
  {
    icon: KeyRound,
    title: "Your funnels, portable",
    body: "Intake flows, nurture ladders, and booking pages are tied to your license, not a company account.",
  },
];

const COMPARISON = [
  { label: "Who owns the lead database", them: "Brokerage", us: "You" },
  { label: "Website and domain after you leave", them: "Shut off", us: "Goes with you" },
  { label: "ZIP exclusivity", them: "Shared leads", us: "One MLO per ZIP" },
  { label: "After-hours borrower response", them: "Voicemail", us: "AI agent, 24/7" },
];

export function Ownership() {
  return (
    <section aria-labelledby="ownership-title" id="ownership" className="scroll-mt-24 px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          id="ownership-title"
          eyebrow="Ownership"
          title="Build an asset, not someone else's pipeline"
          description="Most lead programs rent you demand and keep the data. YPN USA is built so everything you generate stays with you for your whole career."
        />

        <ul className="mt-14 grid gap-5 md:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="ypn-glass rounded-3xl p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-500/20 ring-1 ring-indigo-400/30">
                <Icon className="h-5 w-5 text-indigo-200" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
            </li>
          ))}
        </ul>

        <div className="ypn-glass mt-8 overflow-hidden rounded-3xl">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-white/10 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em]">
            <span className="text-slate-500">Comparison</span>
            <span className="text-slate-500">Typical brokerage</span>
            <span className="text-indigo-200">YPN USA</span>
          </div>
          <dl>
            {COMPARISON.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1.4fr_1fr_1fr] items-center border-b border-white/5 px-6 py-4 text-sm last:border-0"
              >
                <dt className="text-slate-300">{row.label}</dt>
                <dd className="flex items-center gap-2 text-slate-500">
                  <X className="h-4 w-4 shrink-0 text-rose-400/70" aria-hidden />
                  {row.them}
                </dd>
                <dd className="flex items-center gap-2 font-medium text-white">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                  {row.us}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
