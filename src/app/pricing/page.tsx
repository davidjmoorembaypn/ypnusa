import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PUBLIC_PRICING_TIERS } from "@/lib/pricing";
import { PricingCta } from "@/components/pricing-cta";
import { BreadcrumbSchema } from "@/components/seo/breadcrumbs";
import { faqJsonLd, marketingMetadata } from "@/lib/seo";
import { getSiteOrigin } from "@/lib/request-host";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getSiteOrigin();
  return marketingMetadata({
    title: "Pricing: Free, Growth, Pro & Elite Plans",
    description:
      "Start free, then lock an exclusive ZIP territory on Growth ($99.99), Pro ($199.99) or Elite ($299.99). 15-day free trial on every paid plan.",
    path: "/pricing",
    origin,
  });
}

const COMPARE_ROWS: Array<{ label: string; free: string; growth: string; pro: string; elite: string }> = [
  { label: "Cerebro AI growth diagnostic", free: "✓", growth: "✓", pro: "✓", elite: "✓" },
  { label: "AI borrower intake assistant", free: "✓", growth: "✓", pro: "✓", elite: "✓" },
  { label: "Exclusive ZIP territory", free: "—", growth: "1 included", pro: "1 included", elite: "1 included" },
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
    a: "Nothing. Run Cerebro and the AI intake free, no credit card. When you're ready to lock exclusive ZIP capacity, paid plans are Growth $99.99/mo, Pro $199.99/mo, and Elite $299.99/mo — every paid plan includes a 15-day free trial. Free signup does not reserve a ZIP.",
  },
  {
    q: "What happens after the 15-day trial?",
    a: "Your card is charged at your plan's monthly rate once the trial ends. You can cancel anytime before day 15 and you won't be charged.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. You can upgrade at any time to add capability. Your included ZIP territory carries with you — upgrading buys more automation and priority, not a second territory.",
  },
  {
    q: "Do I keep my leads if I cancel?",
    a: "Yes. Every borrower your AI captures belongs to you, exported and portable, on every plan. Canceling stops new capture and ZIP exclusivity — it never takes back what you already own.",
  },
  {
    q: "What's an exclusive ZIP territory?",
    a: "One loan officer owns the borrower demand in a given ZIP code at a time. Each paid plan includes one ZIP; additional ZIPs are available as paid add-ons, subject to availability.",
  },
];

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
              Run Cerebro and the AI borrower intake assistant free, no credit card. Upgrade to reserve an
              exclusive ZIP territory and turn local demand into leads you own for life.
            </p>
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
                  >
                    {tier.cta}
                  </PricingCta>
                  <Link
                    href="/#territories"
                    className={`mt-3 text-center text-xs font-semibold underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 ${
                      tier.highlight ? "text-white/75 focus-visible:ring-violet-300" : "text-violet-700 focus-visible:ring-violet-500"
                    }`}
                  >
                    Check ZIP availability first
                  </Link>
                </article>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-600">
              {["Start free — no credit card", "Cancel anytime", "You keep every lead you capture"].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <span aria-hidden className="text-emerald-600">✓</span>
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-slate-600">
              Territory availability is limited and first-come. Prices shown are launch rates.
            </p>
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
                    <th className="px-5 py-4 text-center text-violet-200">Growth</th>
                    <th className="px-5 py-4 text-center">Pro</th>
                    <th className="px-5 py-4 text-center">Elite</th>
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
            <h2 className="text-3xl font-semibold lg:text-4xl">Reserve your ZIP before a competitor does.</h2>
            <p className="mt-4 text-lg text-white/85">
              Check availability free, then upgrade to lock the territory — leads and all.
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
