import { runAssistantTurn, type AssistantTurnInput, type AssistantTurnResult } from "@/lib/ai/chat-agent";
import { PUBLIC_PRICING_TIERS, TRIAL_DAYS } from "@/lib/pricing";
import { rateLimit } from "@/lib/rate-limit";
import { marketingUrl } from "@/lib/site";
import { isValidZip, normalizeZip } from "@/lib/territory";
import { checkLedgerTerritory } from "@/lib/territory-ledger";
import { findOpenNeighbors, type OpenNeighborsResult } from "@/lib/zip-neighbors";
import { estimateZipDemand } from "@/lib/zip-demand";

/**
 * What the MCP endpoint (src/app/api/mcp/route.ts) lets a client do. Plain functions, so they are
 * tested without HTTP. Everything here is either public information that /check-zip and /pricing
 * already show, or the same anonymous public-site Cerebro chat the website offers. Nothing here reads
 * or changes a loan officer's own account, leads or settings: that needs a signed-in session, which an
 * anonymous MCP caller does not have.
 */

export const MAX_BATCH_ZIPS = 10;
export const MAX_CEREBRO_MESSAGE = 1000;

export type ZipStatus = "open" | "locked" | "invalid";

export interface ZipAnswer {
  zip: string;
  valid: boolean;
  status: ZipStatus;
  /** True only when the ZIP code is valid and no paid subscription holds it. */
  available: boolean;
  city: string | null;
  state: string | null;
  message: string;
  /** Informational monthly market estimate from Census survey data. Never a lead count. null for an invalid ZIP code. */
  demand: ReturnType<typeof estimateZipDemand>;
}

/** The ledger's answer for one ZIP code, in the shape the tools return. Never throws for bad input. */
export function checkZip(rawZip: unknown): ZipAnswer {
  const zip = normalizeZip(rawZip);
  if (!isValidZip(zip)) {
    return {
      zip,
      valid: false,
      status: "invalid",
      available: false,
      city: null,
      state: null,
      message: "Enter a 5-digit US ZIP code.",
      demand: null,
    };
  }
  const result = checkLedgerTerritory(zip);
  return {
    zip: result.zip,
    valid: true,
    status: result.available ? "open" : "locked",
    available: result.available,
    city: result.city,
    state: result.state,
    message: result.message,
    demand: estimateZipDemand(result.zip),
  };
}

/** Up to MAX_BATCH_ZIPS ZIP codes, de-duplicated, in the order given. */
export function checkZips(rawZips: readonly unknown[]): { results: ZipAnswer[]; skipped: number } {
  const seen = new Set<string>();
  const results: ZipAnswer[] = [];
  let skipped = 0;
  for (const raw of rawZips) {
    const answer = checkZip(raw);
    const key = answer.valid ? answer.zip : `invalid:${String(raw)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (results.length >= MAX_BATCH_ZIPS) {
      skipped += 1;
      continue;
    }
    results.push(answer);
  }
  return { results, skipped };
}

export interface NearbyAnswer extends OpenNeighborsResult {
  zip: string;
  valid: boolean;
}

export async function nearbyOpenZips(
  rawZip: unknown,
  limit: number,
  find: typeof findOpenNeighbors = findOpenNeighbors,
): Promise<NearbyAnswer> {
  const zip = normalizeZip(rawZip);
  if (!isValidZip(zip)) return { zip, valid: false, neighbors: [], unknownCount: 0, checked: 0 };
  const capped = Math.min(Math.max(Math.floor(limit) || 3, 1), 5);
  const found = await find(zip, { limit: capped, maxCandidates: 15 });
  return { zip, valid: true, ...found };
}

/** How ZIP code locking works and what each plan costs, straight from the pricing data the site uses. */
export function zipLockInfo() {
  return {
    howItWorks: [
      "Every paid plan includes one 5-digit ZIP code. It locks to you at your first payment.",
      "While you hold it, no other YPN USA loan officer can claim it. Exclusivity applies within YPN USA; other lenders can still market in the same area.",
      "The Free plan does not lock a ZIP code: anyone can take yours until you make a first payment on a paid plan.",
      `Every paid plan has a ${TRIAL_DAYS}-day free trial. A trial alone does not hold a ZIP code.`,
    ],
    plans: PUBLIC_PRICING_TIERS.map((tier) => ({
      name: tier.name,
      price: tier.price,
      cadence: tier.cadence,
      zipCodes: tier.zipCapacityLabel,
      trialDays: tier.trialDays,
      tagline: tier.tagline,
      features: tier.features,
    })),
    links: {
      checkZip: marketingUrl("/check-zip"),
      pricing: marketingUrl("/pricing"),
    },
  };
}

/** What Cerebro does today. Kept in step with src/lib/cerebro-dispatch.ts and docs/gbp-ready-to-paste.md. */
export function cerebroOverview() {
  return {
    name: "Cerebro",
    summary:
      "Cerebro is YPN USA's AI assistant for licensed loan officers and their borrowers. YPN USA is marketing technology, not a lender; the loan officer stays responsible for licensing, advertising claims, RESPA, TCPA and state rules.",
    whatItDoes: [
      "Answers borrower questions at any hour on the loan officer's borrower page, qualifies borrowers with their consent, records the conversation and hands ready borrowers to the loan officer with a summary.",
      "Drafts follow-up messages for borrowers: check-ins, rate alerts and first replies. Email follow-ups go out on their own by default (\"live\" mode) after the borrower's consent and opt-out record, the advertising checks and the compliance checks pass; an officer can switch to \"approve\" mode so nothing goes out until they approve it. Prequal letters and callback requests never go out on their own.",
      "Drafts local posts and Realtor co-marketing for the loan officer to review and share.",
    ],
    notDoneToday: [
      "Text messages and calls are not sent yet.",
      "Cerebro does not lock a ZIP code. Only a first payment on a paid plan does (see get_zip_lock_info).",
    ],
    freePlan: "The Free plan includes the Cerebro growth diagnostic and the AI borrower intake assistant, with a daily message limit. Paid plans raise the limit.",
    tools: {
      askCerebro: "ask_cerebro talks to the public-site Cerebro, the same chat the website offers visitors.",
      yourOwnCerebro: `Your own dashboard Cerebro (your leads, drafts and settings) needs a signed-in account and is not available through this endpoint. Sign in at ${marketingUrl("/login")}.`,
    },
    links: {
      pricing: marketingUrl("/pricing"),
      checkZip: marketingUrl("/check-zip"),
    },
  };
}

export interface CerebroDeps {
  runTurn: (input: AssistantTurnInput) => Promise<AssistantTurnResult>;
  limit: typeof rateLimit;
}

const DEFAULT_CEREBRO_DEPS: CerebroDeps = { runTurn: runAssistantTurn, limit: rateLimit };

export type CerebroReply =
  | { ok: true; sessionId: string; reply: string; handoffRequested?: boolean; handoffPhone?: string; limitReached?: boolean }
  | { ok: false; error: string };

function hourlyCeiling(): number {
  const configured = Number.parseInt(process.env.MCP_CEREBRO_HOURLY_LIMIT ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : 120;
}

/**
 * One message to the public-site Cerebro. It spends a paid model call, so it has its own limits: a
 * small one per caller and a ceiling across all callers (MCP callers such as Claude can share a
 * network address, so the website's per-device free cap does not apply here).
 */
export async function askCerebro(
  input: { message: string; sessionId?: string },
  clientId: string,
  deps: CerebroDeps = DEFAULT_CEREBRO_DEPS,
): Promise<CerebroReply> {
  const message = input.message.trim().slice(0, MAX_CEREBRO_MESSAGE);
  if (!message) return { ok: false, error: "message is required." };

  const own = deps.limit(`mcp-cerebro:${clientId}`, 10, 60_000);
  if (!own.ok) return { ok: false, error: `Too many Cerebro messages. Try again in ${own.retryAfter} seconds.` };
  const all = deps.limit("mcp-cerebro:all", hourlyCeiling(), 3_600_000);
  if (!all.ok) return { ok: false, error: `Cerebro is busy right now. Try again in ${Math.ceil(all.retryAfter / 60)} minutes.` };

  const result = await deps.runTurn({
    mode: "public_site",
    sessionId: input.sessionId?.trim() || undefined,
    funnelSource: "mcp",
    userMessage: message,
  });
  return {
    ok: true,
    sessionId: result.sessionId,
    reply: result.reply,
    ...(result.handoffRequested ? { handoffRequested: true, handoffPhone: result.handoffPhone } : {}),
    ...(result.limitReached ? { limitReached: true } : {}),
  };
}

export function cerebroChatEnabled(): boolean {
  return (process.env.MCP_CEREBRO_CHAT ?? "").trim().toLowerCase() !== "off";
}
