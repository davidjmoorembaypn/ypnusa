import zlib from "node:zlib";
import { ZIP_DATA_GZ_BASE64 } from "./zip-data.generated";

/**
 * ZIP code geography: place name, state and approximate centroid, from the GeoNames US postal
 * code file (CC BY 4.0, https://www.geonames.org). Server-only: the data is a ~630 KB module, so
 * never import this from a client component.
 *
 * Centroids give "nearest by distance", not "bordering". A ZIP code's real boundary can be large,
 * oddly shaped or shared with a PO-box-only ZIP code, so callers should say "nearby", never
 * "adjacent" or "bordering".
 */

export interface ZipPlace {
  zip: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
}

export interface ZipDistance extends ZipPlace {
  /** Straight-line miles from the ZIP code you asked about. */
  miles: number;
}

const EARTH_RADIUS_MILES = 3958.8;

interface Index {
  places: ZipPlace[];
  byZip: Map<string, number>;
}

let cached: Index | null = null;

function load(): Index {
  if (cached) return cached;
  const text = zlib.gunzipSync(Buffer.from(ZIP_DATA_GZ_BASE64, "base64")).toString("utf8");
  const places: ZipPlace[] = [];
  const byZip = new Map<string, number>();
  for (const line of text.split("\n")) {
    const [zip, city, state, lat, lon] = line.split("|");
    if (!zip || !/^\d{5}$/.test(zip)) continue;
    byZip.set(zip, places.length);
    places.push({ zip, city, state, lat: Number(lat), lon: Number(lon) });
  }
  cached = { places, byZip };
  return cached;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function distanceMiles(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The place for a 5-digit ZIP code, or null when the ZIP code is not in the dataset. */
export function zipPlace(zip: string): ZipPlace | null {
  const { places, byZip } = load();
  const i = byZip.get(zip);
  return i === undefined ? null : places[i];
}

/** Every ZIP code in the dataset, in file order. Read-only: do not mutate the returned rows. */
export function allZipPlaces(): readonly ZipPlace[] {
  return load().places;
}

export function zipDatasetSize(): number {
  return load().places.length;
}

/**
 * ZIP codes within `miles` of `zip`, nearest first, excluding `zip` itself. Returns [] when the
 * ZIP code is unknown. `limit` caps the result after sorting.
 */
export function zipsWithinRadius(zip: string, miles: number, limit = Number.POSITIVE_INFINITY): ZipDistance[] {
  const origin = zipPlace(zip);
  if (!origin || !(miles > 0)) return [];
  const { places } = load();
  // Cheap bounding box first, so most of the 41k rows never reach the trig.
  const latWindow = miles / 69;
  const lonWindow = miles / (69 * Math.max(0.05, Math.cos(toRad(origin.lat))));
  const out: ZipDistance[] = [];
  for (const place of places) {
    if (place.zip === zip) continue;
    if (Math.abs(place.lat - origin.lat) > latWindow || Math.abs(place.lon - origin.lon) > lonWindow) continue;
    const d = distanceMiles(origin, place);
    if (d <= miles) out.push({ ...place, miles: d });
  }
  out.sort((a, b) => a.miles - b.miles || a.zip.localeCompare(b.zip));
  return out.length > limit ? out.slice(0, limit) : out;
}

/** The `limit` nearest ZIP codes to `zip` within `maxMiles`, nearest first, excluding `zip` itself. */
export function nearestZips(zip: string, limit: number, maxMiles = 50): ZipDistance[] {
  // Widen the search in steps so a dense city does not scan a 50-mile box for nothing.
  for (const radius of [5, 15, maxMiles]) {
    if (radius > maxMiles) break;
    const found = zipsWithinRadius(zip, radius, limit);
    if (found.length >= limit || radius >= maxMiles) return found;
  }
  return zipsWithinRadius(zip, maxMiles, limit);
}
