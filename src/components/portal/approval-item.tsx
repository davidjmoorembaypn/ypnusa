"use client";

import { useId, useState } from "react";

export interface ApprovalItemProps {
  id: string;
  /** The draft's version when the page loaded; sent back so an unseen rewrite is never approved. */
  version: string;
  kindLabel: string;
  borrower: string;
  channelLabel: string;
  createdLabel: string;
  preferredWindow?: string;
  needsYou?: string;
  subject?: string;
  body: string;
  /** True when approving makes Cerebro email it; false when the officer sends it themselves. */
  cerebroSends: boolean;
  maxLength: number;
  maxSubjectLength: number;
}

type Outcome =
  | { kind: "idle" }
  | { kind: "saving"; decision: "approve" | "dismiss" }
  | { kind: "error"; message: string; problems: string[] }
  | { kind: "done"; message: string; finalText?: string };

/** One draft waiting on the loan officer: read it, change the wording, then approve or dismiss. */
export function ApprovalItem(props: ApprovalItemProps) {
  const fieldId = useId();
  const subjectId = useId();
  const [text, setText] = useState(props.body);
  const [subject, setSubject] = useState(props.subject ?? "");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const saving = outcome.kind === "saving";

  async function decide(decision: "approve" | "dismiss") {
    setOutcome({ kind: "saving", decision });
    try {
      const response = await fetch("/api/cerebro/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: props.id,
          version: props.version,
          decision,
          ...(decision === "approve" && text !== props.body ? { body: text } : {}),
          ...(decision === "approve" && props.subject !== undefined && subject.trim() && subject !== props.subject ? { subject } : {}),
        }),
      });
      const data: { ok?: boolean; error?: string; problems?: string[] } = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        setOutcome({ kind: "error", message: data.error ?? "Couldn't save that. Please try again.", problems: data.problems ?? [] });
        return;
      }
      if (decision === "dismiss") {
        setOutcome({ kind: "done", message: "Dismissed. Nothing was sent." });
      } else if (props.cerebroSends) {
        setOutcome({
          kind: "done",
          message: "Approved. Cerebro emails it within 5 minutes. If consent or a compliance check blocks it, it comes back here with the reason.",
        });
      } else {
        setOutcome({ kind: "done", message: "Approved. Cerebro does not send this kind: copy the text below and send it yourself.", finalText: text });
      }
    } catch {
      setOutcome({ kind: "error", message: "Couldn't reach the server. Check your connection and try again.", problems: [] });
    }
  }

  if (outcome.kind === "done") {
    return (
      <li className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
        <p role="status" className="font-semibold">
          {props.kindLabel} for {props.borrower}: {outcome.message}
        </p>
        {outcome.finalText ? <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-4 font-sans text-sm text-slate-800">{outcome.finalText}</pre> : null}
      </li>
    );
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">
          {props.kindLabel} for {props.borrower}
        </h3>
        <p className="text-sm text-slate-600">
          {props.channelLabel} · {props.createdLabel}
        </p>
      </div>
      {props.needsYou ? <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">{props.needsYou}</p> : null}
      {props.preferredWindow ? <p className="mt-2 text-sm text-slate-700">Best time to reach them: {props.preferredWindow}</p> : null}
      {props.subject !== undefined ? (
        <>
          <label htmlFor={subjectId} className="mt-3 block text-sm font-semibold text-slate-800">
            Subject
          </label>
          <input
            id={subjectId}
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={props.maxSubjectLength}
            disabled={saving}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </>
      ) : null}

      <label htmlFor={fieldId} className="mt-3 block text-sm font-semibold text-slate-800">
        Message (you can edit it)
      </label>
      <textarea
        id={fieldId}
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={props.maxLength}
        rows={Math.min(14, Math.max(5, text.split("\n").length + 2))}
        disabled={saving}
        className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm leading-relaxed text-slate-900 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-200"
      />

      {outcome.kind === "error" ? (
        <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          <p className="font-semibold">{outcome.message}</p>
          {outcome.problems.length ? (
            <ul className="mt-1 list-disc pl-5">
              {outcome.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => decide("approve")}
          disabled={saving || text.trim().length === 0}
          className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
        >
          {saving && outcome.decision === "approve" ? "Saving…" : props.cerebroSends ? "Approve and send" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => decide("dismiss")}
          disabled={saving}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          {saving && outcome.decision === "dismiss" ? "Saving…" : "Dismiss"}
        </button>
        <p className="text-sm text-slate-600">
          {props.cerebroSends ? "Cerebro emails it after you approve." : "Cerebro does not send this kind. You send it yourself after approving."}
        </p>
      </div>
    </li>
  );
}
