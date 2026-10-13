export const ZIP_CHECKED_EVENT = "ypnus:zip-checked";
export const ZIP_STORAGE_KEY = "ypnus:checked-zip";

export function normalizeZip(value: string | null | undefined): string | undefined {
  const zip = value?.trim();
  return zip && /^\d{5}$/.test(zip) ? zip : undefined;
}

export function readEffectiveZip(): string | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const fromUrl = normalizeZip(new URLSearchParams(window.location.search).get("zip"));
    if (fromUrl) return fromUrl;

    return normalizeZip(window.sessionStorage.getItem(ZIP_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

export function syncZipToPageUrl(zip: string | null | undefined) {
  const normalized = normalizeZip(zip);

  try {
    const url = new URL(window.location.href);
    if (normalized) url.searchParams.set("zip", normalized);
    else url.searchParams.delete("zip");
    window.history.replaceState(window.history.state, "", url);
  } catch {
    /* noop: URL/history is a convenience, never blocks the primary flow. */
  }

  try {
    if (normalized) window.sessionStorage.setItem(ZIP_STORAGE_KEY, normalized);
    else window.sessionStorage.removeItem(ZIP_STORAGE_KEY);
  } catch {
    /* noop: sessionStorage may be unavailable in restricted contexts. */
  }

  try {
    window.dispatchEvent(new CustomEvent(ZIP_CHECKED_EVENT, { detail: { zip: normalized ?? null } }));
  } catch {
    /* noop: event dispatch is best-effort and should never fail the user flow. */
  }
}
