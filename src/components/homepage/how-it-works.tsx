import Link from "next/link";
import { PUBLIC_PRICING_TIERS } from "@/lib/pricing";

const STEPS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "Check & lock your exclusive ZIP code",
    body: "Enter your ZIP code. Each ZIP code goes to one YPN USA loan officer, and it locks to you at your first payment, so check it before another MLO claims it.",
  },
  {
    title: "Capture purchase & refinance leads",
    body: "Cerebro AI answers and qualifies borrowers on your pages 24/7, alongside client payment and buying-power calculators that carry your name and NMLS #.",
  },
  {
    title: "Convert borrowers faster",
    body: "Cerebro drafts SMS and email follow-up for your approval, so every inquiry gets a prompt, consistent reply and you handle the conversations that need a licensed loan officer.",
  },
];

/** Three-step summary shown directly under the hero. Written for licensed mortgage loan officers only. */
export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" className="border-y border-white/10 bg-[#0d0b26] py-14">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-200">How it works for loan officers</p>
          <h2 id="how-it-works-heading" className="mt-3 text-3xl font-semibold text-white lg:text-4xl">
            Lock a ZIP code. Capture leads. Convert faster.
          </h2>
        </div>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/15">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-base font-bold text-[#09081b]" aria-hidden>
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-white">
                <span className="sr-only">Step {i + 1}: </span>
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/80">{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-center text-sm text-white/75">
          Plans: {PUBLIC_PRICING_TIERS.map((t) => `${t.name} ${t.price}`).join(", ")}. Paid plans are monthly and include one exclusive ZIP code.{" "}
          <Link href="/pricing" className="font-semibold text-violet-200 underline hover:text-white">
            Compare plans
          </Link>
        </p>
      </div>
    </section>
  );
}
