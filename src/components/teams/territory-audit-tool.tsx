"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/track";
import { checkoutUrlForTier, payNowUrlForTier } from "@/lib/checkout";
import { PUBLIC_PRICING_TIERS } from "@/lib/pricing";

type Status = "open" | "claimed" | "unknown";
interface Row {
  zip: string;
  city: string;
  state: string;
  miles: number;
  status: Status;
  demandTotal: number | null;
}
interface Audit {
  center: { zip: string; city: string; state: string };
  radiusMiles: number;
  officers: number | null;
  totals: { inRadius: number; evaluated: number; open: number; claimed: number; unknown: number; notEvaluated: number };
  demand: { total: number; windowDays: number | null; zipsReporting: number; openZips: number };
  zips: Row[];
}
type State = { phase: "idle" } | { phase: "loading" } | { phase: "error"; message: string } | { phase: "done"; audit: Audit };

const FIELD =
  "mt-1 min-h-[48px] w-full rounded-xl border border-white/20 bg-white px-3 py-2 text-base font-semibold text-slate-900 outline-none ring-violet-300 focus:ring-2";
const LABEL = "block text-sm font-semibold text-white/90";

/** The Pro plan ($99) is the plan a ZIP code lock is sold on; each loan officer holds their own. */
const SEAT_PLAN = PUBLIC_PRICING_TIERS.find((t) => t.id === "growth");

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/15">
      <dt className="text-xs font-semibold uppercase tracking-wide text-white/70">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-white">{value}</dd>
      {note ? <dd className="mt-1 text-xs text-white/65">{note}</dd> : null}
    </div>
  );
}

export function TerritoryAuditTool({ initialZip = "" }: { initialZip?: string }) {
  const [zip, setZip] = useState(initialZip);
  const [radius, setRadius] = useState("10");
  const [officers, setOfficers] = useState("5");
  const [state, setState] = useState<State>({ phase: "idle" });
  const [picked, setPicked] = useState<string[]>([]);
  const ranInitial = useRef(false);

  async function run(zipValue = zip) {
    const clean = zipValue.replace(/\D/g, "").slice(0, 5);
    if (clean.length !== 5) {
      setState({ phase: "error", message: "Enter your office's 5-digit ZIP code." });
      return;
    }
    setState({ phase: "loading" });
    setPicked([]);
    try {
      const res = await fetch(`/api/teams/territory-audit?zip=${clean}&radius=${radius}&officers=${encodeURIComponent(officers)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setState({ phase: "error", message: typeof data.error === "string" ? data.error : "The audit is unavailable right now. Please try again shortly." });
        return;
      }
      const audit = data as Audit;
      setState({ phase: "done", audit });
      // Preselect the nearest open ZIP codes, one per loan officer on the team.
      const want = audit.officers ?? 1;
      setPicked(audit.zips.filter((z) => z.status === "open").slice(0, want).map((z) => z.zip));
      track("territory_audit_run", { zip: clean, radius, open: audit.totals.open });
    } catch {
      setState({ phase: "error", message: "The audit is unavailable right now. Please try again shortly." });
    }
  }

  useEffect(() => {
    if (ranInitial.current) return;
    ranInitial.current = true;
    if (/^\d{5}$/.test(initialZip)) void Promise.resolve().then(() => run(initialZip));
    // run is stable enough for a one-time mount effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const audit = state.phase === "done" ? state.audit : null;
  const openRows = useMemo(() => (audit ? audit.zips.filter((z) => z.status === "open") : []), [audit]);
  const toggle = (z: string) => setPicked((cur) => (cur.includes(z) ? cur.filter((x) => x !== z) : [...cur, z]));

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
        className="grid gap-4 rounded-3xl bg-white/[0.06] p-5 ring-1 ring-white/15 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end"
      >
        <div>
          <label htmlFor="audit-zip" className={LABEL}>
            Office ZIP code
          </label>
          <input id="audit-zip" inputMode="numeric" autoComplete="postal-code" placeholder="e.g. 93618" value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))} className={FIELD} />
        </div>
        <div>
          <label htmlFor="audit-radius" className={LABEL}>
            Radius
          </label>
          <select id="audit-radius" value={radius} onChange={(e) => setRadius(e.target.value)} className={FIELD}>
            {["5", "10", "15"].map((r) => (
              <option key={r} value={r}>
                {r} miles
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-officers" className={LABEL}>
            Loan officers on your team
          </label>
          <input id="audit-officers" type="number" min={1} max={50} value={officers} onChange={(e) => setOfficers(e.target.value)} className={FIELD} />
        </div>
        <button
          type="submit"
          disabled={state.phase === "loading"}
          className="min-h-[48px] rounded-2xl bg-amber-400 px-6 py-3 text-base font-bold text-[#09081b] shadow-lg shadow-amber-500/30 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-wait disabled:opacity-60"
        >
          {state.phase === "loading" ? "Checking..." : "Run audit"}
        </button>
      </form>

      <div aria-live="polite" className="mt-6">
        {state.phase === "error" ? (
          <p role="alert" className="rounded-2xl border border-rose-300/40 bg-rose-400/10 p-4 text-sm text-rose-100">
            {state.message}
          </p>
        ) : null}

        {audit ? (
          <div className="space-y-6">
            <p className="text-sm text-white/80">
              Around {audit.center.city ? `${audit.center.city}, ${audit.center.state} ` : ""}
              {audit.center.zip}, within {audit.radiusMiles} miles.
              {audit.totals.notEvaluated > 0
                ? ` ${audit.totals.inRadius} ZIP codes are in range; the nearest ${audit.totals.evaluated} were checked.`
                : ` ${audit.totals.inRadius} ZIP codes are in range.`}
            </p>

            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="ZIP codes in range" value={String(audit.totals.inRadius)} note={`${audit.totals.evaluated} checked`} />
              <Stat label="Open" value={String(audit.totals.open)} />
              <Stat label="Already claimed" value={String(audit.totals.claimed)} />
              <Stat
                label="Expected activity, open ZIPs"
                value={audit.demand.zipsReporting > 0 ? `~${audit.demand.total.toLocaleString("en-US")}` : "Not available"}
                note={
                  audit.demand.zipsReporting > 0
                    ? `buyers, sellers and movers over ${audit.demand.windowDays ?? 60} days, from ${audit.demand.zipsReporting} of ${audit.demand.openZips} open ZIP codes`
                    : "The ledger reported no figures for these ZIP codes"
                }
              />
            </dl>

            {audit.totals.unknown > 0 ? (
              <p className="rounded-xl border border-amber-300/40 bg-amber-400/10 p-3 text-sm text-amber-100">
                {audit.totals.unknown === audit.totals.evaluated
                  ? "We couldn't check availability just now, so no ZIP code is shown as open. Please try again shortly."
                  : `${audit.totals.unknown} ZIP codes couldn't be checked just now and are not counted as open. Run the audit again in a minute.`}
              </p>
            ) : null}

            {openRows.length > 0 ? (
              <div>
                <h2 className="text-xl font-semibold text-white">Open ZIP codes</h2>
                <p className="mt-1 text-sm text-white/75">Select a ZIP code for each loan officer. Each one is held by a single loan officer on their own plan.</p>
                <div className="mt-3 overflow-x-auto rounded-2xl ring-1 ring-white/15">
                  <table className="w-full min-w-[34rem] text-left text-sm text-white">
                    <caption className="sr-only">Open ZIP codes near {audit.center.zip}</caption>
                    <thead className="bg-white/10 text-xs uppercase tracking-wide text-white/75">
                      <tr>
                        <th scope="col" className="px-4 py-3">Select</th>
                        <th scope="col" className="px-4 py-3">ZIP code</th>
                        <th scope="col" className="px-4 py-3">Place</th>
                        <th scope="col" className="px-4 py-3 text-right">Miles</th>
                        <th scope="col" className="px-4 py-3 text-right">Expected activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openRows.map((z) => (
                        <tr key={z.zip} className="border-t border-white/10">
                          <td className="px-4 py-2">
                            <input type="checkbox" aria-label={`Select ZIP code ${z.zip}`} checked={picked.includes(z.zip)} onChange={() => toggle(z.zip)} className="h-5 w-5 accent-amber-400" />
                          </td>
                          <th scope="row" className="px-4 py-2 font-semibold">{z.zip}</th>
                          <td className="px-4 py-2">{z.city ? `${z.city}, ${z.state}` : "-"}</td>
                          <td className="px-4 py-2 text-right">{z.miles}</td>
                          <td className="px-4 py-2 text-right">{z.demandTotal !== null ? `~${z.demandTotal.toLocaleString("en-US")}` : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 rounded-2xl bg-white p-5 text-slate-900">
                  <h3 className="text-lg font-semibold">Lock team territories</h3>
                  {picked.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-600">Select at least one open ZIP code above.</p>
                  ) : (
                    <>
                      <p className="mt-2 text-sm text-slate-700">
                        {picked.length} ZIP code{picked.length === 1 ? "" : "s"} selected, one for each loan officer
                        {SEAT_PLAN ? `, on the ${SEAT_PLAN.name} plan at ${SEAT_PLAN.price} a month each (${picked.length} × ${SEAT_PLAN.price}). Each plan includes a 15-day trial option` : ""}.
                        A ZIP code locks to the first loan officer whose first payment goes through, so have each person complete their own checkout.
                      </p>
                      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                        {picked.map((z, i) => (
                          <li key={z}>
                            <a
                              href={payNowUrlForTier("growth", z) ?? checkoutUrlForTier("growth", z)}
                              onClick={() => track("territory_audit_lock_click", { zip: z, seat: i + 1 })}
                              className="flex min-h-[48px] items-center justify-between rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                            >
                              <span>Loan officer {i + 1}: ZIP {z}</span>
                              <span aria-hidden>Lock &rarr;</span>
                            </a>
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </div>
              </div>
            ) : audit.totals.unknown < audit.totals.evaluated ? (
              <p className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-white/80">Every ZIP code we checked near {audit.center.zip} is already claimed. Try a larger radius.</p>
            ) : null}

            <p className="text-xs text-white/60">
              Expected activity is an estimate from the territory ledger, not a promise of leads or loans. Availability can change at any time, and checking does not
              reserve a ZIP code. ZIP code names and locations: GeoNames (geonames.org), CC BY 4.0.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
