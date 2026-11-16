import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { checkMarketingCompliance } from "@/lib/ai/marketing-compliance";
import { getAiProvider } from "@/lib/ai/provider";
import { readDb, saveSiteOptimizerState, saveSiteOverride, secretsDir } from "@/lib/db";
import { generateId } from "@/lib/id";
import { MARKETING_SITE_URL } from "@/lib/site";
import type { SiteOverrideRecord } from "@/lib/types";

/**
 * Cerebro's site optimizer: keeps ypnus.com's search titles and descriptions improving on its own.
 *
 * Weekly, it reads Google Search Console (read-only), finds pages that show up in searches but
 * rarely get the click, writes a better title and description for a few of them, and applies
 * them as data (SiteOverrideRecord, read by marketingMetadata) so they go live without a release.
 *
 * Guardrails:
 * - Only titles and descriptions, only on pages outside PROTECTED_PATHS. Anything else waits for
 *   an admin (status "proposed").
 * - Length limits and the mortgage-advertising checks (no rates, guarantees, invented claims).
 * - At most MAX_AUTO_CHANGES_PER_RUN per run, and a page field is not changed again for
 *   COOLDOWN_DAYS, so each change can be measured.
 * - Every change keeps the value it replaced and can be rolled back in one click.
 * - After applying, the live page is fetched; if it does not answer 200 with the new text within
 *   VERIFY_DEADLINE_MS, the change is rolled back automatically.
 */

export const MAX_AUTO_CHANGES_PER_RUN = 3;
export const COOLDOWN_DAYS = 28;
export const RUN_EVERY_DAYS = 7;
const VERIFY_DEADLINE_MS = 20 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Pages Cerebro never edits on its own: money, legal, sign-in, and the homepage. */
const PROTECTED_PATHS = [
  /^\/$/,
  /^\/pricing\b/,
  /^\/licensing-disclosures\b/,
  /^\/terms-of-service\b/,
  /^\/privacy-policy\b/,
  /^\/accessibility-statement\b/,
  /^\/(login|logout|admin|dashboard|portal|account|billing|onboarding|analytics|api|starter-kit|embed)\b/,
];

export const LIMITS = { title: { min: 25, max: 62 }, description: { min: 70, max: 160 } } as const;

/** Sign-in, app and admin pages: never worth a search snippet, not even as a proposal. */
function isAlwaysSkipped(pathname: string): boolean {
  return /^\/(login|logout|admin|dashboard|portal|account|billing|onboarding|analytics|api|starter-kit|embed)\b/.test(pathname);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((pattern) => pattern.test(pathname));
}

export function normalizePath(raw: string): string | null {
  try {
    const url = new URL(raw, MARKETING_SITE_URL);
    const host = url.hostname.replace(/^www\./, "");
    if (host !== new URL(MARKETING_SITE_URL).hostname.replace(/^www\./, "")) return null;
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    return /^\/[a-z0-9\-/_.]*$/i.test(pathname) ? pathname : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Search Console key

export function gscKeyPath(): string {
  return process.env.GSC_KEY_FILE?.trim() || path.join(secretsDir(), "gsc-service-account.json");
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

function readKey(): ServiceAccountKey | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ gscKeyPath(), "utf8")) as Partial<ServiceAccountKey>;
    return parsed.client_email && parsed.private_key ? (parsed as ServiceAccountKey) : null;
  } catch {
    return null;
  }
}

/** The service account's email when a key is installed (never the key itself). */
export function gscStatus(): { connected: boolean; serviceAccount?: string } {
  const key = readKey();
  return key ? { connected: true, serviceAccount: key.client_email } : { connected: false };
}

/** Validates and stores an uploaded service-account JSON key (mode 600). Returns the account email. */
export function installGscKey(raw: string): { ok: true; serviceAccount: string } | { ok: false; error: string } {
  if (raw.length > 20_000) return { ok: false, error: "That file is too big to be a Google key file." };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "That file isn't a Google key file (it isn't JSON)." };
  }
  if (parsed.type !== "service_account" || typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") {
    return { ok: false, error: "That JSON isn't a service account key. Download the key from the service account's Keys tab." };
  }
  if (!parsed.private_key.includes("PRIVATE KEY")) return { ok: false, error: "The key file has no private key in it." };
  const target = gscKeyPath();
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true, mode: 0o700 });
  fs.writeFileSync(/*turbopackIgnore: true*/ target, JSON.stringify(parsed), { mode: 0o600 });
  return { ok: true, serviceAccount: parsed.client_email };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function accessToken(key: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = crypto.createSign("RSA-SHA256").update(`${header}.${claims}`).sign(key.private_key);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${base64url(signature)}`,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Google sign-in for Search Console failed (${response.status}).`);
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google returned no access token.");
  return data.access_token;
}

export interface SearchRow {
  page: string;
  query?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Last 28 days from Search Console: one row per page (true totals) plus page+query rows (for the
 * searches behind each page). Both are needed: Google drops rare queries from page+query rows, so
 * on a small site they hold only a fraction of each page's impressions. Tries the domain
 * property, then the URL property.
 */
export async function fetchSearchRows(): Promise<SearchRow[]> {
  const key = readKey();
  if (!key) throw new Error("Search Console isn't connected yet.");
  const token = await accessToken(key);
  const pages = await querySearchConsole(token, ["page"]);
  const pageQueries = await querySearchConsole(token, ["page", "query"]);
  return [...pages, ...pageQueries];
}

async function querySearchConsole(token: string, dimensions: string[]): Promise<SearchRow[]> {
  const end = new Date(Date.now() - 2 * DAY_MS);
  const start = new Date(end.getTime() - 28 * DAY_MS);
  const host = new URL(MARKETING_SITE_URL).hostname.replace(/^www\./, "");
  const candidates = process.env.GSC_SITE_URL?.trim() ? [process.env.GSC_SITE_URL.trim()] : [`sc-domain:${host}`, `${MARKETING_SITE_URL}/`];
  let lastStatus = 0;
  let emptyResult: SearchRow[] | null = null;
  for (const site of candidates) {
    const response = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          dimensions,
          rowLimit: 5000,
          // Include the newest (not yet final) days: on a small site every impression counts.
          dataState: "all",
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (response.ok) {
      const data = (await response.json()) as { rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }> };
      if (!data.rows?.length) {
        // An empty answer can mean the account sees this property but not the data; try the other form.
        emptyResult = [];
        continue;
      }
      return data.rows.map((row) => ({
        page: row.keys[0],
        ...(row.keys[1] !== undefined ? { query: row.keys[1] } : {}),
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }));
    }
    lastStatus = response.status;
  }
  if (emptyResult) return emptyResult;
  throw new Error(
    lastStatus === 403
      ? "Search Console refused access (403). Add the service account email as a user on the ypnus.com property."
      : `Search Console request failed (${lastStatus}).`,
  );
}

// ---------------------------------------------------------------- opportunities

export interface Opportunity {
  path: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  topQueries: string[];
}

/** Pages people see in search but rarely click: enough impressions, low CTR, ranking on pages 1-2. */
export function findOpportunities(rows: SearchRow[], now = Date.now()): Opportunity[] {
  // Page-only rows (no query) carry the true totals; page+query rows then only add the queries.
  const hasPageTotals = rows.some((row) => row.query === undefined);
  const byPath = new Map<string, { impressions: number; clicks: number; weightedPosition: number; queries: Map<string, number> }>();
  for (const row of rows) {
    const pathname = normalizePath(row.page);
    // Protected pages stay in: the run proposes them for approval instead of applying.
    if (!pathname || isAlwaysSkipped(pathname)) continue;
    const entry = byPath.get(pathname) ?? { impressions: 0, clicks: 0, weightedPosition: 0, queries: new Map() };
    const countsTowardTotals = hasPageTotals ? row.query === undefined : true;
    if (countsTowardTotals) {
      entry.impressions += row.impressions;
      entry.clicks += row.clicks;
      entry.weightedPosition += row.position * row.impressions;
    }
    if (row.query) entry.queries.set(row.query, (entry.queries.get(row.query) ?? 0) + row.impressions);
    byPath.set(pathname, entry);
  }
  const recent = recentlyChangedPaths(now);
  return [...byPath.entries()]
    .map(([pathname, entry]) => ({
      path: pathname,
      impressions: entry.impressions,
      clicks: entry.clicks,
      ctr: entry.impressions ? entry.clicks / entry.impressions : 0,
      position: entry.impressions ? entry.weightedPosition / entry.impressions : 0,
      topQueries: [...entry.queries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([query]) => query),
    }))
    .filter((item) => item.impressions >= 50 && item.ctr < 0.03 && item.position >= 2 && item.position <= 25 && !recent.has(item.path))
    .sort((a, b) => b.impressions * (0.03 - b.ctr) - a.impressions * (0.03 - a.ctr));
}

function recentlyChangedPaths(now: number): Set<string> {
  const cutoff = now - COOLDOWN_DAYS * DAY_MS;
  return new Set(
    readDb()
      .siteOverrides.filter((item) => Date.parse(item.appliedAt ?? item.createdAt) > cutoff && item.status !== "rejected")
      .map((item) => item.path),
  );
}

// ---------------------------------------------------------------- changes

function selfUrl(pathname: string): string {
  const base = process.env.SITE_SELF_URL?.trim() || `http://127.0.0.1:${process.env.PORT || 3000}`;
  return `${base}${pathname}`;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");
}

/** The page's current <title> and meta description as served. */
export async function readLivePage(pathname: string): Promise<{ status: number; title?: string; description?: string }> {
  const response = await fetch(selfUrl(pathname), { signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "ypnus-site-optimizer" } });
  const html = response.ok ? await response.text() : "";
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  const description = html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1];
  return { status: response.status, title: title ? decodeEntities(title) : undefined, description: description ? decodeEntities(description) : undefined };
}

export function validateValue(field: SiteOverrideRecord["field"], value: string): string[] {
  const problems: string[] = [];
  const { min, max } = LIMITS[field];
  if (value.length < min) problems.push(`${field} is too short (at least ${min} characters).`);
  if (value.length > max) problems.push(`${field} is too long (at most ${max} characters).`);
  if (/[<>]/.test(value)) problems.push(`${field} cannot contain < or >.`);
  problems.push(...checkMarketingCompliance({ fields: { [field]: value } }));
  return problems;
}

/** Tries to refresh the cached page so a change shows at once (only works inside a request). */
async function refreshPage(pathname: string): Promise<void> {
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath(pathname);
  } catch {
    // Outside a request (the weekly timer) the page refreshes on its own within 5 minutes.
  }
}

/**
 * Creates a change. Auto changes on unprotected pages go live at once (checked afterwards);
 * protected pages, or `requireApproval`, wait as "proposed" for an admin.
 */
export async function proposeChange(input: {
  path: string;
  field: SiteOverrideRecord["field"];
  value: string;
  reason: string;
  evidence?: string;
  source: SiteOverrideRecord["source"];
  previousValue?: string;
  requireApproval?: boolean;
}): Promise<{ ok: true; record: SiteOverrideRecord } | { ok: false; problems: string[] }> {
  const pathname = normalizePath(input.path);
  if (!pathname) return { ok: false, problems: ["That isn't a ypnus.com page path."] };
  const value = input.value.trim().replace(/\s+/g, " ");
  const problems = validateValue(input.field, value);
  if (problems.length) return { ok: false, problems };
  const goLive = !input.requireApproval && (input.source === "admin" || !isProtectedPath(pathname));
  const now = new Date().toISOString();
  const record: SiteOverrideRecord = {
    id: generateId("seo"),
    path: pathname,
    field: input.field,
    value,
    previousValue: input.previousValue,
    status: goLive ? "live" : "proposed",
    source: input.source,
    reason: input.reason.slice(0, 300),
    evidence: input.evidence?.slice(0, 200),
    createdAt: now,
    ...(goLive ? { appliedAt: now, checkResult: "pending" } : {}),
  };
  saveSiteOverride(record);
  if (goLive) await refreshPage(pathname);
  return { ok: true, record };
}

export async function approveChange(id: string): Promise<SiteOverrideRecord | null> {
  const record = readDb().siteOverrides.find((item) => item.id === id && item.status === "proposed");
  if (!record) return null;
  const now = new Date().toISOString();
  const updated: SiteOverrideRecord = { ...record, status: "live", appliedAt: now, checkResult: "pending" };
  saveSiteOverride(updated);
  await refreshPage(record.path);
  return updated;
}

export function rejectChange(id: string): SiteOverrideRecord | null {
  const record = readDb().siteOverrides.find((item) => item.id === id && item.status === "proposed");
  if (!record) return null;
  const updated: SiteOverrideRecord = { ...record, status: "rejected" };
  saveSiteOverride(updated);
  return updated;
}

/** Rolls a live change back: the page shows what it showed before (the coded default or earlier override). */
export async function revertChange(id: string, why = "Rolled back by an admin."): Promise<SiteOverrideRecord | null> {
  const record = readDb().siteOverrides.find((item) => item.id === id && item.status === "live");
  if (!record) return null;
  const updated: SiteOverrideRecord = { ...record, status: "reverted", revertedAt: new Date().toISOString(), checkResult: why };
  saveSiteOverride(updated);
  await refreshPage(record.path);
  return updated;
}

/**
 * Checks live changes still marked "pending": the page must answer 200 and show the new text.
 * A change that still fails after VERIFY_DEADLINE_MS is rolled back.
 */
export async function verifyPendingChanges(
  reader: typeof readLivePage = readLivePage,
  now = Date.now(),
): Promise<Array<{ id: string; result: string }>> {
  const pending = readDb().siteOverrides.filter((item) => item.status === "live" && item.checkResult === "pending");
  const results: Array<{ id: string; result: string }> = [];
  for (const record of pending) {
    let page: Awaited<ReturnType<typeof readLivePage>>;
    try {
      page = await reader(record.path);
    } catch {
      page = { status: 0 };
    }
    const shown = record.field === "title" ? page.title : page.description;
    const ok = page.status === 200 && Boolean(shown?.includes(record.value));
    if (ok) {
      saveSiteOverride({ ...record, checkResult: "ok" });
      results.push({ id: record.id, result: "ok" });
      continue;
    }
    if (page.status !== 0 && page.status !== 200) {
      await revertChange(record.id, `Rolled back automatically: the page answered ${page.status}.`);
      results.push({ id: record.id, result: "reverted" });
    } else if (now - Date.parse(record.appliedAt ?? record.createdAt) > VERIFY_DEADLINE_MS) {
      await revertChange(record.id, "Rolled back automatically: the new text never showed on the live page.");
      results.push({ id: record.id, result: "reverted" });
    } else {
      results.push({ id: record.id, result: "waiting" });
    }
  }
  return results;
}

// ---------------------------------------------------------------- the weekly run

/** Asks the configured AI model for a better title and description. Returns null if it can't. */
async function writeSnippet(opportunity: Opportunity, current: { title?: string; description?: string }): Promise<{ title: string; description: string } | null> {
  const provider = getAiProvider();
  if (!provider) return null;
  const system = `You write Google search titles and meta descriptions for ypnus.com, a platform for licensed mortgage loan officers (YPN USA, with the AI assistant Cerebro). Rules: title ${LIMITS.title.min}-${LIMITS.title.max} characters, description 120-155 characters; lead with the searcher's words; plain, specific, honest; no rates, APR, percentages, dollar payment amounts, guarantees, "best"/"#1" claims, or urgency words; no invented numbers. Reply with JSON only: {"title":"...","description":"..."}`;
  const user = `Page: ${opportunity.path}\nCurrent title: ${current.title ?? "unknown"}\nCurrent description: ${current.description ?? "unknown"}\nTop searches that show this page (last 28 days): ${opportunity.topQueries.join("; ") || "unknown"}\nIt gets ${opportunity.impressions} impressions but only ${opportunity.clicks} clicks (average position ${opportunity.position.toFixed(1)}).`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await provider.generate({ system, messages: [{ role: "user", content: user }], maxTokens: 1024, timeoutMs: 40_000 });
    const json = result.text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) continue;
    try {
      const parsed = JSON.parse(json) as { title?: unknown; description?: unknown };
      const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
      const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
      if (!validateValue("title", title).length && !validateValue("description", description).length) return { title, description };
    } catch {
      // try again
    }
  }
  return null;
}

export interface RunSummary {
  ranAt: string;
  opportunities: number;
  applied: number;
  proposed: number;
  skipped: string[];
}

/** One optimizer pass: verify earlier changes, read Search Console, improve up to MAX_AUTO_CHANGES_PER_RUN pages. */
export async function runSiteOptimizer(options: { rows?: SearchRow[] } = {}): Promise<RunSummary> {
  const ranAt = new Date().toISOString();
  const skipped: string[] = [];
  await verifyPendingChanges();
  const rows = options.rows ?? (await fetchSearchRows());
  const opportunities = findOpportunities(rows);
  let applied = 0;
  let proposed = 0;
  const waiting = new Set(readDb().siteOverrides.filter((item) => item.status === "proposed").map((item) => item.path));
  for (const opportunity of opportunities) {
    if (applied >= MAX_AUTO_CHANGES_PER_RUN) break;
    const needsApproval = isProtectedPath(opportunity.path);
    if (needsApproval && (proposed >= MAX_AUTO_CHANGES_PER_RUN || waiting.has(opportunity.path))) continue;
    let current: Awaited<ReturnType<typeof readLivePage>>;
    try {
      current = await readLivePage(opportunity.path);
    } catch {
      skipped.push(`${opportunity.path}: page could not be read`);
      continue;
    }
    if (current.status !== 200) {
      skipped.push(`${opportunity.path}: page answered ${current.status}`);
      continue;
    }
    const snippet = await writeSnippet(opportunity, current);
    if (!snippet) {
      skipped.push(`${opportunity.path}: no acceptable rewrite`);
      continue;
    }
    const evidence = `${opportunity.impressions} impressions, ${(opportunity.ctr * 100).toFixed(1)}% CTR, position ${opportunity.position.toFixed(1)}`;
    const reason = `Shows in search for "${opportunity.topQueries[0] ?? "related searches"}" but few people click.`;
    const base = { path: opportunity.path, reason, evidence, source: "cerebro_auto" as const, requireApproval: needsApproval };
    const title = await proposeChange({ ...base, field: "title", value: snippet.title, previousValue: current.title });
    const description = await proposeChange({ ...base, field: "description", value: snippet.description, previousValue: current.description });
    if (title.ok || description.ok) {
      if (needsApproval) proposed++;
      else applied++;
    }
  }
  const pagesRead = new Set(rows.filter((row) => row.query === undefined).map((row) => normalizePath(row.page))).size;
  const summary: RunSummary = { ranAt, opportunities: opportunities.length, applied, proposed, skipped };
  saveSiteOptimizerState({
    lastRunAt: ranAt,
    lastRunSummary: `Read ${pagesRead} pages from Search Console. ${applied} page${applied === 1 ? "" : "s"} improved and ${proposed} waiting for your approval, out of ${opportunities.length} found${skipped.length ? `; skipped: ${skipped.slice(0, 3).join("; ")}` : ""}.`,
  });
  return summary;
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Starts a run in the background and returns at once. A full run (Search Console plus a model
 * call per page) can outlast the web proxy's 60-second timeout, so the admin's "Run now" must
 * not wait for it. The result lands in siteOptimizer.lastRunSummary.
 */
export function startRunInBackground(): "started" | "already_running" {
  if (running) return "already_running";
  running = true;
  saveSiteOptimizerState({ lastRunSummary: "Running now…" });
  void runSiteOptimizer()
    .catch((error) => {
      console.error("[site-optimizer] manual run failed", error instanceof Error ? error.message : error);
      saveSiteOptimizerState({ lastRunAt: new Date().toISOString(), lastRunSummary: `Failed: ${error instanceof Error ? error.message : "unknown error"}` });
    })
    .finally(() => {
      running = false;
    });
  return "started";
}

/** Starts the in-process schedule: verifies changes every 10 minutes, runs weekly once Search Console is connected. */
export function startSiteOptimizerSchedule(): void {
  if (timer || process.env.SITE_OPTIMIZER_DISABLED === "true") return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await verifyPendingChanges();
      const last = readDb().siteOptimizer.lastRunAt;
      const due = !last || Date.now() - Date.parse(last) > RUN_EVERY_DAYS * DAY_MS;
      if (due && gscStatus().connected) await runSiteOptimizer();
    } catch (error) {
      console.error("[site-optimizer] scheduled pass failed", error instanceof Error ? error.message : error);
      saveSiteOptimizerState({ lastRunAt: new Date().toISOString(), lastRunSummary: `Failed: ${error instanceof Error ? error.message : "unknown error"}` });
    } finally {
      running = false;
    }
  };
  timer = setInterval(() => void tick(), 10 * 60 * 1000);
  timer.unref?.();
  setTimeout(() => void tick(), 60_000).unref?.();
}
