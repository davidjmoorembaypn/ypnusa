import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ZipWP | MLO Website Builder Partner",
  description:
    "Launch a modern mortgage loan officer website with ZipWP. Flexible templates, fast setup, and partner support for growing MLOs.",
  alternates: { canonical: "/zipwp" },
};

const zipwpAffiliateUrl = "https://zipwp.com/?aff=13cc9ca0";
const zipwpAffiliateWithUtm = `${zipwpAffiliateUrl}&utm_source=ypnus&utm_medium=affiliate&utm_campaign=zipwp`;

export default function ZipWpPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16 text-slate-900">
      <div className="rounded-[32px] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-8 md:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">Partner solution</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">ZipWP for mortgage professionals</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-700">
          Build a polished, lead-ready website without starting from scratch. ZipWP helps mortgage
          professionals launch a modern web presence that supports lead capture, brand positioning, and
          client trust.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <a
            href={zipwpAffiliateWithUtm}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-full bg-violet-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-800"
            data-ypn-affiliate="zipwp"
          >
            Visit ZipWP &amp; get started →
          </a>
          <a href="/pricing" className="inline-flex rounded-full border border-violet-200 px-6 py-3 text-sm font-semibold text-violet-700">
            Compare YPN plans
          </a>
        </div>
      </div>

      <section className="mt-12 grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Fast launch",
            body: "Get a clean portfolio or service site live quickly with templates tailored for mortgage and real-estate professionals.",
          },
          {
            title: "Built for trust",
            body: "Show credentials, services, and client education in a way that positions you as a polished expert.",
          },
          {
            title: "Lead-focused",
            body: "Support inquiries, discoverability, and stronger conversion paths with forms, calls-to-action, and local positioning.",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">{item.title}</h2>
            <p className="mt-3 text-slate-700">{item.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 p-8">
        <h2 className="text-2xl font-semibold">Why YPN recommends ZipWP</h2>
        <ul className="mt-5 list-disc space-y-2 pl-6 text-slate-700">
          <li>Fast setup for mortgage and real-estate professionals</li>
          <li>Professional design patterns that improve conversion confidence</li>
          <li>Helpful for implementing a stronger digital front door while growing your lead acquisition engine</li>
          <li>Works well as part of a broader YPN funnel and marketing stack</li>
        </ul>
      </section>

      <section className="mt-12 rounded-3xl border border-slate-200 bg-white p-8">
        <h2 className="text-2xl font-semibold">YPN Inc. business details</h2>
        <ul className="mt-5 list-disc space-y-2 pl-6 text-slate-700">
          <li>Company Name: YPN Inc. (Young Professionals Network / YPN USA)</li>
          <li>Services: Real estate websites, AI-driven marketing, lead generation, and digital advertising</li>
          <li>Leadership: David J. Moore (President / CEO)</li>
          <li>Address: Four Embarcadero Center, Suite 1400, San Francisco, CA 94111</li>
          <li>Regional presence: Reedley / Dinuba, CA</li>
          <li>Phone: +1 559-607-3797</li>
        </ul>
      </section>
    </main>
  );
}
