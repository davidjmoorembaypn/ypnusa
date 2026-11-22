
// Persistent data lives outside the release directory so deploys never wipe it.
// A real platform env var (if one is ever set) wins over this default.
process.env.LOANPILOT_DATA_DIR =
  process.env.LOANPILOT_DATA_DIR ||
  "/home/u853154979/domains/ypnus.com/app/persistent-data"

// YPN-ENV-LOADER: on Hostinger, fill in any variable not already set from app/.env
// (Hostinger exposes no env-var screen for this app; the deployed build has no .env loader).
//
// The same bundle also runs on the AWS server, where there is nothing for this process to read:
// systemd passes the settings in itself (EnvironmentFile=/etc/ypnusa/app.env, a file only root can
// read), and the unit's ProtectHome hides /home, so reading the Hostinger path there answered
// "env loader: EACCES" at every start. So the loader runs only where its file belongs to this
// server: when the app runs from under the Hostinger account, or when YPNUS_ENV_FILE names a file.
var ypnEnvFile =
  process.env.YPNUS_ENV_FILE ||
  (__dirname.indexOf("/home/u853154979/") === 0 ? "/home/u853154979/domains/ypnus.com/app/.env" : "");
if (ypnEnvFile) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- spliced into Next's CommonJS standalone server.js
    require("fs").readFileSync(ypnEnvFile, "utf8").split(/\r?\n/).forEach(function (l) {
      var m = l.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || l.trim().charAt(0) === "#") return;
      var v = m[2].replace(/^(["'])(.*)\1$/, "$2");
      if (process.env[m[1]] === undefined || process.env[m[1]] === "") process.env[m[1]] = v;
    });
  } catch (e) { console.error("env loader:", e.code || e.message); }
}
