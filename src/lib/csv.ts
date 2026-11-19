/**
 * Small CSV helpers for the admin outreach matcher. They run in the browser, so a contact list
 * never leaves the machine. No dependencies.
 */

/** Parses CSV text (RFC 4180 quoting, CRLF or LF, optional BOM) into rows of cells. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** Cells that start with these are read as formulas by spreadsheet apps, so they get a leading apostrophe. */
const FORMULA_START = /^[=+\-@\t\r]/;

export function neutralizeCell(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

export function toCsv(columns: readonly string[], rows: ReadonlyArray<Record<string, string>>): string {
  const escape = (raw: string) => {
    const value = neutralizeCell(raw);
    return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  return [columns.map(escape).join(","), ...rows.map((r) => columns.map((c) => escape(r[c] ?? "")).join(","))].join("\r\n");
}

export interface Contact {
  firstName: string;
  lastName: string;
  email: string;
  /** Normalized 5-digit ZIP code, or "" when the row had none that could be read. */
  zip: string;
  nmlsId: string;
  company: string;
}

const COLUMN_ALIASES: Record<keyof Contact, readonly string[]> = {
  firstName: ["firstname", "first", "givenname"],
  lastName: ["lastname", "last", "surname", "familyname"],
  email: ["email", "emailaddress", "workemail", "primaryemail"],
  zip: ["zip", "zipcode", "postalcode", "officezip", "officezipcode", "officepostalcode"],
  nmlsId: ["nmlsid", "nmls", "nmlsnumber", "nmlsno"],
  company: ["company", "companyname", "employer", "brokerage", "organization"],
};

const headerKey = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

/** 5 digits: strips a +4, pads a ZIP code whose leading zero a spreadsheet dropped. "" if unusable. */
export function normalizeContactZip(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 5) return digits;
  if (digits.length === 9) return digits.slice(0, 5);
  if (digits.length === 4) return `0${digits}`;
  return "";
}

export interface ParsedContacts {
  contacts: Contact[];
  /** Rows dropped because they had no email and no readable ZIP code. */
  skipped: number;
  /** Which of our fields found a column, for a "we read these columns" line in the UI. */
  columns: Partial<Record<keyof Contact, string>>;
}

export function parseContacts(csvText: string): ParsedContacts {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return { contacts: [], skipped: 0, columns: {} };
  const headers = rows[0].map((h) => h.trim());
  const keys = headers.map(headerKey);
  const index: Partial<Record<keyof Contact, number>> = {};
  const columns: Partial<Record<keyof Contact, string>> = {};
  for (const field of Object.keys(COLUMN_ALIASES) as Array<keyof Contact>) {
    const at = keys.findIndex((key) => COLUMN_ALIASES[field].includes(key));
    if (at >= 0) {
      index[field] = at;
      columns[field] = headers[at];
    }
  }
  const get = (row: string[], field: keyof Contact) => (index[field] === undefined ? "" : (row[index[field] as number] ?? "").trim());

  const contacts: Contact[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const contact: Contact = {
      firstName: get(row, "firstName"),
      lastName: get(row, "lastName"),
      email: get(row, "email"),
      zip: normalizeContactZip(get(row, "zip")),
      nmlsId: get(row, "nmlsId"),
      company: get(row, "company"),
    };
    if (!contact.email && !contact.zip) {
      skipped += 1;
      continue;
    }
    contacts.push(contact);
  }
  return { contacts, skipped, columns };
}
