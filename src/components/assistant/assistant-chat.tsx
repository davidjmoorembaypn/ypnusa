"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { AssistantMode, ChatCapturedFields } from "@/lib/types";

type BubbleRole = "user" | "assistant" | "system";

interface Bubble {
  id: string;
  role: BubbleRole;
  body: string;
}

interface ChatApiSuccess {
  ok: true;
  sessionId: string;
  reply: string;
  capturedFields: ChatCapturedFields;
  summary?: string;
  leadScore?: number;
  recommendedAction?: string;
  status: "active" | "qualified" | "closed";
  borrowerLeadId?: string;
  crmLeadId?: string;
  providerConfigured: boolean;
  autopilot?: {
    summaryForMlo: string;
    autoAppliedCount: number;
    needsApprovalCount: number;
    dryRun: boolean;
    topChanges: Array<{ title: string; status: string; riskLevel: string; expectedBenefit: string }>;
  };
}

interface ChatApiFailure {
  ok: false;
  error: string;
  code?: string;
}

type ChatApiResponse = ChatApiSuccess | ChatApiFailure;

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

const CAPTURED_FIELD_ROWS: Array<{ key: keyof ChatCapturedFields; label: string }> = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "leadType", label: "Lead type" },
  { key: "urgency", label: "Urgency" },
  { key: "consent", label: "Consent" },
];

function formatCapturedValue(value: string | boolean | undefined): string {
  if (value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
}

/** Per-mode localStorage key so the three tabs on /assistant never cross-resume each other's session. */
function storageKeyFor(mode: AssistantMode): string {
  return `ypn_assistant_session_${mode}`;
}

export function AssistantChat(props: {
  mode: AssistantMode;
  funnelSource?: string;
  title?: string;
  placeholder?: string;
}) {
  const { mode, funnelSource } = props;
  const title = props.title ?? "Assistant";
  const placeholder = props.placeholder ?? "Type a message…";

  const [msgs, setMsgs] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null);

  const [capturedFields, setCapturedFields] = useState<ChatCapturedFields>({});
  const [summary, setSummary] = useState<string | undefined>(undefined);
  const [leadScore, setLeadScore] = useState<number | undefined>(undefined);
  const [recommendedAction, setRecommendedAction] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<ChatApiSuccess["status"] | undefined>(undefined);
  const [borrowerLeadId, setBorrowerLeadId] = useState<string | undefined>(undefined);
  const [crmLeadId, setCrmLeadId] = useState<string | undefined>(undefined);
  const [autopilot, setAutopilot] = useState<ChatApiSuccess["autopilot"]>(undefined);

  const sessionIdRef = useRef<string | null>(null);
  const hasHydratedRef = useRef(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputId = `assistant-chat-input-${mode}`;

  useEffect(() => {
    if (hasHydratedRef.current) return;
    hasHydratedRef.current = true;
    try {
      const stored = window.localStorage.getItem(storageKeyFor(mode));
      if (stored) sessionIdRef.current = stored;
    } catch {
      /** noop — private browsing / disabled storage just means no resume */
    }
  }, [mode]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    queueMicrotask(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [msgs, busy]);

  const rememberSession = useCallback(
    (id: string) => {
      sessionIdRef.current = id;
      try {
        window.localStorage.setItem(storageKeyFor(mode), id);
      } catch {
        /** noop */
      }
    },
    [mode],
  );

  function pushBubble(role: BubbleRole, body: string) {
    const trimmed = body.trim();
    if (!trimmed) return;
    setMsgs((prev) => [...prev, { id: makeId(role.slice(0, 2)), role, body: trimmed }]);
  }

  async function sendMessage(message: string) {
    if (!message || busy || authRequired) return;

    pushBubble("user", message);
    setDraft("");
    setBusy(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          message,
          sessionId: sessionIdRef.current ?? undefined,
          funnelSource,
        }),
      });

      const body = (await res.json()) as ChatApiResponse;

      if (!body.ok) {
        if (res.status === 401 && body.code === "UNAUTHENTICATED") {
          setAuthRequired(true);
          return;
        }
        if (res.status === 429) {
          pushBubble("system", "You're sending messages a little fast — please slow down and try again.");
          return;
        }
        pushBubble("system", body.error || "Something went wrong. Please try again.");
        return;
      }

      rememberSession(body.sessionId);
      pushBubble("assistant", body.reply);
      setProviderConfigured(body.providerConfigured);

      if (mode === "lead_qualification") {
        setCapturedFields(body.capturedFields);
        setSummary(body.summary);
        setLeadScore(body.leadScore);
        setRecommendedAction(body.recommendedAction);
        setStatus(body.status);
        setBorrowerLeadId(body.borrowerLeadId);
        setCrmLeadId(body.crmLeadId);
      }
      if (mode === "mlo_dashboard" && body.autopilot) {
        setAutopilot(body.autopilot);
      }
    } catch {
      pushBubble("system", "Network error — please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    await sendMessage(message);
  }

  const showCapturedPanel = mode === "lead_qualification";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 shadow-2xl shadow-black/20 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {status ? (
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">
            {status}
          </span>
        ) : null}
      </div>

      {providerConfigured === false ? (
        <p className="mt-2 text-xs leading-5 text-amber-200/70">
          Running without an AI provider connected yet — replies are canned until{" "}
          <code className="text-amber-200/90">ANTHROPIC_API_KEY</code> is configured.
        </p>
      ) : null}

      <div className={`mt-4 grid gap-4 ${showCapturedPanel ? "lg:grid-cols-[1.3fr_0.9fr]" : ""}`}>
        <div className="flex min-w-0 flex-col gap-3">
          <div
            ref={scrollerRef}
            className="flex h-80 flex-col gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            {msgs.length === 0 ? (
              <p className="m-auto max-w-xs text-center text-sm text-white/40">
                Say hello to start the conversation.
              </p>
            ) : null}

            {msgs.map((bubble) => (
              <article
                key={bubble.id}
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  bubble.role === "assistant"
                    ? "self-start rounded-bl-[4px] bg-white/10 text-white ring-1 ring-white/10"
                    : bubble.role === "user"
                      ? "self-end rounded-br-[4px] bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-md shadow-violet-950/30"
                      : "self-center text-center text-xs italic text-white/45"
                }`}
              >
                {bubble.body}
              </article>
            ))}

            {busy ? (
              <article className="self-start rounded-2xl rounded-bl-[4px] bg-white/10 px-4 py-2.5 text-sm text-white/50 ring-1 ring-white/10">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50" />
                </span>
              </article>
            ) : null}
          </div>

          {authRequired ? (
            <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              Sign in to use this assistant.{" "}
              <Link href="/login" className="font-semibold underline underline-offset-2">
                Go to login
              </Link>
              .
            </div>
          ) : null}

          {mode === "mlo_dashboard" && msgs.length === 0 && !authRequired ? (
            <button
              type="button"
              onClick={() => sendMessage("Improve my website/profile for me.")}
              className="self-start rounded-full border border-violet-400/40 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20"
            >
              Improve my website/profile for me.
            </button>
          ) : null}

          <form onSubmit={submit} className="flex gap-2">
            <label htmlFor={inputId} className="sr-only">
              Message
            </label>
            <input
              id={inputId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={busy || authRequired}
              type="text"
              placeholder={placeholder}
              className="h-11 flex-1 rounded-full border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy || authRequired || !draft.trim()}
              className="h-11 shrink-0 rounded-full bg-gradient-to-r from-violet-500 to-violet-700 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </form>

          {mode === "mlo_dashboard" && autopilot ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
                  Website Autopilot
                </p>
                {autopilot.dryRun ? (
                  <span className="shrink-0 rounded-full border border-sky-300/30 bg-sky-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                    Preview only — no live changes made
                  </span>
                ) : null}
              </div>
              <p className="text-white/85">{autopilot.summaryForMlo}</p>
              <p className="text-white/60">
                <span className="font-semibold text-emerald-300">{autopilot.autoAppliedCount}</span> applied
                automatically ·{" "}
                <span className="font-semibold text-amber-300">{autopilot.needsApprovalCount}</span> held for
                review
              </p>
              {autopilot.topChanges.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {autopilot.topChanges.map((change, idx) => (
                    <li key={idx} className="text-white/70">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{change.title}</span>
                        <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/50">
                          {change.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="truncate text-xs text-white/40">{change.expectedBenefit}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        {showCapturedPanel ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
              Captured fields
            </p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {CAPTURED_FIELD_ROWS.map((row) => (
                <div key={row.key} className="contents">
                  <dt className="text-white/45">{row.label}</dt>
                  <dd className="truncate text-white/90">{formatCapturedValue(capturedFields[row.key])}</dd>
                </div>
              ))}
            </dl>

            {leadScore !== undefined || summary || recommendedAction ? (
              <div className="mt-1 space-y-2 border-t border-white/10 pt-3 text-sm">
                {leadScore !== undefined ? (
                  <p>
                    <span className="text-white/45">Lead score: </span>
                    <span className="font-semibold text-white">{leadScore}/100</span>
                  </p>
                ) : null}
                {summary ? (
                  <p>
                    <span className="text-white/45">Summary: </span>
                    <span className="text-white/85">{summary}</span>
                  </p>
                ) : null}
                {recommendedAction ? (
                  <p>
                    <span className="text-white/45">Recommended action: </span>
                    <span className="text-white/85">{recommendedAction}</span>
                  </p>
                ) : null}
              </div>
            ) : null}

            {borrowerLeadId || crmLeadId ? (
              <div className="mt-1 space-y-1 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm">
                <p className="font-semibold text-emerald-200">Lead linked</p>
                {borrowerLeadId ? (
                  <p className="text-emerald-100/80">
                    Lead type: Borrower Lead
                    <br />
                    ID: <span className="font-mono text-xs">{borrowerLeadId}</span>
                  </p>
                ) : null}
                {crmLeadId ? (
                  <p className="text-emerald-100/80">
                    Lead type: CRM/MLO Lead
                    <br />
                    ID: <span className="font-mono text-xs">{crmLeadId}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
