import { recordOptOutAllChannelsIn } from "@/lib/consent";
import { cancelPendingFollowUpsIn, readDb, writeDb } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-link";

/**
 * Unsubscribes a borrower from everything Cerebro sends (email, texts, calls) when the signed
 * link checks out. Returns false for a bad or unknown link without saying which.
 */
export function unsubscribeBorrower(leadId: string, token: string, source: string): boolean {
  if (!/^[\w-]{1,80}$/.test(leadId) || !verifyUnsubscribeToken(leadId, token)) return false;
  if (!readDb().borrowerLeads.some((lead) => lead.id === leadId)) return false;
  // Saved together: the opt-out, and nothing already queued for them left waiting to go out.
  writeDb((db) => {
    recordOptOutAllChannelsIn(db, leadId, source);
    cancelPendingFollowUpsIn(db, leadId, "Cancelled: borrower opted out.");
  });
  return true;
}
