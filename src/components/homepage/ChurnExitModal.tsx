"use client";

/**
 * Low-friction exit-intent trap: fires at most once per session (gated by
 * useBehaviorTracking's exitTrapShown flag) when a fast upward scroll or a
 * pointer leaving through the top of the viewport suggests the visitor is
 * about to leave without converting.
 */
export function ChurnExitModal({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="churn-exit-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d0b26] p-6 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="float-right -mt-1 -mr-1 rounded-full p-1 text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
        >
          ✕
        </button>
        <h2 id="churn-exit-modal-title" className="text-xl font-semibold">
          Before you go — grab your ZIP demand snapshot
        </h2>
        <p className="mt-2 text-sm text-white/75">
          Takes 15 seconds, no account needed. See how much unclaimed borrower demand is sitting in your ZIP code
          right now.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="#territories"
            onClick={onDismiss}
            className="inline-flex items-center justify-center rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-[#09081b] shadow-lg shadow-amber-500/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            Show me my ZIP
          </a>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex items-center justify-center rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
