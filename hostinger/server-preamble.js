
// Persistent data lives outside the release directory so deploys never wipe it.
// A real platform env var (if one is ever set) wins over this default.
process.env.LOANPILOT_DATA_DIR =
  process.env.LOANPILOT_DATA_DIR ||
  "/home/u853154979/domains/ypnus.com/app/persistent-data"

// YPN-ENV-LOADER: Hostinger has no environment-variable screen, so load app/.env
// only when systemd has not already injected the required server settings. On AWS,
// /etc/ypnusa/app.env is root-only and EnvironmentFile= supplies SESSION_SECRET.
// Skipping the Hostinger path prevents an EACCES warning on every AWS start.
if (!process.env.SESSION_SECRET) {
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- spliced into Next's CommonJS standalone server.js
  require("fs").readFileSync("/home/u853154979/domains/ypnus.com/app/.env", "utf8").split(/\r?\n/).forEach(function (l) {
    var m = l.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || l.trim().charAt(0) === "#") return;
    var v = m[2].replace(/^(["'])(.*)\1$/, "$2");
    if (process.env[m[1]] === undefined || process.env[m[1]] === "") process.env[m[1]] = v;
  });
} catch (e) { console.error("env loader:", e.code || e.message); }
}

