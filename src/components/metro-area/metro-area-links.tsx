import Link from "next/link";
import { METRO_AREAS, METRO_AREA_HUB_PATH, METRO_AREA_YEAR, isMetroAreaIndexable, metroAreaPath, metroAreasMentionedIn } from "@/content/metro-areas";

/** Every indexable metro report, A-Z, so each is one link away from the /markets page. */
export function MetroAreaIndex() {
  const metros = METRO_AREAS.filter(isMetroAreaIndexable).sort((a, b) => a.short.localeCompare(b.short));
  return (
    <>
      <p className="text-sm text-slate-600">
        {metros.length} metro reports built from {METRO_AREA_YEAR} HMDA data.{" "}
        <Link href={METRO_AREA_HUB_PATH} className="font-semibold text-violet-700 hover:underline">
          See all ranked side by side
        </Link>
        .
      </p>
      <ul className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {metros.map((m) => (
          <li key={m.code}>
            <Link href={metroAreaPath(m)} className="text-violet-700 hover:underline">
              {m.short.replace(/,\s*[A-Z]{2}$/, "")}, {m.states[0]} mortgage market
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Links a post to the metro reports for the cities it talks about. Renders nothing when it names none. */
export function MetroAreasMentioned({ text, className = "" }: { text: string; className?: string }) {
  const metros = metroAreasMentionedIn(text);
  if (!metros.length) return null;
  return (
    <nav aria-labelledby="metro-mentioned-heading" className={className}>
      <h2 id="metro-mentioned-heading" className="text-lg font-semibold text-slate-900">
        Mortgage market data for places in this post
      </h2>
      <ul className="mt-2 space-y-1 text-[15px]">
        {metros.map((m) => (
          <li key={m.code}>
            <Link href={metroAreaPath(m)} className="font-semibold text-violet-700 hover:underline">
              {m.name}: {METRO_AREA_YEAR} loan volume, loan mix and approval rates
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
