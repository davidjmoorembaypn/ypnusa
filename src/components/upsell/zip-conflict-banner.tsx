"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/track";

/**
 * Shown on the dashboard when a paid plan holds no ZIP code: either another officer locked the
 * officer's pick moments before their payment went through (takenZip is set), or they paid
 * without choosing one. They pick an open one here (or ask for a refund).
 */
export function ZipConflictBanner(props: { takenZip?: string; nearby: string[]; supportEmail: string }) {
  const { takenZip, supportEmail } = props;
  const router = useRouter();
  const [nearby, setNearby] = useState(props.nearby);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const clean = typed.replace(/\D/g, "").slice(0, 5);

  async function claim(zip: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/territory/replace-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip }),
      });
      const body = (await res.json()) as { ok?: boolean; zip?: string; error?: string; nearby?: string[] };
      if (res.ok && body.ok && body.zip) {
        track("zip_conflict_resolved", { zip_changed: true });
        setLocked(body.zip);
        router.refresh();
        return;
      }
      if (Array.isArray(body.nearby)) setNearby(body.nearby);
      setMessage(body.error ?? "Couldn't lock that ZIP code. Please try another.");
    } catch {
      setMessage("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (locked) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900" role="status">
        ZIP code {locked} is now yours. Borrower requests from it come straight to you.
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950" aria-labelledby="zip-conflict-title">
      <h2 id="zip-conflict-title" className="text-base font-semibold">
        {takenZip
          ? `Pick your ZIP code: ${takenZip} was taken just before your payment went through`
          : "Pick your ZIP code: your plan is active, but no ZIP code is locked to you yet"}
      </h2>
      <p className="mt-1">
        {takenZip
          ? "Your plan is active. Choose an open ZIP code to lock it to you, or ask us for a refund."
          : "Borrower requests are routed by ZIP code, so none can reach you until you lock one. Enter an open ZIP code to lock it now."}
      </p>
      {nearby.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {nearby.map((zip) => (
            <button
              key={zip}
              type="button"
              disabled={busy}
              onClick={() => claim(zip)}
              className="rounded-full border border-amber-400 bg-white px-4 py-2 font-semibold hover:bg-amber-100 disabled:opacity-50"
            >
              Lock {zip}
            </button>
          ))}
        </div>
      ) : null}
      <form
        className="mt-3 flex max-w-sm gap-2"
        aria-label="Lock another ZIP code"
        onSubmit={(event) => {
          event.preventDefault();
          if (clean.length === 5) void claim(clean);
        }}
      >
        <input
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          value={typed}
          onChange={(event) => setTyped(event.target.value.replace(/\D/g, "").slice(0, 5))}
          placeholder={takenZip ? "Another ZIP code" : "Your ZIP code"}
          aria-label={takenZip ? "Another ZIP code" : "Your ZIP code"}
          className="min-w-0 flex-1 rounded-full border border-amber-300 bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
        <button
          type="submit"
          disabled={busy || clean.length !== 5}
          className="rounded-full bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Lock it
        </button>
      </form>
      {message ? (
        <p className="mt-2 font-medium text-amber-900" role="alert">
          {message}
        </p>
      ) : null}
      <a
        href={`mailto:${supportEmail}?subject=${encodeURIComponent(takenZip ? `Refund: ZIP code ${takenZip} was taken` : "Refund: no ZIP code on my plan")}`}
        className="mt-3 inline-block font-semibold underline underline-offset-2"
      >
        Ask for a refund instead
      </a>
    </section>
  );
}
