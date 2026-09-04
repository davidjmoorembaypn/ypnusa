"use client";

import { useState } from "react";
import { Card, ErrorNote, GenerateButton } from "@/components/intelligence/dashboard-shell";
import { RunHistoryPanel } from "@/components/autopilot/run-history-panel";
import type { AutopilotChangeStatus, AutopilotPageType, AutopilotRiskLevel } from "@/lib/types";
import type { LeadGoal, WebsiteAutopilotPlan } from "@/lib/ai/website-autopilot";

const PAGE_TYPES: { value: AutopilotPageType; label: string }[] = [
  { value: "profile", label: "Profile" },
  { value: "landing_page", label: "Homepage / landing page" },
  { value: "seo", label: "SEO" },
  { value: "chatbot", label: "Chatbot flow" },
  { value: "lead_form", label: "Lead form" },
];

const LEAD_GOALS: { value: LeadGoal; label: string }[] = [
  { value: "buyer", label: "Buyer" },
  { value: "seller", label: "Seller" },
  { value: "refinance", label: "Refinance" },
  { value: "all", label: "All" },
];

const RISK_STYLES: Record<AutopilotRiskLevel, string> = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-rose-100 text-rose-800",
};

const STATUS_LABELS: Record<AutopilotChangeStatus, string> = {
  proposed: "Proposed",
  auto_applied: "Would auto-apply",
  needs_approval: "Needs approval",
  rejected: "Rejected",
  rolled_back: "Rolled back",
};

interface PlanResponse {
  dryRun: boolean;
  pageLabel?: string;
  plan: WebsiteAutopilotPlan;
  wordpress: { enabled: boolean; autoApplyLowRisk: boolean; configured: boolean };
}

const inputClass =
  "w-full rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none";
const textareaClass =
  "w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none";

export function AutopilotPanel() {
  const [pageLabel, setPageLabel] = useState("");
  const [pageType, setPageType] = useState<AutopilotPageType>("profile");
  const [targetAudience, setTargetAudience] = useState("");
  const [marketCity, setMarketCity] = useState("");
  const [marketState, setMarketState] = useState("");
  const [leadGoal, setLeadGoal] = useState<LeadGoal>("all");
  const [currentCopy, setCurrentCopy] = useState("");
  const [currentChatbotIntro, setCurrentChatbotIntro] = useState("");
  const [existingSeoTitle, setExistingSeoTitle] = useState("");
  const [existingMetaDescription, setExistingMetaDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/autopilot/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageLabel: pageLabel || undefined,
          pageType,
          targetAudience: targetAudience || undefined,
          marketCity: marketCity || undefined,
          marketState: marketState || undefined,
          leadGoal,
          currentCopy: currentCopy || undefined,
          currentChatbotIntro: currentChatbotIntro || undefined,
          existingSeoTitle: existingSeoTitle || undefined,
          existingMetaDescription: existingMetaDescription || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to generate the plan.");
        return;
      }
      setResult(data as PlanResponse);
      setHistoryRefreshKey((n) => n + 1);
    } catch {
      setError("Failed to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card title="Generate a dry-run improvement plan">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={pageLabel}
            onChange={(e) => setPageLabel(e.target.value)}
            placeholder="URL or page name"
            className={`${inputClass} sm:col-span-2`}
          />
          <select value={pageType} onChange={(e) => setPageType(e.target.value as AutopilotPageType)} className={inputClass}>
            {PAGE_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select value={leadGoal} onChange={(e) => setLeadGoal(e.target.value as LeadGoal)} className={inputClass}>
            {LEAD_GOALS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label} leads
              </option>
            ))}
          </select>
          <input
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="Target audience"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={marketCity}
              onChange={(e) => setMarketCity(e.target.value)}
              placeholder="Market city"
              className={inputClass}
            />
            <input
              value={marketState}
              onChange={(e) => setMarketState(e.target.value)}
              placeholder="Market state"
              className={inputClass}
            />
          </div>
          <textarea
            value={currentCopy}
            onChange={(e) => setCurrentCopy(e.target.value)}
            placeholder="Current profile/page copy"
            rows={4}
            className={`${textareaClass} sm:col-span-2`}
          />
          <textarea
            value={currentChatbotIntro}
            onChange={(e) => setCurrentChatbotIntro(e.target.value)}
            placeholder="Current chatbot intro (optional)"
            rows={2}
            className={`${textareaClass} sm:col-span-2`}
          />
          <input
            value={existingSeoTitle}
            onChange={(e) => setExistingSeoTitle(e.target.value)}
            placeholder="Existing SEO title (optional)"
            className={inputClass}
          />
          <input
            value={existingMetaDescription}
            onChange={(e) => setExistingMetaDescription(e.target.value)}
            placeholder="Existing SEO meta description (optional)"
            className={inputClass}
          />
        </div>

        <div className="mt-5">
          <GenerateButton onClick={generate} loading={loading}>
            Generate dry-run improvement plan
          </GenerateButton>
        </div>

        <ErrorNote error={error} />
      </Card>

      {result ? <ResultPanel result={result} pageLabelFallback={pageLabel} /> : null}

      <RunHistoryPanel refreshKey={historyRefreshKey} />
    </div>
  );
}

function ResultPanel({ result, pageLabelFallback }: { result: PlanResponse; pageLabelFallback: string }) {
  const { plan, wordpress } = result;
  const label = result.pageLabel || pageLabelFallback;

  return (
    <Card title={label ? `Plan for ${label}` : "Plan"}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
          Dry-run — preview only
        </span>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
          Score {plan.score}/100
        </span>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
          {plan.autoAppliedCount} would auto-apply
        </span>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          {plan.needsApprovalCount} need approval
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          WordPress Autopilot: {wordpress.enabled ? "enabled" : "off (dry-run)"}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-700">{plan.summaryForMlo}</p>

      <p className="mt-3 text-xs font-medium text-slate-500">
        No live website changes were made. This is a dry-run plan.
      </p>

      <div className="mt-6 space-y-4">
        {plan.changes.map((change) => (
          <div key={change.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{change.title}</h3>
              <div className="flex gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${RISK_STYLES[change.riskLevel]}`}>
                  {change.riskLevel} risk
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {STATUS_LABELS[change.status]}
                </span>
              </div>
            </div>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{change.changeType.replace(/_/g, " ")}</p>

            {change.beforeText ? (
              <p className="mt-3 text-sm text-slate-500 line-through">{change.beforeText}</p>
            ) : null}
            <p className="mt-1 text-sm text-slate-800">{change.afterText}</p>

            <p className="mt-2 text-xs text-slate-500">
              <span className="font-semibold">Why: </span>
              {change.reason}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              <span className="font-semibold">Expected benefit: </span>
              {change.expectedBenefit}
            </p>
            {change.rollbackNote ? (
              <p className="mt-1 text-xs text-slate-400">
                <span className="font-semibold">Rollback: </span>
                {change.rollbackNote}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
