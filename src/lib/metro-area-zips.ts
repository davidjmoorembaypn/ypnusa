import { allZipPlaces, type ZipPlace } from "@/lib/geo/zip-geo";
import { METRO_AREAS, type MetroArea } from "@/content/metro-areas";

/**
 * Links between the top-100 metro pages (/markets/metro/<slug>) and ZIP code pages (/zip/<zip>).
 * A ZIP code belongs to a metro here when its place name and state match one of the metro's named
 * places (its principal cities, from the HMDA area name). That is deliberately narrow: it never
 * guesses at suburbs, so a link always points somewhere that is plainly inside the metro.
 */
let byPlace: Map<string, MetroArea> | null = null;
const key = (city: string, state: string) => `${city.toLowerCase()}|${state}`;

function placeIndex(): Map<string, MetroArea> {
  if (byPlace) return byPlace;
  byPlace = new Map();
  for (const m of METRO_AREAS) for (const p of m.places) for (const s of m.states) if (!byPlace.has(key(p, s))) byPlace.set(key(p, s), m);
  return byPlace;
}

/** ZIP codes in the metro's named places, spread across those places, at most `limit`. */
export function metroAreaZips(m: MetroArea, limit = 24): ZipPlace[] {
  const groups = m.places.map((p) => allZipPlaces().filter((z) => z.city.toLowerCase() === p.toLowerCase() && m.states.includes(z.state)).sort((a, b) => a.zip.localeCompare(b.zip)));
  const out: ZipPlace[] = [];
  for (let i = 0; out.length < limit && groups.some((g) => i < g.length); i++) {
    for (const g of groups) if (i < g.length && out.length < limit) out.push(g[i]);
  }
  return out.sort((a, b) => a.zip.localeCompare(b.zip));
}

/** The metro whose named places include this ZIP code's place, if any. */
export function metroAreaForZip(z: Pick<ZipPlace, "city" | "state">): MetroArea | undefined {
  return placeIndex().get(key(z.city, z.state));
}
