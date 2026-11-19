/**
 * WordPress is retired: ypnus.com runs entirely on this app. This module used to hold a REST client
 * that could write Website Autopilot changes to WordPress. That client is gone, and nothing in the
 * app calls a WordPress host any more.
 *
 * What remains is this status, which is always "off". It is kept because Website Autopilot records
 * and screens still carry a `wordpressLive` flag (see AutopilotRunRecord); it now always reads false,
 * which is the truth: proposed changes are saved in the app and never pushed to an external site.
 */
export function getWordPressAutopilotStatus(): {
  configured: boolean;
  enabled: boolean;
  autoApplyLowRisk: boolean;
  missingEnvVars: string[];
} {
  return { configured: false, enabled: false, autoApplyLowRisk: false, missingEnvVars: [] };
}
