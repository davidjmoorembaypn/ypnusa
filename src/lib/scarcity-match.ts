import type { Contact } from "@/lib/csv";
import { buildMailto, fillContactPlaceholders, type OutreachPayload } from "@/lib/outreach-templates";

/**
 * Matches uploaded loan officer contacts to open neighbor ZIP codes from scarcity events.
 * Runs in the browser; pure and dependency-free so it can be tested without a DOM.
 */

export interface ScarcityNeighbor {
  zip: string;
  city: string;
  state: string;
  miles: number;
  outreach: OutreachPayload;
  /** Set after a re-check against the live ledger. "claimed" neighbors are never matched. */
  status?: "open" | "claimed" | "unknown";
}

export interface ScarcityEventView {
  id: string;
  createdAt: string;
  lockedZip: string;
  lockedCity: string;
  lockedState: string;
  neighbors: ScarcityNeighbor[];
}

export interface MatchedRow {
  contact: Contact;
  eventId: string;
  lockedZip: string;
  lockedCity: string;
  targetZip: string;
  targetCity: string;
  emailSubject: string;
  emailBody: string;
  linkedinBody: string;
  /** null when the contact has no usable email or the link would be too long for mail clients. */
  mailto: string | null;
}

/**
 * ZIP codes a re-check found claimed. Availability belongs to the ZIP code, not to one alert: once
 * any occurrence is marked "claimed", that ZIP code is claimed in every alert that lists it.
 */
export function claimedNeighborZips(events: readonly ScarcityEventView[]): Set<string> {
  const claimed = new Set<string>();
  for (const event of events) for (const neighbor of event.neighbors) if (neighbor.status === "claimed") claimed.add(neighbor.zip);
  return claimed;
}

/**
 * Each open ZIP code matches at most once, to its most recent event, so a ZIP code that is
 * next to several newly locked ones doesn't produce duplicate outreach rows. A ZIP code marked
 * claimed in any alert is left out entirely, including from older alerts that still list it.
 */
export function indexOpenNeighbors(events: readonly ScarcityEventView[], onlyZip?: string): Map<string, { event: ScarcityEventView; neighbor: ScarcityNeighbor }> {
  const index = new Map<string, { event: ScarcityEventView; neighbor: ScarcityNeighbor }>();
  const claimed = claimedNeighborZips(events);
  const newestFirst = [...events].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  for (const event of newestFirst) {
    for (const neighbor of event.neighbors) {
      if (onlyZip && neighbor.zip !== onlyZip) continue;
      if (claimed.has(neighbor.zip)) continue;
      if (!index.has(neighbor.zip)) index.set(neighbor.zip, { event, neighbor });
    }
  }
  return index;
}

export function matchContacts(contacts: readonly Contact[], events: readonly ScarcityEventView[], onlyZip?: string): MatchedRow[] {
  const index = indexOpenNeighbors(events, onlyZip);
  const rows: MatchedRow[] = [];
  for (const contact of contacts) {
    const hit = contact.zip ? index.get(contact.zip) : undefined;
    if (!hit) continue;
    const { event, neighbor } = hit;
    const fill = { firstName: contact.firstName, email: contact.email };
    const emailSubject = fillContactPlaceholders(neighbor.outreach.email_fomo.subject, fill);
    const emailBody = fillContactPlaceholders(neighbor.outreach.email_fomo.body, fill);
    rows.push({
      contact,
      eventId: event.id,
      lockedZip: event.lockedZip,
      lockedCity: event.lockedCity,
      targetZip: neighbor.zip,
      targetCity: neighbor.city,
      emailSubject,
      emailBody,
      linkedinBody: fillContactPlaceholders(neighbor.outreach.linkedin_dm.body, fill),
      mailto: contact.email ? buildMailto(contact.email, emailSubject, emailBody) : null,
    });
  }
  return rows;
}

export const EXPORT_COLUMNS = [
  "first_name",
  "last_name",
  "email",
  "company",
  "nmls_id",
  "contact_zip",
  "target_zip",
  "target_city",
  "locked_zip",
  "email_subject",
  "email_body",
  "linkedin_dm",
] as const;

export function toExportRows(rows: readonly MatchedRow[]): Array<Record<(typeof EXPORT_COLUMNS)[number], string>> {
  return rows.map((r) => ({
    first_name: r.contact.firstName,
    last_name: r.contact.lastName,
    email: r.contact.email,
    company: r.contact.company,
    nmls_id: r.contact.nmlsId,
    contact_zip: r.contact.zip,
    target_zip: r.targetZip,
    target_city: r.targetCity,
    locked_zip: r.lockedZip,
    email_subject: r.emailSubject,
    email_body: r.emailBody,
    linkedin_dm: r.linkedinBody,
  }));
}
