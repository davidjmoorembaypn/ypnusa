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
  providerConfigured: boolean;
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
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
      }
    } catch {
      pushBubble("system", "Network error — please check your connection and try again.");
    } finally {
      setBusy(false);
    }
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
          </div>
        ) : null}
      </div>
    </div>
  );
}
