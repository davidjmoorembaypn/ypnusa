import { normalizeEmail } from "@/lib/accounts";
import { findZipOwnerSubscription } from "@/lib/crm";
import { fetchLiveTerritory } from "@/lib/live-territory";
import { checkTerritory, normalizeZip } from "@/lib/territory";

/**
 * Thin, read-only wrapper around the existing ZIP/territory logic
 * (src/lib/territory.ts, src/lib/live-territory.ts) for the agent
 * orchestrator. Mirrors the live-then-local fallback used by
 * /api/territory/check — no new territory business logic lives here.
 *
 * It reports availability only. There is no made-up "opportunity score", and a ZIP the
 * signed-in officer already holds is reported as theirs, not as "owned by another officer".
 */

export type ZipStatus = "yours" | "open" | "taken" | "invalid";

export interface ZipLogicResult {
  zip: string;
  valid: boolean;
  available: boolean;
  /** True when the viewer's own paid subscription holds this ZIP. */
  ownedByYou: boolean;
  status: ZipStatus;
  totalClaimed: number;
  message: string;
  source: "ypnus_wp" | "local_demo";
}

/** Who is asking, so their own ZIP is recognised. Never taken from the client — the route fills it from the session. */
export interface ZipViewer {
  email?: string;
}

function viewerOwnsZip(zip: string, viewer?: ZipViewer): boolean {
  const email = normalizeEmail(viewer?.email);
  if (!email) return false;
  const owner = findZipOwnerSubscription(zip);
  return Boolean(owner && normalizeEmail(owner.ownerEmail) === email);
}

async function resolveZip(rawZip: string, viewer?: ZipViewer): Promise<ZipLogicResult> {
  const zip = normalizeZip(rawZip);
  const live = await fetchLiveTerritory(rawZip);
  const territory = live ?? checkTerritory(rawZip);
  const result = {
    zip: territory.zip,
    valid: territory.valid,
    available: territory.available,
    totalClaimed: territory.totalClaimed,
    message: territory.message,
    source: live ? ("ypnus_wp" as const) : ("local_demo" as const),
  };

  if (!result.valid) return { ...result, ownedByYou: false, status: "invalid" };
  if (viewerOwnsZip(zip, viewer)) {
    return {
      ...result,
      available: false,
      ownedByYou: true,
      status: "yours",
      message: `ZIP code ${result.zip} is your exclusive territory. Leads from it route to you.`,
    };
  }
  return { ...result, ownedByYou: false, status: result.available ? "open" : "taken" };
}

export async function suggestTerritory(
  zip: string,
  viewer?: ZipViewer,
): Promise<ZipLogicResult & { recommendation: string }> {
  const result = await resolveZip(zip, viewer);
  const recommendation =
    result.status === "invalid"
      ? "Ask for a valid 5-digit ZIP code."
      : result.status === "yours"
        ? "This ZIP code is already yours — focus on getting visible in it (Google Business Profile, local posts, your borrower page)."
        : result.status === "open"
          ? "Open — it can be claimed on a paid plan."
          : "Already held by another subscriber — join the waitlist for a reopen alert, or check a nearby ZIP code.";
  return { ...result, recommendation };
}

/** Availability for one ZIP. Kept under its old name for the "zip-score" agent task. */
export async function scoreZip(
  zip: string,
  viewer?: ZipViewer,
): Promise<{ zip: string; status: ZipStatus; available: boolean; ownedByYou: boolean; reason: string }> {
  const result = await resolveZip(zip, viewer);
  const reason =
    result.status === "invalid"
      ? "Invalid ZIP code."
      : result.status === "yours"
        ? "This is your exclusive territory."
        : result.status === "open"
          ? "Open — no one holds this ZIP code yet."
          : "Held by another subscriber.";
  return { zip: result.zip, status: result.status, available: result.available, ownedByYou: result.ownedByYou, reason };
}

export async function explainZip(zip: string, viewer?: ZipViewer): Promise<{ zip: string; explanation: string }> {
  const result = await resolveZip(zip, viewer);
  return { zip: result.zip, explanation: result.message };
}
