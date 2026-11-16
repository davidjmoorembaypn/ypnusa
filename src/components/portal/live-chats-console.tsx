"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { formatDateTime } from "@/lib/format";

/**
 * Live Takeover console: the officer's borrower chats, refreshed every 5 seconds.
 * "Take over" pauses Cerebro on that chat, the officer replies as themselves, and
 * "Hand back" lets Cerebro answer again.
 */

interface ChatSummary {
  sessionId: string;
  borrowerLabel: string;
  handledBy: "ai" | "officer";
  status: string;
  updatedAt: string;
  messageCount: number;
  awaitingReply: boolean;
  lastMessagePreview: string;
}

interface ChatDetail {
  sessionId: string;
  handledBy: "ai" | "officer";
  status: string;
  updatedAt: string;
  borrowerName: string | null;
  messages: Array<{ id: string; from: "borrower" | "cerebro" | "officer"; content: string; createdAt: string }>;
}

const POLL_MS = 5_000;

export function LiveChatsConsole() {
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChatDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/live-chats", { cache: "no-store" });
      const body = (await res.json()) as { ok?: boolean; chats?: ChatSummary[] };
      if (body.ok && Array.isArray(body.chats)) setChats(body.chats);
    } catch {
      // Next poll tries again.
    }
  }, []);

  const loadDetail = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/live-chats/${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      const body = (await res.json()) as { ok?: boolean; chat?: ChatDetail };
      if (body.ok && body.chat) setDetail(body.chat);
    } catch {
      // Next poll tries again.
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void loadList(), 0);
    const timer = window.setInterval(() => void loadList(), POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [loadList]);

  useEffect(() => {
    if (!selected) return;
    const first = window.setTimeout(() => void loadDetail(selected), 0);
    const timer = window.setInterval(() => void loadDetail(selected), POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [selected, loadDetail]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [detail?.messages.length]);

  async function act(action: "take_over" | "hand_back" | "reply", message?: string) {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/live-chats/${encodeURIComponent(selected)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message }),
      });
      const body = (await res.json()) as { ok?: boolean; chat?: ChatDetail; error?: string };
      if (!body.ok || !body.chat) {
        setError(body.error ?? "That didn't work. Try again.");
        return;
      }
      setDetail(body.chat);
      if (action === "reply") setDraft("");
      void loadList();
    } catch {
      setError("Couldn't connect. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (message) void act("reply", message);
  }

  const takenOver = detail?.handledBy === "officer";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <section aria-label="Chats" className="rounded-3xl border border-white/10 bg-white/[0.06] p-3">
        {chats === null ? (
          <p className="p-4 text-sm text-white/60">Loading chats...</p>
        ) : chats.length === 0 ? (
          <p className="p-4 text-sm leading-6 text-white/60">
            No borrower chats in the last 7 days. Chats from your page show up here as they happen.
          </p>
        ) : (
          <ul className="space-y-1">
            {chats.map((chat) => (
              <li key={chat.sessionId}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(chat.sessionId);
                    setDetail(null);
                    setError(null);
                  }}
                  className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                    selected === chat.sessionId ? "bg-violet-500/20" : "hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{chat.borrowerLabel}</span>
                    {chat.handledBy === "officer" ? (
                      <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                        You
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/70">
                        Cerebro
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-xs text-white/60">{chat.lastMessagePreview}</span>
                  <span className="mt-1 block text-[11px] text-white/50">
                    {formatDateTime(chat.updatedAt)}
                    {chat.awaitingReply && chat.handledBy === "officer" ? " · waiting for you" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Conversation" className="flex min-h-[28rem] flex-col rounded-3xl border border-white/10 bg-white/[0.06] p-4">
        {!selected ? (
          <p className="m-auto text-sm text-white/60">Pick a chat to read it.</p>
        ) : !detail ? (
          <p className="m-auto text-sm text-white/60">Loading...</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{detail.borrowerName ?? "New visitor"}</p>
                <p className="text-xs text-white/60">
                  {takenOver ? "You're answering. Cerebro is paused." : "Cerebro is answering."}
                </p>
              </div>
              {takenOver ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("hand_back")}
                  className="min-h-11 rounded-full border border-white/20 px-5 text-sm font-semibold text-white/85 hover:bg-white/10 disabled:opacity-50"
                >
                  Hand back to Cerebro
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("take_over")}
                  className="min-h-11 rounded-full bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  Take over
                </button>
              )}
            </div>

            <div ref={scrollerRef} className="mt-4 flex max-h-[55vh] flex-1 flex-col gap-3 overflow-y-auto rounded-2xl bg-black/20 p-4">
              {detail.messages.map((message) => (
                <article
                  key={message.id}
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    message.from === "borrower"
                      ? "self-start bg-white/10"
                      : message.from === "officer"
                        ? "self-end bg-emerald-600/80"
                        : "self-end bg-violet-600/60"
                  }`}
                >
                  <span className="mb-1 block text-[11px] font-semibold text-white/70">
                    {message.from === "borrower" ? "Borrower" : message.from === "officer" ? "You" : "Cerebro"} ·{" "}
                    {formatDateTime(message.createdAt)}
                  </span>
                  {message.content}
                </article>
              ))}
            </div>

            {error ? <p className="mt-3 text-sm text-amber-200">{error}</p> : null}

            {takenOver ? (
              <form onSubmit={submit} className="mt-3 flex gap-2">
                <label htmlFor="officer-reply" className="sr-only">
                  Your reply
                </label>
                <input
                  id="officer-reply"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={busy}
                  placeholder="Type your reply..."
                  className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-black/20 px-4 text-base outline-none focus:border-violet-400"
                />
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  className="h-11 shrink-0 rounded-full bg-emerald-600 px-5 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            ) : (
              <p className="mt-3 text-xs text-white/50">Take over to reply yourself.</p>
            )}
            <p className="mt-2 text-[11px] text-white/50">
              Your replies go to the borrower as you. Don&apos;t quote rates or approval in chat.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
