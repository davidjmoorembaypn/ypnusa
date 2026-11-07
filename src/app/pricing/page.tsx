import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FounderTrustStrip } from "@/components/founder-trust-strip";
import {
  CURRENT_PAID_TIER_IDS,
  PREPAID_5Y,
  PREPAID_5Y_REFUND_WINDOW_DAYS,
  PREPAID_5Y_YEARS,
  PUBLIC_PRICING_TIERS,
  getPricingTier,
} from "@/lib/pricing";
import { formatUsd } from "@/lib/format";
import { TerritoryClaim } from "@/components/territory-claim";
import { PricingCta } from "@/components/pricing-cta";
import { PricingRoiCalculator } from "@/components/pricing-roi-calculator";
import { BreadcrumbSchema } from "@/components/seo/breadcrumbs";
import { faqJsonLd, marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const origin = MARKETING_SITE_URL;
  return marketingMetadata({
    title: "Pricing: Free, Pro, Growth & Exclusive Plans",
    description:
      "Start free, then lock an exclusive ZIP code on Pro ($99), Growth ($199) or Exclusive ($299). Try any paid plan free for 15 days, or pay now to lock your ZIP code today.",
    path: "/pricing",
    origin,
  });
}

const COMPARE_ROWS: Array<{ label: string; free: string; growth: string; pro: string; elite: string }> = [
  { label: "Cerebro AI growth diagnostic", free: "✓", growth: "✓", pro: "✓", elite: "✓" },
  { label: "AI borrower intake assistant", free: "✓", growth: "✓", pro: "✓", elite: "✓" },
  { label: "Exclusive ZIP code (locks at first payment)", free: "—", growth: "1 included", pro: "1 included", elite: "1 included" },
  { label: "Live lead delivery", free: "—", growth: "✓", pro: "✓", elite: "✓" },
  { label: "SMS + email nurture ladders", free: "—", growth: "✓", pro: "✓", elite: "✓" },
  { label: "Calendar booking + CRM mirroring", free: "—", growth: "✓", pro: "✓", elite: "✓" },
  { label: "Portable MLO website", free: "—", growth: "—", pro: "✓", elite: "✓" },
  { label: "Priority lead delivery", free: "—", growth: "—", pro: "✓", elite: "✓" },
  { label: "Advanced life-event signals", free: "—", growth: "—", pro: "✓", elite: "✓" },
  { label: "Priority ZIP add-on access", free: "—", growth: "—", pro: "—", elite: "✓" },
  { label: "Unlimited automation runs", free: "—", growth: "—", pro: "—", elite: "✓" },
  { label: "White-glove onboarding", free: "—", growth: "—", pro: "—", elite: "✓" },
];

const PRICING_FAQ = [
  {
    q: "How much does it cost to start?",
    a: "Nothing. Run Cerebro and the AI intake free, no credit card. Paid plans are Pro $99/mo, Growth $199/mo, and Exclusive $299/mo. Every paid plan offers a 15-day free trial so you can try the tools. Neither the Free plan nor the trial locks a ZIP code: your ZIP code locks when your first payment goes through.",
  },
  {
    q: "Does the 15-day trial lock my ZIP code?",
    a: "No. The trial lets you try the tools; your ZIP code locks at your first payment. If another loan officer pays for the same ZIP code before you do, it's theirs. To lock your ZIP code today, choose \"Pay now & lock my ZIP code today\" (same monthly price, no trial) or a 5-year plan.",
  },
  {
    q: "What happens after the 15-day trial?",
    a: "Your card is charged at your plan's monthly rate once the trial ends, and that first payment locks your ZIP code if it's still available. You can cancel anytime before day 15 and you won't be charged.",
  },
  {
    q: "How does the 5-year plan work?",
    a: `You pay once: Pro ${formatUsd(PREPAID_5Y.growth.priceCents / 100)}, Growth ${formatUsd(PREPAID_5Y.pro.priceCents / 100)}, or Exclusive ${formatUsd(PREPAID_5Y.elite.priceCents / 100)}. Your ZIP code is locked to you, and your plan stays active, for ${PREPAID_5Y_YEARS} years from the payment date. Full refund within ${PREPAID_5Y_REFUND_WINDOW_DAYS} days of purchase; no refunds after ${PREPAID_5Y_REFUND_WINDOW_DAYS} days. A refund releases your ZIP code.`,
  },
  {
    q: "Can I change plans later?",
    a: "Yes. You can upgrade at any time to add capability. Your included ZIP code carries with you — upgrading buys more automation and priority, not a second ZIP code.",
  },
  {
    q: "Do I keep my leads if I cancel?",
    a: "Yes. Every borrower your AI captures belongs to you, exported and portable, on every plan. Canceling stops new capture and ZIP exclusivity — it never takes back what you already own.",
  },
  {
    q: "What's an exclusive ZIP code?",
    a: "One loan officer owns the borrower demand in a given ZIP code at a time. Each paid plan includes one ZIP code; additional ZIP codes are available as paid add-ons, subject to availability.",
  },
];

const PAID_CARD_TRIAL_NOTE = "Try the tools. Your ZIP code is not locked until your first payment.";

const PREPAID_5Y_TERMS = `Full refund within ${PREPAID_5Y_REFUND_WINDOW_DAYS} days of purchase; no refunds after ${PREPAID_5Y_REFUND_WINDOW_DAYS} days. A refund releases your ZIP code.`;

export default function PricingPage() {
  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />

      <main id="main-content" className="flex-1">
        <BreadcrumbSchema items={[{ name: "Home", href: "/" }, { name: "Pricing", href: "/pricing" }]} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(PRICING_FAQ)) }} />
        <section className="relative isolate overflow-hidden">
          <div className="ypn-aurora pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative z-10 mx-auto w-full max-w-4xl px-6 py-16 text-center sm:py-20">
            <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-100">
              Pricing
            </span>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.08] lg:text-5xl">
              Start free. Lock your territory when you&apos;re ready.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/85">
              Run Cerebro and the AI borrower intake assistant free, no credit card. Neither the Free plan nor the 15-day trial locks a ZIP
              code: your exclusive ZIP code locks at your first payment. Pay now, or choose a 5-year plan, to lock it today.
            </p>
            <div className="mx-auto mt-8 max-w-md text-left">
              <TerritoryClaim source="pricing_hero" />
              <p className="mt-3 text-center text-xs text-white/70">
                Checking availability is free &mdash; locking a ZIP code takes your first payment on a paid plan.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 text-slate-900 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {PUBLIC_PRICING_TIERS.map((tier) => (
                <article
                  key={tier.id}
                  className={`flex min-h-full flex-col rounded-3xl border p-6 transition duration-200 hover:-translate-y-1 md:p-8 ${
                    tier.highlight
                      ? "border-violet-400 bg-[#09081b] text-white shadow-2xl shadow-violet-500/20 ring-2 ring-violet-400/40"
                      : "border-slate-200 bg-white text-slate-900 shadow-sm"
                  }`}
                >
                  {tier.highlight ? (
                    <span className="mb-3 inline-flex w-fit rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#09081b]">
                      Most popular
                    </span>
                  ) : null}
                  <h2 className="text-lg font-semibold">{tier.name}</h2>
                  <p className={`mt-1 text-sm ${tier.highlight ? "text-white/70" : "text-slate-500"}`}>{tier.tagline}</p>
                  <div className="mt-5 flex items-end gap-1">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    <span className={`pb-1 text-sm ${tier.highlight ? "text-white/70" : "text-slate-500"}`}>{tier.cadence}</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-3 text-sm">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span aria-hidden className={tier.highlight ? "text-amber-300" : "text-violet-600"}>✓</span>
                        <span className={tier.highlight ? "text-white/90" : "text-slate-600"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <PricingCta
                    tierId={tier.id}
                    className={`mt-8 inline-flex min-h-[48px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 ${
                      tier.highlight
                        ? "bg-amber-400 text-[#09081b] shadow-lg shadow-amber-500/30"
                        : "bg-[#09081b] text-white"
                    }`}
                    aria-describedby={tier.priceMonthlyCents > 0 ? `trial-note-${tier.id}` : undefined}
                  >
                    {tier.cta}
                  </PricingCta>
                  {tier.priceMonthlyCents > 0 ? (
                    <>
                      <p
                        id={`trial-note-${tier.id}`}
                        className={`mt-2 text-center text-xs leading-snug ${tier.highlight ? "text-white/75" : "text-slate-600"}`}
                      >
                        {PAID_CARD_TRIAL_NOTE}
                      </p>
                      <PricingCta
                        tierId={tier.id}
                        variant="pay_now"
                        className={`mt-3 inline-flex min-h-[48px] items-center justify-center rounded-full border-2 px-6 py-3 text-center text-sm font-semibold transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 ${
                          tier.highlight
                            ? "border-amber-300 text-amber-200 hover:bg-white/10 focus-visible:ring-amber-200"
                            : "border-[#09081b] text-[#09081b] hover:bg-slate-50 focus-visible:ring-violet-500"
                        }`}
                      >
                        Pay now &amp; lock my ZIP code today
                      </PricingCta>
                    </>
                  ) : null}
                  <Link
                    href="/#territories"
                    className={`mt-3 text-center text-xs font-semibold underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 ${
                      tier.highlight ? "text-white/75 focus-visible:ring-violet-300" : "text-violet-700 focus-visible:ring-violet-500"
                    }`}
                  >
                    Check ZIP code availability first
                  </Link>
                </article>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-600">
              {["Free plan needs no card (no ZIP code lock)", "Cancel anytime", "You keep every lead you capture"].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <span aria-hidden className="text-emerald-600">✓</span>
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-slate-600">
              ZIP code availability is limited: the first loan officer to pay for a ZIP code locks it. Prices shown are launch rates.
            </p>
          </div>
        </section>

        {/* 5-YEAR PREPAID */}
        <section aria-labelledby="prepaid-5y-heading" className="bg-slate-50 py-16 text-slate-900 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-700">5-year exclusive</p>
              <h2 id="prepaid-5y-heading" className="mt-3 text-3xl font-semibold lg:text-4xl">
                Lock your ZIP code for {PREPAID_5Y_YEARS} years with one payment
              </h2>
              <p className="mt-4 text-base text-slate-600">
                Same plans, paid once. Your ZIP code locks the day you pay and stays yours for {PREPAID_5Y_YEARS} years.
              </p>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {CURRENT_PAID_TIER_IDS.map((tierId) => {
                const tier = getPricingTier(tierId);
                const plan = PREPAID_5Y[tierId];
                return (
                  <article key={tierId} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    <h3 className="text-lg font-semibold">{tier.name} &middot; 5 years</h3>
                    <div className="mt-4 flex items-end gap-1">
                      <span className="text-4xl font-bold">{formatUsd(plan.priceCents / 100)}</span>
                      <span className="pb-1 text-sm text-slate-500">one-time</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      vs {formatUsd(plan.monthlyEquivalentCents / 100)} paid monthly &mdash; save about a third
                    </p>
                    <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-700">
                      <li className="flex items-start gap-2">
                        <span aria-hidden className="text-violet-600">✓</span>
                        <span>ZIP code locked to you for {PREPAID_5Y_YEARS} years from payment</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span aria-hidden className="text-violet-600">✓</span>
                        <span>Everything in {tier.name}, for {PREPAID_5Y_YEARS} years</span>
                      </li>
                    </ul>
                    <PricingCta
                      tierId={tierId}
                      variant="prepaid_5y"
                      aria-describedby="prepaid-5y-terms"
                      className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#09081b] px-6 py-3 text-center text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      Lock my ZIP code for {PREPAID_5Y_YEARS} years
                    </PricingCta>
                  </article>
                );
              })}
            </div>
            <p id="prepaid-5y-terms" className="mx-auto mt-6 max-w-2xl text-center text-sm text-slate-600">
              {PREPAID_5Y_TERMS} See the{" "}
              <Link href="/terms-of-service" className="font-semibold text-violet-700 underline underline-offset-2">
                Terms of Service
              </Link>
              .
            </p>
          </div>
        </section>

        {/* ROI */}
        <section aria-labelledby="roi-heading" className="bg-white py-16 text-slate-900 sm:py-20">
          <div className="mx-auto w-full max-w-5xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-700">Do the math</p>
              <h2 id="roi-heading" className="mt-3 text-3xl font-semibold lg:text-4xl">
                One extra closed loan pays for YPN many times over
              </h2>
              <p className="mt-4 text-base text-slate-600">
                Enter your own numbers to compare one year&apos;s extra commission with what each plan costs per year.
              </p>
            </div>
            <div className="mt-10">
              <PricingRoiCalculator />
            </div>
          </div>
        </section>

        {/* COMPARISON TABLE */}
        <section className="bg-[#0d0b26] py-16 sm:py-20">
          <div className="mx-auto w-full max-w-5xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">Compare plans</p>
              <h2 className="mt-3 text-3xl font-semibold lg:text-4xl">What each plan includes</h2>
            </div>
            <div className="mt-10 overflow-x-auto rounded-3xl border border-white/10">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="bg-white/5 text-left text-xs font-semibold uppercase tracking-wide text-white/60">
                    <th className="px-5 py-4">Feature</th>
                    <th className="px-5 py-4 text-center">Free</th>
                    <th className="px-5 py-4 text-center text-violet-200">Pro</th>
                    <th className="px-5 py-4 text-center">Growth</th>
                    <th className="px-5 py-4 text-center">Exclusive</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row.label} className="border-t border-white/10">
                      <td className="px-5 py-3 text-white/80">{row.label}</td>
                      <td className="px-5 py-3 text-center text-white/60">{row.free}</td>
                      <td className="px-5 py-3 text-center text-emerald-300">{row.growth}</td>
                      <td className="px-5 py-3 text-center text-white/60">{row.pro}</td>
                      <td className="px-5 py-3 text-center text-white/60">{row.elite}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <FounderTrustStrip />

        {/* FAQ */}
        <section className="bg-slate-50 py-16 text-slate-900 sm:py-20">
          <div className="mx-auto w-full max-w-3xl px-6">
            <h2 className="text-center text-3xl font-semibold lg:text-4xl">Pricing questions</h2>
            <div className="mt-10 space-y-4">
              {PRICING_FAQ.map((item) => (
                <details key={item.q} className="group rounded-2xl border border-slate-200 bg-white p-5 [&_summary]:cursor-pointer">
                  <summary className="flex items-center justify-between text-base font-semibold text-slate-900 marker:content-none">
                    {item.q}
                    <span aria-hidden className="ml-4 text-violet-600 transition group-open:rotate-45">＋</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative isolate overflow-hidden bg-[#09081b] py-20">
          <div className="ypn-aurora pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-semibold lg:text-4xl">Lock your ZIP code before a competitor does.</h2>
            <p className="mt-4 text-lg text-white/85">
              Check availability free. Pay now to lock it today, or start a 15-day trial to try the tools first &mdash; your ZIP code
              locks at your first payment.
            </p>
            <Link
              href="/#territories"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-amber-400 px-8 py-4 text-base font-semibold text-[#09081b] shadow-xl shadow-amber-500/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              Check ZIP availability — free
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
