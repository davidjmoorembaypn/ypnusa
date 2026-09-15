/**
 * Shared "this is a stub" banner for silo route placeholders. Keeps the
 * disclaimer visually distinct from real product copy so it can't be
 * mistaken for shipped content while the silo is being built out.
 */
export function StubNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 max-w-2xl rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-5 text-amber-200/80">
      <strong className="font-semibold text-amber-200">Placeholder route.</strong> {children}
    </p>
  );
}
