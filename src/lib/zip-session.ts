"use client";

import { useSyncExternalStore } from "react";

/**
 * One place for "which ZIP code has this visitor checked, and is it open?", shared by the hero
 * ZIP code check (TerritoryClaim), the sticky ZIP bar, the pricing CTAs and the Cerebro launcher.
 *
 * Two things are kept, on purpose:
 *  - ZIP_STORAGE_KEY / ZIP_CHECKED_EVENT: only ever an AVAILABLE ZIP code. PricingCta appends it
 *    to checkout links, so a ZIP code the page just called taken must never land here.
 *  - ZIP_STATUS_STORAGE_KEY / ZIP_STATUS_EVENT: the last check with its result (open or locked),
 *    for display only.
 */
export const ZIP_CHECKED_EVENT = "ypnus:zip-checked";
export const ZIP_STORAGE_KEY = "ypnus:checked-zip";
export const ZIP_STATUS_EVENT = "ypnus:zip-status";
export const ZIP_STATUS_STORAGE_KEY = "ypnus:zip-status";

export interface ZipStatus {
  zip: string;
  available: boolean;
  city?: string | null;
  state?: string | null;
}

/** Digits only, at most five: what every ZIP code field on the site accepts. */
export function sanitizeZip(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 5);
}

export function isCompleteZip(zip: string): boolean {
  return /^\d{5}$/.test(zip);
}

/**
 * Reflects an AVAILABLE ZIP code into this page's own URL (no navigation), broadcasts it so the
 * pricing CTAs mounted earlier pick it up at once, and keeps it in sessionStorage so it survives
 * a move to another route (e.g. /pricing). Pass null to clear it.
 */
export function syncZipToPageUrl(zip: string | null) {
  try {
    const url = new URL(window.location.href);
    if (zip) url.searchParams.set("zip", zip);
    else url.searchParams.delete("zip");
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new CustomEvent(ZIP_CHECKED_EVENT, { detail: { zip } }));
  } catch {
    /** noop: a cross-component convenience, never blocks the check. */
  }
  try {
    if (zip) sessionStorage.setItem(ZIP_STORAGE_KEY, zip);
    else sessionStorage.removeItem(ZIP_STORAGE_KEY);
  } catch {
    /** noop: sessionStorage can be unavailable (private browsing). */
  }
}

let cached: ZipStatus | null = null;
let loaded = false;

function parseStatus(raw: string | null): ZipStatus | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ZipStatus> | null;
    if (!value || typeof value.zip !== "string" || !isCompleteZip(value.zip) || typeof value.available !== "boolean") return null;
    return {
      zip: value.zip,
      available: value.available,
      city: typeof value.city === "string" ? value.city : null,
      state: typeof value.state === "string" ? value.state : null,
    };
  } catch {
    return null;
  }
}

function getSnapshot(): ZipStatus | null {
  if (!loaded) {
    loaded = true;
    try {
      cached = parseStatus(sessionStorage.getItem(ZIP_STATUS_STORAGE_KEY));
    } catch {
      cached = null;
    }
  }
  return cached;
}

function subscribe(onChange: () => void) {
  window.addEventListener(ZIP_STATUS_EVENT, onChange);
  return () => window.removeEventListener(ZIP_STATUS_EVENT, onChange);
}

/** Records the result of a ZIP code check (or clears it with null) and tells every listener. */
export function publishZipStatus(status: ZipStatus | null) {
  cached = status;
  loaded = true;
  try {
    if (status) sessionStorage.setItem(ZIP_STATUS_STORAGE_KEY, JSON.stringify(status));
    else sessionStorage.removeItem(ZIP_STATUS_STORAGE_KEY);
  } catch {
    /** noop */
  }
  try {
    window.dispatchEvent(new Event(ZIP_STATUS_EVENT));
  } catch {
    /** noop */
  }
}

/** The visitor's last ZIP code check this session, or null. Null on the server and before hydration. */
export function useZipStatus(): ZipStatus | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export interface TerritoryCheckResult {
  zip: string;
  valid: boolean;
  available: boolean;
  totalClaimed: number;
  message: string;
  city?: string | null;
  state?: string | null;
  signupUrl?: string | null;
  demand?: { total?: number; buyers?: number } | null;
  source?: string | null;
}

/** GET /api/territory/check for one ZIP code. Throws on a network error or a non-2xx response. */
export async function fetchTerritoryCheck(zip: string): Promise<TerritoryCheckResult> {
  const res = await fetch(`/api/territory/check?zip=${encodeURIComponent(zip)}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`territory check failed: ${res.status}`);
  return (await res.json()) as TerritoryCheckResult;
}
