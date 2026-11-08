import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { claimedZipsForEmail } from "@/lib/accounts";
import { officerPhotoDir, readDb } from "@/lib/db";
import type { AgentOnboardingRecord, OfficerPhotoRecord, OfficerProfileRecord } from "@/lib/types";

/**
 * Loan officer profile: who the officer is (name, NMLS ID, phone, company, headshot) and
 * their public borrower page at /lo/[slug].
 *
 * The profile lives on the officer's onboarding record (AgentOnboardingRecord.officerProfile)
 * and is mirrored onto their CRM officer record (src/lib/crm.ts syncOfficerProfile). The
 * headshot is a file beside the JSON store, never inside it.
 *
 * Every value here comes from the server's own validation: callers pass raw request input
 * and get back either a normalized value or a field-level error.
 */

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const PHOTO_CONTENT_TYPES: Record<OfficerPhotoRecord["ext"], string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function photoContentType(ext: OfficerPhotoRecord["ext"]): string {
  return PHOTO_CONTENT_TYPES[ext];
}

// ---------------------------------------------------------------------------
// Field validation
// ---------------------------------------------------------------------------

/** Strips control characters and collapses whitespace. */
function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** A person's name: 2-80 characters, starts with a letter, letters/spaces/.'’- only. */
export function normalizeFullName(value: unknown): string | null {
  const name = cleanText(value, 120);
  if (name.length < 2 || name.length > 80) return null;
  if (!/^\p{L}[\p{L}\p{M} .'’-]*$/u.test(name)) return null;
  if (!/\p{L}.*\p{L}/u.test(name)) return null;
  return name;
}

/** NMLS ID: 4-10 digits. Spaces and a leading "NMLS"/"#" are tolerated and removed. */
export function normalizeNmlsId(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim().replace(/^nmls\s*/i, "").replace(/^#/, "").replace(/\s+/g, "");
  return /^\d{4,10}$/.test(raw) ? raw : null;
}

/**
 * US phone number to its 10 digits. Accepts common formats ("(559) 512-0372",
 * "559.512.0372", "+1 559 512 0372"). Area code and exchange can't start with 0 or 1
 * (North American Numbering Plan).
 */
export function normalizeUsPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^[\d\s().+-]{10,20}$/.test(value.trim())) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  return digits;
}

export function formatUsPhone(digits: string): string {
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function usPhoneHref(digits: string): string {
  return `tel:+1${digits}`;
}

/** Optional company/brokerage name, up to 100 characters. Empty means "not given". */
export function normalizeCompany(value: unknown): string | undefined {
  const company = cleanText(value, 100);
  return company.length >= 2 ? company : undefined;
}

export type ProfileField = "fullName" | "nmlsId" | "phone" | "company";

export type ProfileInputResult =
  | { ok: true; value: Pick<OfficerProfileRecord, "fullName" | "nmlsId" | "phone" | "company"> }
  | { ok: false; field: ProfileField; error: string };

export function validateOfficerProfileInput(input: Record<string, unknown>): ProfileInputResult {
  const fullName = normalizeFullName(input.fullName);
  if (!fullName) return { ok: false, field: "fullName", error: "Enter your full name (letters, spaces, hyphens and apostrophes)." };
  const nmlsId = normalizeNmlsId(input.nmlsId);
  if (!nmlsId) return { ok: false, field: "nmlsId", error: "Enter your NMLS ID: 4 to 10 digits." };
  const phone = normalizeUsPhone(input.phone);
  if (!phone) return { ok: false, field: "phone", error: "Enter a US phone number with area code, like (559) 512-0372." };
  const companyRaw = cleanText(input.company, 200);
  if (companyRaw.length > 100) return { ok: false, field: "company", error: "Company name must be 100 characters or fewer." };
  const company = normalizeCompany(input.company);
  return { ok: true, value: { fullName, nmlsId, phone, ...(company ? { company } : {}) } };
}

// ---------------------------------------------------------------------------
// Public page slug
// ---------------------------------------------------------------------------

/** 8 hex characters derived from the account id: stable, and reveals nothing about the id. */
export function officerShortId(userId: string): string {
  return createHash("sha256").update(`ypn-officer:${userId}`).digest("hex").slice(0, 8);
}

function slugifyName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "loan-officer";
}

/** "jane-doe-1a2b3c4d": the officer's name plus their short id. */
export function officerSlug(fullName: string, userId: string): string {
  return `${slugifyName(fullName)}-${officerShortId(userId)}`;
}

/**
 * The short id at the end of a slug (or a bare short id), or null when the value isn't
 * shaped like one. Pages look officers up by this, so a link with an old name still
 * resolves after the officer corrects their name.
 */
export function shortIdFromSlug(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 80) return null;
  const match = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?([0-9a-f]{8})$/.exec(value.trim().toLowerCase());
  return match ? match[1] : null;
}

/** The onboarding record whose account has this short id. Null when none match, or (fail closed) more than one. */
export function findOnboardingByShortId(shortId: string): AgentOnboardingRecord | null {
  const matches = readDb().agentOnboarding.filter((record) => officerShortId(record.userId) === shortId);
  return matches.length === 1 ? matches[0] : null;
}

// ---------------------------------------------------------------------------
// Headshot files
// ---------------------------------------------------------------------------

/** Detects JPEG, PNG or WebP from the file's leading bytes. The declared type and file name are ignored. */
export function sniffImageType(bytes: Uint8Array): OfficerPhotoRecord["ext"] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((byte, index) => bytes[index] === byte)) return "png";
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

/**
 * Account ids are generated (acct_<uuid>) and used as the file name directly. Any other
 * shape (e.g. a dev-login sub with "@") is hashed, so no id can ever form a path.
 */
function safeFileStem(userId: string): string {
  if (/^[A-Za-z0-9_-]{1,100}$/.test(userId)) return userId;
  return `h_${createHash("sha256").update(userId).digest("hex").slice(0, 32)}`;
}

function photoPath(userId: string, ext: OfficerPhotoRecord["ext"]): string {
  // turbopackIgnore: a runtime data path; tracing it would pull the whole project into the bundle.
  return path.join(/*turbopackIgnore: true*/ officerPhotoDir(), `${safeFileStem(userId)}.${ext}`);
}

export type PhotoSaveResult =
  | { ok: true; photo: OfficerPhotoRecord }
  | { ok: false; status: number; code: string; error: string };

/**
 * Validates and stores a headshot. The type comes from the file's own bytes; the file is
 * written to a temporary name and renamed into place, and any older file with a different
 * extension is removed.
 */
export function saveOfficerPhoto(userId: string, bytes: Uint8Array): PhotoSaveResult {
  if (bytes.length === 0) return { ok: false, status: 400, code: "EMPTY_FILE", error: "Choose a photo to upload." };
  if (bytes.length > MAX_PHOTO_BYTES) {
    return { ok: false, status: 413, code: "FILE_TOO_LARGE", error: "Photos must be 2 MB or smaller." };
  }
  const ext = sniffImageType(bytes);
  if (!ext) return { ok: false, status: 415, code: "UNSUPPORTED_TYPE", error: "Upload a JPEG, PNG or WebP image." };

  const dir = officerPhotoDir();
  fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
  const target = photoPath(userId, ext);
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(/*turbopackIgnore: true*/ tmp, bytes);
  fs.renameSync(/*turbopackIgnore: true*/ tmp, target);
  for (const other of Object.keys(PHOTO_CONTENT_TYPES) as OfficerPhotoRecord["ext"][]) {
    if (other !== ext) fs.rmSync(/*turbopackIgnore: true*/ photoPath(userId, other), { force: true });
  }
  return { ok: true, photo: { ext, bytes: bytes.length, updatedAt: new Date().toISOString() } };
}

export function readOfficerPhoto(userId: string, photo: OfficerPhotoRecord): Buffer | null {
  try {
    return fs.readFileSync(/*turbopackIgnore: true*/ photoPath(userId, photo.ext));
  } catch {
    return null;
  }
}

export function deleteOfficerPhoto(userId: string): void {
  for (const ext of Object.keys(PHOTO_CONTENT_TYPES) as OfficerPhotoRecord["ext"][]) {
    fs.rmSync(/*turbopackIgnore: true*/ photoPath(userId, ext), { force: true });
  }
}

/** Public URL of the headshot; the version query busts caches after a new upload. */
export function officerPhotoUrl(userId: string, photo: OfficerPhotoRecord): string {
  return `/api/officer-photo/${officerShortId(userId)}?v=${encodeURIComponent(Date.parse(photo.updatedAt).toString(36))}`;
}

// ---------------------------------------------------------------------------
// Completeness and the public page
// ---------------------------------------------------------------------------

/** The Visibility Score's "Complete your profile" step: name, NMLS ID, phone and photo. */
export function isOfficerProfileComplete(record: AgentOnboardingRecord | null | undefined): boolean {
  const profile = record?.officerProfile;
  return Boolean(profile?.fullName && profile.nmlsId && profile.phone && record?.officerPhoto);
}

export interface PublicOfficerPage {
  userId: string;
  slug: string;
  profile: OfficerProfileRecord;
  photo?: OfficerPhotoRecord;
  /** ZIP codes locked to this officer by a live paid subscription, oldest first. */
  zips: string[];
}

function accountEmailFor(record: AgentOnboardingRecord): string {
  return readDb().accounts.find((account) => account.id === record.userId)?.email ?? record.email;
}

/**
 * The officer's public page, or null when it must not be shown: no profile yet, or no
 * live paid plan holding at least one ZIP code (free accounts and unpaid trials don't
 * lock a ZIP code, and a cancelled or lapsed plan releases it).
 */
export function publicOfficerPageFor(record: AgentOnboardingRecord | null | undefined): PublicOfficerPage | null {
  const profile = record?.officerProfile;
  if (!record || !profile?.fullName || !profile.nmlsId || !profile.phone) return null;
  const zips = claimedZipsForEmail(accountEmailFor(record));
  if (zips.length === 0) return null;
  return {
    userId: record.userId,
    slug: officerSlug(profile.fullName, record.userId),
    profile,
    ...(record.officerPhoto ? { photo: record.officerPhoto } : {}),
    zips,
  };
}

/** Resolves a /lo/[slug] (or ?lo=) value to a live officer page. */
export function findPublicOfficerPage(slugOrShortId: unknown): PublicOfficerPage | null {
  const shortId = shortIdFromSlug(slugOrShortId);
  if (!shortId) return null;
  return publicOfficerPageFor(findOnboardingByShortId(shortId));
}

export function publicOfficerPageForUser(userId: string): PublicOfficerPage | null {
  return publicOfficerPageFor(readDb().agentOnboarding.find((record) => record.userId === userId));
}

export function officerPagePath(slug: string): string {
  return `/lo/${slug}`;
}

/** Borrower intake opened from an officer page: prefilled with their ZIP code and tagged so the lead routes to them. */
export function officerIntakeHref(page: Pick<PublicOfficerPage, "slug" | "zips">): string {
  const params = new URLSearchParams();
  if (page.zips[0]) params.set("zip", page.zips[0]);
  params.set("lo", page.slug);
  params.set("funnelSource", `lo-${page.slug}`.slice(0, 64));
  return `/embed/intake?${params.toString()}`;
}
