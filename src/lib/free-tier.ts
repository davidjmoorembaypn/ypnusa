import { marketingUrl } from "@/lib/site";

/**
 * What the Free plan gets from Cerebro, in one place (approved by David, Nov 16 2026):
 * enough of a taste to want the full agentic assistant, not the whole thing.
 *
 * - Public site (no account): a starter kit preview (bio + blog opening; see
 *   public-agent-tools.ts) and up to FREE_VISITOR_DAILY_MESSAGES Cerebro replies a day per
 *   device once the chat is clearly a loan officer's. Homebuyer chats are never capped:
 *   they are leads for paying loan officers.
 * - Free dashboard: FREE_DAILY_MESSAGE_LIMIT messages a day (chat-agent.ts) and
 *   FREE_DAILY_ACTIONS real action a day, done end to end (a drafted post, landing page,
 *   follow-up or tool run). Website autopilot runs as a preview: it lists the changes it
 *   would make; only paid plans apply them.
 */
export const FREE_DAILY_ACTIONS = 1;
export const FREE_VISITOR_DAILY_MESSAGES = 10;

/** Dashboard Cerebro tools that produce finished work: one a day on Free. */
export const FREE_METERED_TOOLS: ReadonlySet<string> = new Set([
  "draft_marketing_content",
  "draft_landing_page",
  "run_follow_ups",
  "draft_rate_alerts",
  "draft_prequal_letter",
]);

/** Dashboard Cerebro tools that only a paid plan may run at all. */
export const PAID_ONLY_TOOLS: ReadonlySet<string> = new Set(["decide_website_change"]);

export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** The JSON a gated tool returns to the model, so Cerebro explains the upgrade plainly. */
export function upgradeRequiredResult(reason: "daily_action_used" | "paid_only"): string {
  return JSON.stringify({
    error: "upgrade_required",
    reason,
    pricingUrl: marketingUrl("/pricing"),
    howToReply:
      reason === "daily_action_used"
        ? "Tell them plainly they've used today's free Cerebro action (it resets at midnight UTC). A paid plan lets Cerebro do this as often as they need, runs it on autopilot, and locks their exclusive ZIP code. Give the pricing link once. Do not do the task another way."
        : "Tell them plainly this is part of a paid plan: Cerebro applies and keeps these changes for paying loan officers. Give the pricing link once. Do not do it another way.",
  });
}
