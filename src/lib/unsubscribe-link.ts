import { signValue, verifySignedValue } from "@/lib/session";
import { MARKETING_SITE_URL } from "@/lib/site";

/**
 * Signed unsubscribe links for borrower email. One lead, one token: anyone holding the link can
 * unsubscribe that lead and nothing else. Used by every automated borrower email (the follow-up
 * journey and Cerebro), so a borrower can always leave with one click.
 */

export function unsubscribeToken(borrowerLeadId: string): string {
  return signValue(`unsub:${borrowerLeadId}`);
}

export function verifyUnsubscribeToken(borrowerLeadId: string, token: string): boolean {
  return Boolean(borrowerLeadId && token) && verifySignedValue(`unsub:${borrowerLeadId}`, token);
}

function link(path: string, borrowerLeadId: string): string {
  const params = new URLSearchParams({ l: borrowerLeadId, t: unsubscribeToken(borrowerLeadId) });
  return `${MARKETING_SITE_URL}${path}?${params.toString()}`;
}

/** The page a person opens: it shows a confirm button, so a link scanner cannot unsubscribe anyone. */
export function unsubscribeUrl(borrowerLeadId: string): string {
  return link("/unsubscribe", borrowerLeadId);
}

/** The address mail apps POST to for one-click unsubscribe (RFC 8058). */
export function oneClickUnsubscribeUrl(borrowerLeadId: string): string {
  return link("/api/unsubscribe", borrowerLeadId);
}

/** Headers that make Gmail and Yahoo show their own "Unsubscribe" button. */
export function unsubscribeHeaders(borrowerLeadId: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${oneClickUnsubscribeUrl(borrowerLeadId)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
