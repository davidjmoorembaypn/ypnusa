import { decryptValue, encryptValue, isEncryptedValue, piiEncryptionStatus } from "@/lib/crypto/pii";
import { ensureHouseOfficer } from "@/lib/crm";
import { readDb, writeDb } from "@/lib/db";
import { signValue, verifySignedValue } from "@/lib/session";
import { MARKETING_SITE_URL } from "@/lib/site";
import type { LoanOfficerRecord } from "@/lib/types";

/**
 * Per-officer Google Calendar connection (OAuth 2.0, offline access).
 *
 * Needs GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in the server settings, from a
 * Google Cloud "Web application" OAuth client whose redirect URI is
 * https://ypnus.com/api/calendar/google/callback. Until those are set, "Connect Google
 * Calendar" says it isn't available yet and bookings keep using the officer's set hours plus an
 * emailed calendar invite.
 *
 * Scopes: calendar.events (create and delete the booked event), calendar.freebusy (see when
 * the officer is busy, never what the events are) and calendar.settings.readonly (their time zone). The refresh token is stored encrypted on the
 * officer's record; access tokens live only in memory.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  // Only to read the officer's calendar time zone when they connect.
  "https://www.googleapis.com/auth/calendar.settings.readonly",
];

const STATE_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * Connecting needs the OAuth client and working at-rest encryption: a refresh token is a
 * long-lived credential and is never stored in plain text.
 */
export function googleOAuthConfigured(): boolean {
  return (
    Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()) &&
    piiEncryptionStatus() === "on"
  );
}

export function googleRedirectUri(): string {
  return `${MARKETING_SITE_URL}/api/calendar/google/callback`;
}

/** The officer record a signed-in user connects: their own, or the house account for an admin. */
export function officerForViewer(viewer: { sub: string; email: string; role: string }): LoanOfficerRecord | undefined {
  const db = readDb();
  const email = viewer.email.trim().toLowerCase();
  const own =
    db.loanOfficers.find((officer) => officer.id === viewer.sub) ??
    db.loanOfficers.find((officer) => officer.email.trim().toLowerCase() === email);
  if (own) return own;
  return viewer.role === "admin" ? ensureHouseOfficer() : undefined;
}

export function connectState(loId: string, now = Date.now()): string {
  const payload = `${loId}.${now}`;
  return `${payload}.${signValue(`gcal:${payload}`)}`;
}

export function readConnectState(state: string, now = Date.now()): string | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [loId, issued, signature] = parts;
  if (!verifySignedValue(`gcal:${loId}.${issued}`, signature)) return null;
  if (!Number.isFinite(Number(issued)) || now - Number(issued) > STATE_MAX_AGE_MS) return null;
  return loId;
}

export function googleConsentUrl(loId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: connectState(loId),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
      ...body,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok) throw new Error(`Google sign-in failed (${response.status}${data.error ? `: ${data.error}` : ""}).`);
  return data;
}

const accessCache = new Map<string, { token: string; expiresAt: number }>();

/** Finishes the connection: stores the refresh token, switches the officer to Google, reads their time zone. */
export async function completeGoogleConnection(loId: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!googleOAuthConfigured()) return { ok: false, error: "Google Calendar isn't set up on the server yet." };
  if (!readDb().loanOfficers.some((officer) => officer.id === loId)) return { ok: false, error: "No loan officer profile for this account." };
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: googleRedirectUri() });
  if (!tokens.refresh_token || !tokens.access_token) {
    return { ok: false, error: "Google didn't grant calendar access. Try again and allow both calendar permissions." };
  }
  accessCache.set(loId, { token: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in ?? 3000) * 1000 });
  let timeZone: string | undefined;
  try {
    const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/settings/timezone", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) timeZone = ((await response.json()) as { value?: string }).value;
  } catch {
    // Keep the officer's existing time zone.
  }
  const sealed = encryptValue(tokens.refresh_token);
  if (!isEncryptedValue(sealed)) return { ok: false, error: "Calendar connection needs encryption turned on on the server." };
  writeDb((db) => {
    const officer = db.loanOfficers.find((item) => item.id === loId);
    if (!officer) return;
    officer.calendarProvider = "google";
    officer.calendarId = "primary";
    officer.googleRefreshToken = sealed;
    officer.googleConnectedAt = new Date().toISOString();
    if (timeZone) officer.calendarTimeZone = timeZone;
  });
  return { ok: true };
}

export function disconnectGoogle(loId: string): void {
  accessCache.delete(loId);
  writeDb((db) => {
    const officer = db.loanOfficers.find((item) => item.id === loId);
    if (!officer) return;
    officer.calendarProvider = "local";
    officer.calendarId = undefined;
    officer.googleRefreshToken = undefined;
    officer.googleConnectedAt = undefined;
  });
}

/** An access token for this officer's Google Calendar, or null when they haven't connected. */
export async function googleAccessToken(officer: LoanOfficerRecord): Promise<string | null> {
  if (!officer.googleRefreshToken || !googleOAuthConfigured()) return null;
  const cached = accessCache.get(officer.id);
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
  const decrypted = decryptValue<string>(officer.googleRefreshToken);
  if (!decrypted.ok || typeof decrypted.value !== "string") return null;
  try {
    const tokens = await tokenRequest({ refresh_token: decrypted.value, grant_type: "refresh_token" });
    if (!tokens.access_token) return null;
    accessCache.set(officer.id, { token: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in ?? 3000) * 1000 });
    return tokens.access_token;
  } catch (error) {
    console.error(`[google-calendar] token refresh failed for ${officer.id}`, error instanceof Error ? error.message : error);
    return null;
  }
}
