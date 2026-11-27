import { recordOptOutAllChannelsDurably } from "@/lib/consent";
import { cancelPendingFollowUps, readDb } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-link";

/**
 * "unsubscribed": on disk. "invalid": a bad or unknown link (never says which).
 * "not_saved": the link is good but the data file could not be written, so nothing is confirmed
 * to the person; the same link works when they try again.
 */
export type UnsubscribeOutcome = "unsubscribed" | "invalid" | "not_saved";

/**
 * Unsubscribes a borrower from everything Cerebro sends (email, texts, calls) when the signed
 * link checks out. Confirmed only once the opt-out is on disk: one that stayed in memory would be
 * lost on a restart and Cerebro would contact them again.
 */
export function unsubscribeBorrower(leadId: string, token: string, source: string): UnsubscribeOutcome {
  if (!/^[\w-]{1,80}$/.test(leadId) || !verifyUnsubscribeToken(leadId, token)) return "invalid";
  if (!readDb().borrowerLeads.some((lead) => lead.id === leadId)) return "invalid";
  let saved = true;
  try {
    recordOptOutAllChannelsDurably(leadId, source);
  } catch {
    // StoreNotDurableError, or the store could not be read: nothing is confirmed to the person.
    saved = false;
  }
  // Nothing already queued for them is left waiting to go out, saved or not: memory already
  // holds the opt-out, so this process stops contacting them either way.
  cancelPendingFollowUps(leadId);
  return saved ? "unsubscribed" : "not_saved";
}
