"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { marketingUrl } from "@/lib/site";
import { RichText } from "./rich-text";

/**
 * Borrower chat on a loan officer's own page (/lo/[slug]). Cerebro answers as the officer's
 * AI assistant; when the officer takes over (Live Takeover), Cerebro goes quiet and this
 * chat polls every 5 seconds for the officer's replies.
 */

type From = "borrower" | "cerebro" | "officer" | "system";

interface Bubble {
  id: string;
  from: From;
  body: string;
}

interface HistoryMessage {
  role: string;
  content: string;
  author?: string;
}

/** While the officer has the chat: check for their replies every 5 seconds. */
const POLL_MS = 5_000;
/** While Cerebro has it: check every 10 seconds whether the officer has stepped in. */
const IDLE_POLL_MS = 10_000;

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

function toBubbles(messages: HistoryMessage[]): Bubble[] {
  return messages
    .filter((message) => (message.role === "user" || message.role === "assistant") && message.content.trim())
    .map((message, index) => ({
      id: `h${index}`,
      from: message.role === "user" ? "borrower" : message.author === "officer" ? "officer" : "cerebro",
      body: message.content.trim(),
    }));
}

export function OfficerPageChat(props: {
  officerSlug: string;
  officerFirstName: string;
  /** Disclosure lines from the compliance engine (name + NMLS, company NMLS, Equal Housing). */
  disclosures: string[];
}) {
  const { officerSlug, officerFirstName, disclosures } = props;
  const storageKey = `ypn_officer_chat_${officerSlug}`;
  const [msgs, setMsgs] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [humanMode, setHumanMode] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  // A poll must not replace the bubbles while a message is on its way.
  const busyRef = useRef(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputId = `officer-chat-${officerSlug}`;

  const refresh = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || busyRef.current) return;
    const params = new URLSearchParams({ mode: "lead_qualification", sessionId });
    try {
      const res = await fetch(`/api/assistant/chat?${params.toString()}`);
      if (!res.ok) return;
      const body = (await res.json()) as { ok?: boolean; messages?: HistoryMessage[]; handledBy?: string };
      if (!body.ok || !Array.isArray(body.messages) || busyRef.current) return;
      const restored = toBubbles(body.messages);
      if (restored.length > 0) setMsgs(restored);
      setHumanMode(body.handledBy === "officer");
    } catch {
      // Offline for a moment: the next poll tries again.
    }
  }, []);

  useEffect(() => {
    try {
      sessionIdRef.current = window.localStorage.getItem(storageKey);
    } catch {
      sessionIdRef.current = null;
    }
    const timer = window.setTimeout(() => setHasSession(Boolean(sessionIdRef.current)), 0);
    void refresh();
    return () => window.clearTimeout(timer);
  }, [storageKey, refresh]);

  // Poll whenever this borrower has a chat, so an officer who takes over (and their replies)
  // shows up without the borrower sending another message. Skipped while the tab is hidden.
  useEffect(() => {
    if (!hasSession) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, humanMode ? POLL_MS : IDLE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [hasSession, humanMode, refresh]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy]);

  async function send(message: string) {
    if (!message || busy) return;
    setMsgs((prev) => [...prev, { id: makeId("u"), from: "borrower", body: message }]);
    setDraft("");
    setFailed(null);
    setBusy(true);
    busyRef.current = true;
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "lead_qualification",
          message,
          sessionId: sessionIdRef.current ?? undefined,
          officerSlug,
          funnelSource: `lo-chat-${officerSlug}`.slice(0, 64),
        }),
      });
      const body = res.headers.get("content-type")?.includes("application/json")
        ? ((await res.json()) as { ok?: boolean; sessionId?: string; reply?: string; humanMode?: boolean })
        : null;
      if (!res.ok || !body?.ok || !body.sessionId) {
        setFailed(message);
        setMsgs((prev) => [
          ...prev,
          { id: makeId("s"), from: "system", body: "That didn't go through. Tap Retry to send it again." },
        ]);
        return;
      }
      sessionIdRef.current = body.sessionId;
      setHasSession(true);
      try {
        window.localStorage.setItem(storageKey, body.sessionId);
      } catch {
        // Private browsing: the chat just won't resume after a reload.
      }
      setHumanMode(body.humanMode === true);
      if (body.reply?.trim()) {
        setMsgs((prev) => [...prev, { id: makeId("a"), from: "cerebro", body: body.reply!.trim() }]);
      }
    } catch {
      setFailed(message);
      setMsgs((prev) => [
        ...prev,
        { id: makeId("s"), from: "system", body: "Couldn't connect. Check your connection, then tap Retry." },
      ]);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(draft.trim());
  }

  return (
    <section
      aria-label={`Chat with ${officerFirstName}'s assistant`}
      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Questions? Chat with {officerFirstName}&apos;s assistant</h2>
        {humanMode ? (
          <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            {officerFirstName} is here
          </span>
        ) : null}
      </div>

      <div
        ref={scrollerRef}
        className="mt-4 flex h-80 flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4"
      >
        {msgs.length === 0 ? (
          <p className="m-auto max-w-xs text-center text-sm text-slate-500">
            Ask about buying, selling or refinancing. Say hello to start.
          </p>
        ) : null}
        {msgs.map((bubble) => (
          <article
            key={bubble.id}
            className={`max-w-[85%] break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              bubble.from === "borrower"
                ? "self-end whitespace-pre-wrap rounded-br-[4px] bg-violet-700 text-white"
                : bubble.from === "system"
                  ? "self-center text-center text-xs italic text-slate-500"
                  : "self-start rounded-bl-[4px] bg-white text-slate-900 ring-1 ring-slate-200"
            }`}
          >
            {bubble.from === "officer" ? (
              <p className="mb-1 text-xs font-semibold text-emerald-700">{officerFirstName}</p>
            ) : null}
            {bubble.from === "cerebro" ? (
              <RichText text={bubble.body} linkClassName="font-semibold text-violet-700 underline underline-offset-2" />
            ) : (
              <span className="whitespace-pre-wrap">{bubble.body}</span>
            )}
          </article>
        ))}
        {busy && !humanMode ? (
          <article className="self-start rounded-2xl bg-white px-4 py-2.5 text-sm text-slate-400 ring-1 ring-slate-200">
            Typing...
          </article>
        ) : null}
      </div>

      {failed && !busy ? (
        <button
          type="button"
          onClick={() => void send(failed)}
          className="mt-3 min-h-11 rounded-full border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-900"
        >
          Retry
        </button>
      ) : null}

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Message
        </label>
        <input
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={busy}
          type="text"
          placeholder="Type your question..."
          className="h-11 min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="h-11 shrink-0 rounded-full bg-violet-700 px-5 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-40"
        >
          Send
        </button>
      </form>

      <p className="mt-3 text-[11px] leading-4 text-slate-500">
        {humanMode
          ? `You're chatting with ${officerFirstName}. `
          : `You're chatting with ${officerFirstName}'s AI assistant, not ${officerFirstName}. `}
        Chats are saved so {officerFirstName} can follow up. This isn&apos;t a loan offer or a rate quote. Please
        don&apos;t share Social Security or account numbers.{" "}
        <a href={marketingUrl("/privacy-policy")} target="_blank" rel="noopener noreferrer" className="underline">
          Privacy Policy
        </a>
      </p>
      {disclosures.length > 0 ? (
        <p className="mt-1 text-[11px] leading-4 text-slate-500">{disclosures.join(" · ")}</p>
      ) : null}
    </section>
  );
}
