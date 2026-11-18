"use client";

import { useState } from "react";
import { track } from "@/lib/track";

export interface ArticleView {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

/**
 * The officer's LinkedIn article drafts. "Copy and open LinkedIn" copies the article (title
 * first) and opens LinkedIn's "Write article" page in a new tab, where the officer pastes it
 * and posts from their own profile. Nothing is ever posted for them.
 */
export function LinkedInArticles({
  initial,
  left,
  allowanceLabel,
  canDraft,
  blockedReason,
  linkedinUrl,
}: {
  initial: ArticleView[];
  left: number;
  allowanceLabel: string;
  canDraft: boolean;
  blockedReason?: string;
  linkedinUrl: string;
}) {
  const [articles, setArticles] = useState(initial);
  const [remaining, setRemaining] = useState(left);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(initial[0]?.id ?? null);

  async function draft() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/marketing-kit/linkedin", { method: "POST" });
      const data = (await response.json().catch(() => null)) as
        | { ok: true; article: ArticleView; left: number }
        | { ok: false; error: string }
        | null;
      if (!data || !data.ok) {
        setError(data && !data.ok ? data.error : "Unable to draft your article. Please try again.");
        return;
      }
      setArticles((current) => [data.article, ...current]);
      setRemaining(data.left);
      setOpenId(data.article.id);
      track("linkedin_article_drafted");
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyAndOpen(article: ArticleView) {
    try {
      await navigator.clipboard.writeText(`${article.title}\n\n${article.body}`);
      setCopiedId(article.id);
      setTimeout(() => setCopiedId(null), 4000);
    } catch {
      /* clipboard blocked: the text is still selectable below */
    }
    track("linkedin_article_copied");
    window.open(linkedinUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <p className="text-sm text-slate-600">
        {allowanceLabel}
        {canDraft ? ` · ${remaining} left to draft now` : null}
      </p>

      {canDraft ? (
        <button
          type="button"
          onClick={draft}
          disabled={busy || remaining <= 0}
          className="mt-3 inline-flex rounded-full bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? "Cerebro is writing…" : remaining > 0 ? "Write my next article" : "Next article unlocks next month"}
        </button>
      ) : blockedReason ? (
        <p className="mt-3 text-sm text-slate-700">{blockedReason}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {articles.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {articles.map((article) => {
            const open = openId === article.id;
            return (
              <li key={article.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : article.id)}
                  aria-expanded={open}
                  className="w-full text-left text-sm font-semibold text-slate-900"
                >
                  {article.title}
                  <span className="ml-2 font-normal text-slate-500">
                    {new Date(article.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </button>
                {open ? (
                  <>
                    <div className="mt-3 max-h-80 overflow-y-auto whitespace-pre-line rounded-xl bg-white p-3 text-sm leading-6 text-slate-800">
                      {article.body}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyAndOpen(article)}
                      className="mt-3 inline-flex rounded-full bg-[#0a66c2] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#004182]"
                    >
                      {copiedId === article.id ? "Copied: paste it into LinkedIn" : "Copy and open LinkedIn"}
                    </button>
                    <p className="mt-2 text-xs text-slate-500">
                      Read it over first. If your company&apos;s compliance team reviews social posts, send it to them before you post.
                    </p>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
