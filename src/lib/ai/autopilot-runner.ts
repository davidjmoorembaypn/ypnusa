import { saveAutopilotRun } from "@/lib/db";
import { getWordPressAutopilotStatus } from "@/lib/wordpress";
import { buildAutopilotRunRecord, generateWebsiteAutopilotPlan } from "./website-autopilot";
import type { WebsiteAutopilotPlan, WebsiteAutopilotPlanInput } from "./website-autopilot";

/**
 * Unattended Website Autopilot runner — the foundation for YPNUS to check
 * and improve ypnus.com content on its own, without an MLO sitting at a
 * keyboard (e.g. a future Hostinger cron hitting `npm run autopilot:run`).
 *
 * Fully app-only tonight: it never fetches or writes live WordPress content
 * (getWordPressAutopilotStatus() below is a local env-var read, not a
 * network call), and it defaults to doing nothing at all unless explicitly
 * enabled. Every run is logged via the same AutopilotRunRecord history used
 * by the interactive Command Center (src/app/api/autopilot/plan/route.ts).
 */

function readBooleanEnv(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export interface WebsiteAutopilotRunnerConfig {
  /** Master switch. false (default): runWebsiteAutopilotForConfiguredSites() does nothing. */
  unattendedEnabled: boolean;
  /**
   * Second switch, independent of WORDPRESS_AUTOPILOT_AUTO_APPLY_LOW_RISK
   * (which only ever gates a *live* WordPress write). This one gates whether
   * an unattended run is allowed to log a low-risk change as "auto_applied"
   * at all — false (default) downgrades every such change to "proposed" so
   * nothing looks self-executed without an explicit opt-in, even though
   * neither setting ever performs a live write.
   */
  autoApplyLowRisk: boolean;
}

export function getWebsiteAutopilotRunnerConfig(): WebsiteAutopilotRunnerConfig {
  return {
    unattendedEnabled: readBooleanEnv("WEBSITE_AUTOPILOT_UNATTENDED_ENABLED"),
    autoApplyLowRisk: readBooleanEnv("WEBSITE_AUTOPILOT_AUTO_APPLY_LOW_RISK"),
  };
}

/** One page/site the unattended runner is allowed to generate a plan for. */
export interface WebsiteAutopilotTargetConfig {
  pageLabel: string;
  planInput: WebsiteAutopilotPlanInput;
}

/**
 * Tonight's allowlist: just the ypnus.com homepage, dry-run only. This is
 * static, hand-maintained configuration — not a live WordPress fetch — so
 * extending it later to more pages is a config change, not a new capability.
 */
const CONFIGURED_TARGETS: WebsiteAutopilotTargetConfig[] = [
  {
    pageLabel: "ypnus.com homepage",
    planInput: {
      pageType: "landing_page",
      currentCopy: "Welcome to YPN USA — connecting borrowers with local loan officers.",
      targetAudience: "buyers, sellers, and homeowners refinancing nationwide",
      leadGoal: "all",
      existingSeoTitle: "YPN USA | Local Mortgage Loan Officers",
      existingMetaDescription: "Connect with a local, exclusive-territory loan officer through YPN USA.",
      currentChatbotIntro: "Hi! How can I help with your home financing today?",
    },
  },
];

export function getConfiguredAutopilotTargets(): WebsiteAutopilotTargetConfig[] {
  return CONFIGURED_TARGETS;
}

/**
 * Pure: downgrades every "auto_applied" change to "proposed" when the caller
 * isn't opted into logging auto-applied changes. Never touches
 * needs_approval changes — high/medium risk is never gated by this flag.
 */
export function applyAutoApplyGate(plan: WebsiteAutopilotPlan, allowAutoApply: boolean): WebsiteAutopilotPlan {
  if (allowAutoApply) return plan;
  const changes = plan.changes.map((change) =>
    change.status === "auto_applied" ? { ...change, status: "proposed" as const, autoApplied: false } : change,
  );
  return { ...plan, changes, autoAppliedCount: 0 };
}

export interface AutopilotRunnerSummary {
  ran: boolean;
  unattendedEnabled: boolean;
  autoApplyLowRisk: boolean;
  /** Always true tonight — this runner never performs a live WordPress write. */
  dryRun: true;
  wordpressLive: boolean;
  targetsChecked: number;
  totalChangeCount: number;
  autoAppliedCount: number;
  needsApprovalCount: number;
  summary: string;
  runIds: string[];
}

/**
 * The reusable unattended entry point. Safe to call from a script, a future
 * Hostinger cron job, or anywhere else — with WEBSITE_AUTOPILOT_UNATTENDED_ENABLED
 * unset/false (the default), it does nothing: no plan generated, no run
 * persisted, no WordPress call of any kind.
 */
export function runWebsiteAutopilotForConfiguredSites(): AutopilotRunnerSummary {
  const { unattendedEnabled, autoApplyLowRisk } = getWebsiteAutopilotRunnerConfig();

  if (!unattendedEnabled) {
    return {
      ran: false,
      unattendedEnabled: false,
      autoApplyLowRisk,
      dryRun: true,
      wordpressLive: false,
      targetsChecked: 0,
      totalChangeCount: 0,
      autoAppliedCount: 0,
      needsApprovalCount: 0,
      summary:
        "Website Autopilot's unattended runner is disabled — nothing was checked. Set WEBSITE_AUTOPILOT_UNATTENDED_ENABLED=true to enable it.",
      runIds: [],
    };
  }

  const wordpress = getWordPressAutopilotStatus();
  const targets = getConfiguredAutopilotTargets();

  let totalChangeCount = 0;
  let autoAppliedCount = 0;
  let needsApprovalCount = 0;
  const runIds: string[] = [];

  for (const target of targets) {
    const rawPlan = generateWebsiteAutopilotPlan(target.planInput);
    const plan = applyAutoApplyGate(rawPlan, autoApplyLowRisk);
    const run = buildAutopilotRunRecord(plan, target.planInput.pageType, {
      pageLabel: target.pageLabel,
      wordpressLive: wordpress.enabled,
    });
    saveAutopilotRun(run);
    runIds.push(run.id);
    totalChangeCount += plan.changes.length;
    autoAppliedCount += plan.autoAppliedCount;
    needsApprovalCount += plan.needsApprovalCount;
  }

  const pageWord = targets.length === 1 ? "page" : "pages";
  const itemWord = totalChangeCount === 1 ? "item" : "items";
  let summary = `YPNUS checked your website and prepared/improved ${totalChangeCount} ${itemWord} across ${targets.length} ${pageWord}.`;
  if (needsApprovalCount > 0) {
    summary += ` ${needsApprovalCount} ${needsApprovalCount === 1 ? "item needs" : "items need"} your approval.`;
  }
  if (autoAppliedCount > 0) {
    summary += ` ${autoAppliedCount} ${autoAppliedCount === 1 ? "was" : "were"} logged as auto-applied.`;
  }

  return {
    ran: true,
    unattendedEnabled: true,
    autoApplyLowRisk,
    dryRun: true,
    wordpressLive: wordpress.enabled,
    targetsChecked: targets.length,
    totalChangeCount,
    autoAppliedCount,
    needsApprovalCount,
    summary,
    runIds,
  };
}
