"use client";

import { useEffect, useState } from "react";
import { Card, ErrorNote } from "@/components/intelligence/dashboard-shell";
import type { AutopilotRunRecord } from "@/lib/types";

/**
 * "YPNUS improved these items for you" — a simple history log of past dry-run
 * Website Autopilot plans. Read-only: fetches /api/autopilot/runs, no writes.
 */
export function RunHistoryPanel({ refreshKey }: { refreshKey: number }) {
  const [runs, setRuns] = useState<AutopilotRunRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting loading/error at the start of each refetch (mount, and every historyRefreshKey bump) is intentional.
    setLoading(true);
    setError(null);
    fetch("/api/autopilot/runs")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.ok) {
          setError(data.error ?? "Failed to load run history.");
          return;
        }
        setRuns(data.runs as AutopilotRunRecord[]);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to reach the server. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <Card title="Run history">
      <p className="text-sm text-slate-600">YPNUS improved these items for you.</p>
      <ErrorNote error={error} />

      {loading ? <p className="mt-4 text-sm text-slate-400">Loading run history…</p> : null}

      {!loading && runs && runs.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No runs yet — generate a plan above to start your history.</p>
      ) : null}

      {!loading && runs && runs.length > 0 ? (
        <div className="mt-4 space-y-4">
          {runs.map((run) => (
            <div key={run.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{run.pageLabel || run.pageType.replace(/_/g, " ")}</p>
                  <p className="text-xs text-slate-400">{new Date(run.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {run.dryRun ? "Dry-run" : "Live"}
                  </span>
                  <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                    Score {run.score}/100
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    {run.autoAppliedCount} auto-applied
                  </span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    {run.needsApprovalCount} need approval
                  </span>
                </div>
              </div>

              <p className="mt-2 text-sm text-slate-700">{run.summaryForMlo}</p>

              {run.topChanges.length > 0 ? (
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  {run.topChanges.map((change) => (
                    <li key={change.id}>
                      <span className="font-semibold">{change.title}</span> — {change.status.replace(/_/g, " ")} (
                      {change.riskLevel} risk)
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
