import { logApiError } from "@/lib/http";
import { recordZipScarcityEvent } from "@/lib/db";
import { zipPlace } from "@/lib/geo/zip-geo";
import { generateId } from "@/lib/id";
import { buildOutreachPayload } from "@/lib/outreach-templates";
import { isValidZip, normalizeZip } from "@/lib/territory";
import { findOpenNeighbors, type OpenNeighborsResult } from "@/lib/zip-neighbors";
import type { ZipScarcityEventRecord } from "@/lib/types";

/**
 * Post-lock hook: when a ZIP code goes from open to locked, find the nearest ZIP codes that are
 * still open and log a "neighbor lock alert" with ready-to-copy outreach text for each.
 *
 * It only records. Nothing is sent. It must never slow down or break a payment webhook, so
 * callers use scheduleZipLockHook (fire and forget) and every failure is caught and logged.
 *
 * Limitation: locks taken through the WordPress Stripe plugin never reach this app's fulfillment
 * code, so they don't trigger the hook.
 */

export type ZipLockTrigger = ZipScarcityEventRecord["trigger"];

/** How many open neighbors to record per lock (the nearest 5 to 10). */
const NEIGHBOR_LIMIT = 10;

export interface ZipLockHookDeps {
  findNeighbors?: (zip: string, options: { limit: number }) => Promise<OpenNeighborsResult>;
  record?: (event: ZipScarcityEventRecord) => { recorded: boolean };
  now?: () => Date;
  newId?: () => string;
}

export interface ZipLockHookResult {
  recorded: boolean;
  reason?: string;
  neighborCount: number;
}

export async function onZipCodeLocked(
  rawLockedZip: string,
  newOwnerId: string,
  trigger: ZipLockTrigger = "checkout",
  deps: ZipLockHookDeps = {},
): Promise<ZipLockHookResult> {
  const lockedZip = normalizeZip(rawLockedZip);
  if (!isValidZip(lockedZip)) return { recorded: false, reason: "Not a valid ZIP code.", neighborCount: 0 };
  if (!newOwnerId) return { recorded: false, reason: "No owner id.", neighborCount: 0 };
  try {
    const find = deps.findNeighbors ?? findOpenNeighbors;
    const { neighbors, unknownCount, checked } = await find(lockedZip, { limit: NEIGHBOR_LIMIT });
    if (neighbors.length === 0) return { recorded: false, reason: "No open neighboring ZIP codes found.", neighborCount: 0 };

    const lockedPlace = zipPlace(lockedZip);
    const lockedCity = lockedPlace?.city ?? "";
    const event: ZipScarcityEventRecord = {
      id: (deps.newId ?? (() => generateId("zse")))(),
      createdAt: (deps.now ?? (() => new Date()))().toISOString(),
      lockedZip,
      lockedCity,
      lockedState: lockedPlace?.state ?? "",
      ownerRef: newOwnerId,
      trigger,
      neighbors: neighbors.map((n) => ({
        zip: n.zip,
        city: n.city,
        state: n.state,
        miles: n.miles,
        outreach: buildOutreachPayload({ lockedZip, lockedCity, targetZip: n.zip, targetCity: n.city }),
      })),
      unknownCount,
      checkedCount: checked,
    };
    const { recorded } = (deps.record ?? recordZipScarcityEvent)(event);
    return recorded ? { recorded: true, neighborCount: neighbors.length } : { recorded: false, reason: "Already recorded.", neighborCount: neighbors.length };
  } catch (error) {
    logApiError("zip-scarcity", error);
    return { recorded: false, reason: "Hook failed; see logs.", neighborCount: 0 };
  }
}

/**
 * The hook runs in production, or anywhere ZIP_SCARCITY_HOOK=on. It is off by default elsewhere so
 * tests and local runs never make outbound ZIP lookups by accident.
 */
export function zipLockHookEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.ZIP_SCARCITY_HOOK?.trim().toLowerCase();
  if (flag === "off") return false;
  if (flag === "on") return true;
  return env.NODE_ENV === "production";
}

/** Fire and forget: never awaited by the caller, never throws, never delays a webhook response. */
export function scheduleZipLockHook(lockedZip: string, newOwnerId: string, trigger: ZipLockTrigger): void {
  if (!zipLockHookEnabled()) return;
  void onZipCodeLocked(lockedZip, newOwnerId, trigger).catch((error) => logApiError("zip-scarcity", error));
}
