/**
 * Runs once when the server process starts (Next.js instrumentation hook), before it
 * serves any request. Loads the server's settings file so a deploy cannot silently lose
 * them - see src/lib/app-env.ts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // First, before anything can log: mask borrower emails, phones and keys in every log line.
  const { installConsoleRedaction } = await import("./lib/log-redact");
  installConsoleRedaction();
  const { loadAppEnvFile } = await import("./lib/app-env");
  const names = loadAppEnvFile();
  if (names.length > 0) console.log(`[env] loaded ${names.length} setting(s) from the app settings file: ${names.join(", ")}`);
  // Cerebro's site optimizer: checks its live changes every 10 minutes and runs weekly once
  // Search Console is connected (see src/lib/site-optimizer.ts). Never blocks startup.
  try {
    const { startSiteOptimizerSchedule } = await import("./lib/site-optimizer");
    startSiteOptimizerSchedule();
  } catch (error) {
    console.error("[site-optimizer] could not start", error);
  }
}
