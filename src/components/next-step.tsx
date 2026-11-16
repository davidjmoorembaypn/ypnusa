import { TrackedLink } from "@/components/tracked-link";
import type { NextStep } from "@/lib/cta/next-steps";

/**
 * The closing call to action on guides and landing pages: one primary button and one quiet
 * text link (src/lib/cta/next-steps.ts picks which). Plain anchors in the HTML so crawlers
 * see the path from every page to the money pages.
 */
export function NextStepBlock({
  step,
  source,
  tone = "light",
  className = "",
}: {
  step: NextStep;
  /** Where the block sits, sent with the GA4 click event (e.g. "blog_post", "wp_page"). */
  source: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <aside
      aria-labelledby="next-step-heading"
      className={`rounded-3xl border p-6 sm:p-8 ${dark ? "border-white/15 bg-white/5 text-white" : "border-violet-200 bg-violet-50 text-slate-900"} ${className}`}
    >
      <h2 id="next-step-heading" className="text-xl font-semibold tracking-tight">
        {step.heading}
      </h2>
      <p className={`mt-2 text-[15px] leading-7 ${dark ? "text-white/80" : "text-slate-700"}`}>{step.body}</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <TrackedLink
          href={step.primary.href}
          event="next_step_click"
          eventParams={{ source, cta: step.primary.label, link_url: step.primary.href }}
          className="inline-flex rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-[#09081b] transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          {step.primary.label}
        </TrackedLink>
        {step.secondary ? (
          <TrackedLink
            href={step.secondary.href}
            event="next_step_click"
            eventParams={{ source, cta: step.secondary.label, link_url: step.secondary.href }}
            className={`text-sm font-semibold underline underline-offset-2 ${dark ? "text-violet-200 hover:text-white" : "text-violet-700 hover:text-violet-900"}`}
          >
            {step.secondary.label}
          </TrackedLink>
        ) : null}
      </div>
    </aside>
  );
}
