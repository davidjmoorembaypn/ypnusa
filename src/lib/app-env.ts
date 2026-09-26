import fs from "node:fs";
import path from "node:path";

/**
 * Loads the server's own settings file (.env) into process.env at startup.
 *
 * Why this exists: on the Hostinger deployment each deploy creates a fresh
 * <app>/hbuilds/versions/<id>/nodejs folder, while the real settings
 * (SESSION_SECRET, LOANPILOT_DATA_DIR, ADMIN_TOKEN, ANTHROPIC_API_KEY, ...) live once in
 * <app>/.env. A deploy that does not carry that file across silently runs the app on
 * defaults: sessions and single sign-on break and records are written to a throwaway
 * folder. Loading it here makes a deploy safe on its own.
 *
 * Rules:
 * - Values already present in the environment always win; this only fills gaps.
 * - An explicit YPNUS_ENV_FILE is always honored. Otherwise the file is looked for four
 *   levels above the working directory (the app folder), and ONLY when the working
 *   directory is inside .../hbuilds/versions/ - so local development never picks up a
 *   stray .env from somewhere else.
 * - Values are never logged.
 */

/** Parses KEY=VALUE lines (comments, blank lines, optional quotes, optional "export "). */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.length >= 2 && value.endsWith(quote)) {
      value = value.slice(1, -1);
    } else {
      // Unquoted: drop a trailing " # comment".
      value = value.replace(/\s+#.*$/, "");
    }
    out[match[1]] = value;
  }
  return out;
}

type EnvLike = Record<string, string | undefined>;

/** Where the settings file would be, or null when this process should not look for one. */
export function appEnvFilePath(env: EnvLike, cwd: string): string | null {
  const explicit = env.YPNUS_ENV_FILE?.trim();
  if (explicit) return explicit;
  const marker = `${path.sep}hbuilds${path.sep}versions${path.sep}`;
  if (!cwd.includes(marker)) return null;
  return path.resolve(/*turbopackIgnore: true*/ cwd, "..", "..", "..", "..", ".env");
}

/**
 * Fills process.env (or the given env) from the settings file. Returns the NAMES it set,
 * for a one-line startup log; never the values.
 */
export function loadAppEnvFile(env: EnvLike = process.env, cwd: string = process.cwd()): string[] {
  const filePath = appEnvFilePath(env, cwd);
  if (!filePath) return [];
  let text: string;
  try {
    // turbopackIgnore: runtime-only path; keeps the build's file tracer from bundling the repo.
    text = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8");
  } catch {
    return [];
  }
  const set: string[] = [];
  for (const [key, value] of Object.entries(parseEnvFile(text))) {
    if (env[key] === undefined || env[key] === "") {
      env[key] = value;
      set.push(key);
    }
  }
  return set;
}
