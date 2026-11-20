import Link from "next/link";
import { METRO_DATA_YEAR } from "@/content/metro-markets-data";
import type { MetroMarket } from "@/content/metro-markets";
import { realtorComarketing } from "@/content/metro-realtor-comarketing";

/** Realtor co-marketing and outreach intel for loan officers, from the market's own 2024 HMDA numbers. */
export function RealtorComarketing({ market }: { market: MetroMarket }) {
  const c = realtorComarketing(market);
  return (
    <section id="realtor-comarketing" aria-labelledby="realtor-comarketing-heading" className="border-t border-slate-200 py-12">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-800">For loan officers</p>
        <h2 id="realtor-comarketing-heading" className="mt-2 text-3xl font-semibold text-[#13254a]">
          Realtor co-marketing in {market.city}
        </h2>
        <p className="mt-3 max-w-3xl text-slate-700">
          Use {METRO_DATA_YEAR} public HMDA numbers for {market.county} to open conversations with local agents. These are talking points
          drawn from the data, not promises of referrals.
        </p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{s.label}</dt>
              <dd className="mt-1 text-2xl font-bold text-[#13254a]">{s.value}</dd>
              {s.note ? <dd className="mt-1 text-xs text-slate-600">{s.note}</dd> : null}
            </div>
          ))}
        </dl>

        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {c.angles.map((a, i) => (
            <li key={a.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-amber-800">Angle {i + 1}</p>
              <h3 className="mt-1 font-semibold text-[#13254a]">{a.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{a.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-[#13254a]">Outreach starter</h3>
          <p className="mt-1 text-sm text-slate-600">Replace the [bracketed] parts with your details, then make it sound like you.</p>
          <blockquote className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
            {c.outreachStarter}
          </blockquote>
        </div>

        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{c.complianceNote}</p>

        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[#13254a]">
          <Link href="/topics/realtor-referral-partnerships" className="underline">
            Realtor referral partnerships
          </Link>
          <Link href="/rate-sheets" className="underline">
            Rate sheet and lock desk directory
          </Link>
          <Link href="#zip-check" className="underline">
            Check your {market.city} ZIP code
          </Link>
        </p>
      </div>
    </section>
  );
}
