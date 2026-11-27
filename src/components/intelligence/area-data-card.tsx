import { AREA_DATA_LABEL, AREA_SOURCES, areaDataScoringEnabled, areaProfile, type AreaProfile } from "@/lib/area-data";
import { Card } from "./dashboard-shell";

/**
 * Server component: the public area statistics behind the life-event score for one ZIP code, each
 * next to the national figure. A value the sources do not publish is shown as "No data", never 0.
 */

const NO_DATA = "No data";
const rate = (value: number | null, digits = 1) => (value === null ? NO_DATA : value.toFixed(digits));
const percent = (value: number | null | undefined) => (value === null || value === undefined ? NO_DATA : `${(value * 100).toFixed(1)}%`);

function rows(profile: AreaProfile): { label: string; area: string; national: string; scope: string }[] {
  const county = profile.countyName ?? "County";
  const state = profile.state?.name ?? "State";
  return [
    { label: "Births per 1,000 residents", area: rate(profile.rates.births), national: rate(profile.national.births), scope: county },
    { label: "Deaths per 1,000 residents", area: rate(profile.rates.deaths), national: rate(profile.national.deaths), scope: county },
    { label: "Net gain from moves per 1,000 residents", area: rate(profile.rates.netMigration), national: rate(profile.national.netMigration), scope: county },
    { label: "Marriages per 1,000 adults", area: rate(profile.rates.marriages), national: rate(profile.national.marriages), scope: state },
    { label: "Divorces per 1,000 adults", area: rate(profile.rates.divorces), national: rate(profile.national.divorces), scope: state },
  ];
}

export function AreaDataCard({ zip }: { zip?: string }) {
  const valid = zip && /^\d{5}$/.test(zip) ? zip : null;
  const profile = valid ? areaProfile(valid) : null;
  const anyData = profile ? Object.values(profile.has).some(Boolean) : false;
  const scoring = areaDataScoringEnabled();

  return (
    <Card title="Area data for a ZIP code">
      <p className="text-sm text-slate-600">
        Public statistics for the county and state around a ZIP code, next to the national figure. They describe the
        area, not any person in it.
      </p>

      <form method="get" className="mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor="area-zip" className="sr-only">ZIP code</label>
        <input
          id="area-zip"
          name="zip"
          defaultValue={valid ?? ""}
          placeholder="ZIP code"
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          required
          className="rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none"
        />
        <button type="submit" className="rounded-full bg-violet-700 px-5 py-2 text-sm font-semibold text-white">
          Show area data
        </button>
      </form>

      {zip && !valid ? <p className="mt-4 text-sm text-rose-700">Enter a 5-digit ZIP code.</p> : null}

      {profile && !anyData ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          No public data is on file for {profile.zip}. That is common for PO-box and single-building ZIP codes.
        </p>
      ) : null}

      {profile && anyData ? (
        <div className="mt-5 space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-slate-500">County</dt>
              <dd className="font-semibold text-slate-900">
                {profile.countyName ? `${profile.countyName}${profile.state ? `, ${profile.state.abbr}` : ""}` : NO_DATA}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-slate-500">Households that rent in {profile.zip}</dt>
              <dd className="font-semibold text-slate-900">{percent(profile.households?.renterShare)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-slate-500">People in households who moved in the past year</dt>
              <dd className="font-semibold text-slate-900">{percent(profile.mobilityRate)}</dd>
            </div>
          </dl>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Measure</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Area</th>
                  <th scope="col" className="py-2 pr-4 font-medium">This area</th>
                  <th scope="col" className="py-2 font-medium">United States</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows(profile).map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="py-2 pr-4 font-normal text-slate-700">{row.label}</th>
                    <td className="py-2 pr-4 text-slate-600">{row.scope}</td>
                    <td className="py-2 pr-4 font-semibold text-slate-900">{row.area}</td>
                    <td className="py-2 text-slate-600">{row.national}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="mt-5 space-y-2 text-xs leading-5 text-slate-500">
        <p>{AREA_DATA_LABEL}</p>
        <p>
          Sources: {AREA_SOURCES.countyChange}. {AREA_SOURCES.marital}. {AREA_SOURCES.households}. County for each ZIP
          code: {AREA_SOURCES.county}.
        </p>
        <p>
          Net gain from moves counts moves within the US and moves to and from abroad. Not connected: probate,
          divorce and deed filings (individual court and recorder records), and rental demand. Scores do not use them.
        </p>
        <p>
          Scoring of stored leads with this data is <strong>{scoring ? "on" : "off"}</strong>
          {scoring ? "." : ". Leads from the intake form are still scored without it; the lookup below uses it."}
        </p>
      </div>
    </Card>
  );
}
