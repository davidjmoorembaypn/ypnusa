/**
 * Runs once when the server process starts (Next.js instrumentation hook), before it
 * serves any request. Loads the server's settings file so a deploy cannot silently lose
 * them - see src/lib/app-env.ts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { loadAppEnvFile } = await import("./lib/app-env");
  const names = loadAppEnvFile();
  if (names.length > 0) console.log(`[env] loaded ${names.length} setting(s) from the app settings file: ${names.join(", ")}`);
}
