import { classifyRisk } from "@/lib/ai/website-autopilot";
import type { WebsiteAutopilotPlan } from "@/lib/ai/website-autopilot";
import type { AutopilotChangeType, AutopilotRiskLevel, WebsiteAutopilotChange } from "@/lib/types";

/**
 * WordPress REST API client for the Website Autopilot feature. Tonight this is
 * app-only, dry-run/proposal-mode code: it classifies and plans changes but
 * NEVER publishes to ypnus.com unless explicitly opted in via env vars. It
 * never logs or throws credential values under any code path.
 */

interface WordPressEnvConfig {
  siteUrl: string;
  username: string;
  appPassword: string;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseBooleanEnv(name: string): boolean {
  const value = readEnv(name);
  return value?.toLowerCase() === "true";
}

const REQUIRED_ENV_VARS = [
  "WORDPRESS_SITE_URL",
  "WORDPRESS_AUTOPILOT_USERNAME",
  "WORDPRESS_AUTOPILOT_APP_PASSWORD",
] as const;

function getMissingEnvVars(): string[] {
  return REQUIRED_ENV_VARS.filter((name) => !readEnv(name));
}

function getWordPressEnvConfig(): WordPressEnvConfig | null {
  const siteUrl = readEnv("WORDPRESS_SITE_URL");
  const username = readEnv("WORDPRESS_AUTOPILOT_USERNAME");
  const appPassword = readEnv("WORDPRESS_AUTOPILOT_APP_PASSWORD");
  if (!siteUrl || !username || !appPassword) return null;
  return { siteUrl, username, appPassword };
}

export function getWordPressAutopilotStatus(): {
  configured: boolean;
  enabled: boolean;
  autoApplyLowRisk: boolean;
  missingEnvVars: string[];
} {
  const missingEnvVars = getMissingEnvVars();
  return {
    configured: missingEnvVars.length === 0,
    enabled: parseBooleanEnv("WORDPRESS_AUTOPILOT_ENABLED"),
    autoApplyLowRisk: parseBooleanEnv("WORDPRESS_AUTOPILOT_AUTO_APPLY_LOW_RISK"),
    missingEnvVars,
  };
}

export interface WordPressContentRef {
  id?: number;
  slug?: string;
  type?: "page" | "post";
}

export interface WordPressContentSnapshot {
  id: number;
  slug: string;
  type: "page" | "post";
  title: string;
  content: string;
  link: string;
  /** Rank Math SEO title/description meta, exposed as REST fields by wp-plugins/ypnus-seo-hygiene. */
  rankMathTitle: string;
  rankMathDescription: string;
}

function buildAuthHeader(config: WordPressEnvConfig): string {
  return `Basic ${Buffer.from(`${config.username}:${config.appPassword}`).toString("base64")}`;
}

/** WP REST fields we read off a page/post JSON response; title/content are rendered-shape fields. */
interface WordPressRestItem {
  id: number;
  slug: string;
  link: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  /** Registered by wp-plugins/ypnus-seo-hygiene's register_rest_field — absent on sites without it. */
  rank_math_title?: string;
  rank_math_description?: string;
}

function toSnapshot(item: WordPressRestItem, type: "page" | "post"): WordPressContentSnapshot {
  return {
    id: item.id,
    slug: item.slug,
    type,
    title: item.title?.rendered ?? "",
    content: item.content?.rendered ?? "",
    link: item.link,
    rankMathTitle: item.rank_math_title ?? "",
    rankMathDescription: item.rank_math_description ?? "",
  };
}

export async function fetchWordPressContent(ref: WordPressContentRef): Promise<WordPressContentSnapshot | null> {
  const config = getWordPressEnvConfig();
  if (!config) return null;
  if (ref.id === undefined && !ref.slug) return null;

  const type = ref.type ?? "page";
  const authHeader = buildAuthHeader(config);

  try {
    if (ref.id !== undefined) {
      const res = await fetch(`${config.siteUrl}/wp-json/wp/v2/${type}s/${ref.id}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return null;
      const item = (await res.json()) as WordPressRestItem;
      return toSnapshot(item, type);
    }

    const res = await fetch(`${config.siteUrl}/wp-json/wp/v2/${type}s?slug=${encodeURIComponent(ref.slug ?? "")}`, {
      headers: { Authorization: authHeader },
    });
    if (!res.ok) return null;
    const items = (await res.json()) as WordPressRestItem[];
    if (!Array.isArray(items) || items.length === 0) return null;
    return toSnapshot(items[0], type);
  } catch {
    return null;
  }
}

export function prepareWordPressUpdatePayload(change: {
  afterText: string;
  title?: string;
  changeType?: AutopilotChangeType;
}): Record<string, unknown> {
  // seo_title/seo_meta_description target Rank Math's meta fields (registered as REST
  // fields by wp-plugins/ypnus-seo-hygiene), never the post body — routing them through
  // `content` would silently overwrite the page with the SEO copy instead of setting it.
  if (change.changeType === "seo_title") {
    return { rank_math_title: change.afterText };
  }
  if (change.changeType === "seo_meta_description") {
    return { rank_math_description: change.afterText };
  }
  return {
    content: change.afterText,
    ...(change.title ? { title: change.title } : {}),
  };
}

export async function conditionallyUpdateWordPressContent(
  ref: WordPressContentRef,
  change: { afterText: string; title?: string; changeType?: AutopilotChangeType },
): Promise<{ applied: boolean; reason: string }> {
  const enabled = parseBooleanEnv("WORDPRESS_AUTOPILOT_ENABLED");
  const config = getWordPressEnvConfig();

  if (!enabled) {
    return { applied: false, reason: "WordPress autopilot publishing is not enabled (WORDPRESS_AUTOPILOT_ENABLED)." };
  }
  if (!config) {
    return { applied: false, reason: "WordPress autopilot is not fully configured." };
  }
  if (ref.id === undefined) {
    return { applied: false, reason: "A numeric WordPress content id is required to apply a change." };
  }

  const type = ref.type ?? "page";

  try {
    const res = await fetch(`${config.siteUrl}/wp-json/wp/v2/${type}s/${ref.id}`, {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(config),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(prepareWordPressUpdatePayload(change)),
    });
    if (!res.ok) {
      return { applied: false, reason: `WordPress REST API responded with ${res.status}.` };
    }
    return { applied: true, reason: "Applied via WordPress REST API." };
  } catch {
    return { applied: false, reason: "WordPress REST API request failed." };
  }
}

export function classifyWordPressChangeRisk(changeType: AutopilotChangeType, afterText: string): AutopilotRiskLevel {
  return classifyRisk(changeType, afterText);
}

export interface WordPressAutopilotApplyResult {
  dryRun: boolean;
  changes: WebsiteAutopilotChange[];
  appliedCount: number;
  heldForReviewCount: number;
  proposedCount: number;
}

export async function applyWordPressAutopilotPlan(
  plan: WebsiteAutopilotPlan,
  ref?: WordPressContentRef,
): Promise<WordPressAutopilotApplyResult> {
  const enabled = parseBooleanEnv("WORDPRESS_AUTOPILOT_ENABLED");
  const autoApplyLowRisk = parseBooleanEnv("WORDPRESS_AUTOPILOT_AUTO_APPLY_LOW_RISK");
  const dryRun = !(enabled && autoApplyLowRisk);

  const changes: WebsiteAutopilotChange[] = [];

  for (const original of plan.changes) {
    const change: WebsiteAutopilotChange = { ...original };

    if (change.riskLevel !== "low") {
      change.status = "needs_approval";
      change.autoApplied = false;
      change.requiresApproval = true;
      change.rollbackNote = "High/medium-risk change — held for manual review; not applied.";
      changes.push(change);
      continue;
    }

    if (dryRun || !ref) {
      change.status = "proposed";
      change.autoApplied = false;
      change.requiresApproval = false;
      change.rollbackNote = dryRun
        ? "WordPress autopilot dry-run mode is on — proposal only, nothing was published."
        : "No WordPress content reference was provided — proposal only, nothing was published.";
      changes.push(change);
      continue;
    }

    const outcome = await conditionallyUpdateWordPressContent(ref, {
      afterText: change.afterText,
      changeType: change.changeType,
    });
    if (outcome.applied) {
      change.status = "auto_applied";
      change.autoApplied = true;
      change.requiresApproval = false;
      change.rollbackNote = change.beforeText
        ? "Revert by restoring beforeText via the WordPress REST API."
        : "Revert by restoring the prior content via the WordPress REST API (beforeText was not captured for this change).";
    } else {
      change.status = "proposed";
      change.autoApplied = false;
      change.requiresApproval = false;
      change.rollbackNote = outcome.reason;
    }
    changes.push(change);
  }

  return {
    dryRun,
    changes,
    appliedCount: changes.filter((c) => c.status === "auto_applied").length,
    heldForReviewCount: changes.filter((c) => c.status === "needs_approval").length,
    proposedCount: changes.filter((c) => c.status === "proposed").length,
  };
}
