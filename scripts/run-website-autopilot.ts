/**
 * CLI entry for the unattended Website Autopilot runner — `npm run autopilot:run`.
 *
 * App-only, no live WordPress calls. With WEBSITE_AUTOPILOT_UNATTENDED_ENABLED
 * unset/false (the default) this safely does nothing and exits 0. This is
 * intended for a future Hostinger scheduled task — not configured tonight.
 */
import { runWebsiteAutopilotForConfiguredSites } from "@/lib/ai/autopilot-runner";

const result = runWebsiteAutopilotForConfiguredSites();
console.log(result.summary);
console.log(JSON.stringify(result, null, 2));
