import { decryptValue, encryptValue, isEncryptedValue } from "./pii";

/**
 * Which fields of the data file hold borrower personal data. Only these are
 * encrypted at rest; ids, dates, statuses and routing fields stay readable so the
 * store can still be inspected and repaired by hand.
 *
 * Keep in step with src/lib/types.ts when a record gains a personal field.
 */
export const PII_FIELDS: Readonly<Record<string, readonly string[]>> = {
  sessions: ["answers"],
  borrowerLeads: ["answers", "prequalRequest"],
  crmLeads: ["notes"],
  loAlerts: ["summary"],
  followUps: ["recipient", "bodySummary"],
  appointments: ["borrowerNotes"],
  chatSessions: ["messages", "capturedFields", "summary"],
  demoRequests: ["name", "workEmail", "phone", "message"],
  propertyEvaluations: ["name", "email", "phone", "currentMortgageBalanceUsd"],
  cerebroActions: ["subject", "body", "preferredWindow"],
  consents: ["textShown"],
  smsOptIns: ["phone", "name", "textShown"],
  pushSubscriptions: ["endpoint", "keys"],
  crmConnections: ["outboundUrl", "signingSecret"],
};

export interface SnapshotPiiReport {
  /** Field values that are (or, for seal, would be) encrypted. */
  encrypted: number;
  /** Field values still in plain text. */
  plain: number;
  /** Encrypted values this process could not decrypt (no key or wrong key). */
  undecryptable: number;
}

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapPiiFields(
  snapshot: unknown,
  transform: (value: unknown, report: SnapshotPiiReport) => unknown,
): { snapshot: unknown; report: SnapshotPiiReport } {
  const report: SnapshotPiiReport = { encrypted: 0, plain: 0, undecryptable: 0 };
  if (!isRow(snapshot)) return { snapshot, report };
  const out: Row = { ...snapshot };
  for (const [collection, fields] of Object.entries(PII_FIELDS)) {
    const rows = snapshot[collection];
    if (!Array.isArray(rows)) continue;
    out[collection] = rows.map((row) => {
      if (!isRow(row)) return row;
      const copy: Row = { ...row };
      for (const field of fields) {
        if (copy[field] === undefined || copy[field] === null) continue;
        copy[field] = transform(copy[field], report);
      }
      return copy;
    });
  }
  return { snapshot: out, report };
}

/**
 * Returns a copy of the store with personal fields encrypted, for writing to disk.
 * Never mutates the in-memory store. With no key configured it returns plain values.
 */
export function sealSnapshot<T>(snapshot: T): T {
  return mapPiiFields(snapshot, (value) => encryptValue(value)).snapshot as T;
}

let warnedUndecryptable = false;

/**
 * Decrypts personal fields of a freshly parsed data file. Values that cannot be
 * decrypted are kept as ciphertext (never dropped), and one warning is logged
 * without any of the data.
 */
export function openSnapshot(snapshot: unknown): unknown {
  const { snapshot: opened, report } = mapPiiFields(snapshot, (value, r) => {
    const result = decryptValue(value);
    if (!result.ok) r.undecryptable += 1;
    return result.value;
  });
  if (report.undecryptable > 0 && !warnedUndecryptable) {
    warnedUndecryptable = true;
    console.error(
      `[pii] ${report.undecryptable} encrypted field(s) in the data file could not be decrypted ` +
        "(PII_ENCRYPTION_KEY missing or different). They are kept encrypted and unchanged.",
    );
  }
  return opened;
}

/** Counts encrypted vs plain personal fields, for the backfill script's dry run. */
export function inspectSnapshot(snapshot: unknown): SnapshotPiiReport {
  return mapPiiFields(snapshot, (value, r) => {
    if (isEncryptedValue(value)) r.encrypted += 1;
    else r.plain += 1;
    return value;
  }).report;
}

/** Test hook. */
export function resetPiiSnapshotWarningsForTests(): void {
  warnedUndecryptable = false;
}
