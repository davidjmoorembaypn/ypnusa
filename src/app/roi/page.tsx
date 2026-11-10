import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { RoiLoansCalculator } from "@/components/roi-loans-calculator";
import { ORGANIZATION_ID, faqJsonLd, jsonLdScript, marketingMetadata } from "@/lib/seo";
import { PAGE_SEO } from "@/lib/seo/page-seo";
import { homeTrail } from "@/lib/seo/breadcrumbs";
import { formatUsd } from "@/lib/format";
import { compensationPerLoanCents, loansToCoverPlan, planYearlyCosts } from "@/lib/roi";
import { MARKETING_SITE_URL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return marketingMetadata({ ...PAGE_SEO.roi, absoluteTitle: true, path: "/roi" });
}

const PATH = "/roi";
const PLANS = planYearlyCosts();

/** Worked example with round, clearly hypothetical inputs (not a benchmark). */
const EXAMPLE_LOAN = 300_000;
const EXAMPLE_BPS = 100;
const EXAMPLE_COMP_CENTS = compensationPerLoanCents({ mode: "bps", loanAmountDollars: EXAMPLE_LOAN, bps: EXAMPLE_BPS, flatDollars: null }) ?? 0;

const FAQ = [
  {
    q: "How is the number of loans calculated?",
    a: "First, compensation per loan: average loan amount × basis points ÷ 10,000 (or the flat amount you enter). Then the plan's yearly cost ÷ compensation per loan, rounded up to a whole loan, because you can't close part of one.",
  },
  {
    q: "Does this calculator predict how many loans I'll close with YPN USA?",
    a: "No. It only shows how many extra closed loans a year would cover a plan's cost, using your numbers and our prices. Results are illustrations, not a promise of leads or loans.",
  },
  {
    q: "What are basis points?",
    a: "A basis point is one hundredth of a percent. 100 basis points is 1% of the loan amount, so 100 bps on a $300,000 loan is $3,000.",
  },
  {
    q: "Which plan costs are used?",
    a: "Each plan billed monthly for 12 months (Pro $99, Growth $199 or Exclusive $299 a month), or the 5-year prepaid price spread evenly over 5 years.",
  },
];

export default function RoiPage() {
  const url = `${MARKETING_SITE_URL}${PATH}`;
  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${url}#calculator`,
    name: "Loan Officer Marketing ROI Calculator",
    url,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    isAccessibleForFree: true,
    description: PAGE_SEO.roi.description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": ORGANIZATION_ID },
  };

  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(appJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(FAQ)) }} />

        <section className="relative isolate overflow-hidden">
          <div className="ypn-aurora pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
            <Breadcrumbs items={homeTrail({ name: "ROI calculator", href: PATH })} />
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.08] lg:text-5xl">
              How many extra loans pay for YPN?
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-white/85">
              Enter your average loan size and how you&rsquo;re paid. The calculator shows how many extra closed loans a year
              would cover a YPN USA plan. Free, no sign-up.
            </p>
            <div className="mt-8">
              <RoiLoansCalculator />
            </div>
          </div>
        </section>

        <section className="bg-white py-14 text-slate-900 sm:py-16">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold">How the math works</h2>
            <ol className="mt-6 list-decimal space-y-3 pl-5 text-slate-700">
              <li>
                <strong className="text-slate-900">Compensation per loan</strong> = average loan amount × basis points ÷ 10,000.
                If you&rsquo;re paid a flat amount per loan, that amount is used as is.
              </li>
              <li>
                <strong className="text-slate-900">Plan cost per year</strong> = the monthly price × 12, or the 5-year prepaid
                price ÷ 5.
              </li>
              <li>
                <strong className="text-slate-900">Loans needed per year</strong> = plan cost per year ÷ compensation per loan,
                rounded up to a whole loan.
              </li>
            </ol>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                <caption className="mb-2 text-left text-sm text-slate-600">Plan cost per year</caption>
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="border border-slate-200 px-4 py-2.5 font-semibold">Plan</th>
                    <th scope="col" className="border border-slate-200 px-4 py-2.5 font-semibold">Monthly, per year</th>
                    <th scope="col" className="border border-slate-200 px-4 py-2.5 font-semibold">5-year prepaid, per year</th>
                  </tr>
                </thead>
                <tbody>
                  {PLANS.map((plan) => (
                    <tr key={plan.tierId}>
                      <th scope="row" className="border border-slate-200 px-4 py-2.5 font-semibold">{plan.name}</th>
                      <td className="border border-slate-200 px-4 py-2.5">{formatUsd(plan.monthlyPlanYearlyCents / 100)}</td>
                      <td className="border border-slate-200 px-4 py-2.5">{formatUsd(plan.prepaidYearlyCents / 100, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-14 text-slate-900 sm:py-16">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold">What one extra loan is worth</h2>
            <p className="mt-4 text-slate-700">
              A hypothetical example, not a benchmark: on a {formatUsd(EXAMPLE_LOAN)} loan at {EXAMPLE_BPS} basis points, one
              closed loan pays {formatUsd(EXAMPLE_COMP_CENTS / 100)}. Here is how far that goes against each plan&rsquo;s cost
              for a year:
            </p>
            <ul className="mt-6 grid gap-4 md:grid-cols-3">
              {PLANS.map((plan) => {
                const monthly = loansToCoverPlan(EXAMPLE_COMP_CENTS, plan.monthlyPlanYearlyCents);
                return (
                  <li key={plan.tierId} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="mt-2 text-sm text-slate-700">
                      {formatUsd(plan.monthlyPlanYearlyCents / 100)} a year ÷ {formatUsd(EXAMPLE_COMP_CENTS / 100)} ={" "}
                      {monthly?.exact.toFixed(2)} → <strong className="text-slate-900">{monthly?.wholeLoans} loan{monthly?.wholeLoans === 1 ? "" : "s"}</strong>
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-6 text-sm text-slate-700">
              Your numbers will differ. Whether those loans come depends on your market and your follow-up; YPN USA doesn&rsquo;t
              guarantee leads or loans. To see what each plan includes, visit{" "}
              <Link href="/pricing" className="font-semibold text-violet-700 underline">
                pricing
              </Link>
              , or read our{" "}
              <Link href="/topics/loan-officer-marketing" className="font-semibold text-violet-700 underline">
                loan officer marketing guides
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="bg-white py-14 text-slate-900 sm:py-16">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold">FAQ</h2>
            <div className="mt-8 space-y-4">
              {FAQ.map((item) => (
                <details key={item.q} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <summary className="cursor-pointer font-semibold text-slate-900">{item.q}</summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">{item.a}</p>
                </details>
              ))}
            </div>
            <p className="mt-8 text-sm text-slate-700">
              Ready to see if your market is open?{" "}
              <Link href="/claim-territory" className="font-semibold text-violet-700 underline">
                Check your ZIP code free
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
