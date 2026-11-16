import { TrackedLink } from "@/components/tracked-link";

/**
 * Slim bar pinned to the bottom of the screen on phones only (hidden from md up), so the
 * ZIP code check is one tap away while someone reads a long guide. Not a pop-up: it never
 * covers content, never opens by itself, and the page reserves room for it.
 */
export function StickyCtaBar({ source }: { source: string }) {
  return (
    <>
      <div aria-hidden className="h-[72px] md:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#09081b]/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="text-[13px] leading-tight text-white/85">One loan officer per ZIP code. Is yours open?</p>
          <TrackedLink
            href="/claim-territory"
            event="next_step_click"
            eventParams={{ source: `sticky:${source}`, cta: "Check ZIP code", link_url: "/claim-territory" }}
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-[#09081b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            Check my ZIP code
          </TrackedLink>
        </div>
      </div>
    </>
  );
}
