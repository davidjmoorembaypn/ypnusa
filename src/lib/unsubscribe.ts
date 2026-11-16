import { verifyUnsubscribeToken } from "@/lib/cerebro-dispatch";
import { recordOptOutAllChannels } from "@/lib/consent";
import { readDb } from "@/lib/db";

/**
 * Unsubscribes a borrower from everything Cerebro sends (email, texts, calls) when the signed
 * link checks out. Returns false for a bad or unknown link without saying which.
 */
export function unsubscribeBorrower(leadId: string, token: string, source: string): boolean {
  if (!/^[\w-]{1,80}$/.test(leadId) || !verifyUnsubscribeToken(leadId, token)) return false;
  if (!readDb().borrowerLeads.some((lead) => lead.id === leadId)) return false;
  recordOptOutAllChannels(leadId, source);
  return true;
}
