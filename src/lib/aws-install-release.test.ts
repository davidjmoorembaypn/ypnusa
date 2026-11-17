// Tests for scripts/aws-install-release.sh, the server's release installer.
// Runs the real bash script against a temporary /opt/ypnusa, a fake build download,
// a fake app health endpoint and a fake systemctl (stubs on PATH), so nothing
// touches the network or a real service.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT = path.resolve(process.cwd(), "scripts/aws-install-release.sh");
const NEW = "2222222";
const OLD = "1111111";

type Env = { root: string; base: string; env: NodeJS.ProcessEnv };

function stub(dir: string, name: string, body: string) {
  writeFileSync(path.join(dir, name), `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path.join(dir, name), 0o755);
}

/**
 * `failRestart` / `unhealthy` list the builds whose restart fails or whose health check
 * never comes good. The fake health endpoint reports whichever build `current` points at.
 */
function setup(opts: { failRestart?: string[]; unhealthy?: string[]; live?: string | null } = {}): Env {
  const root = mkdtempSync(path.join(tmpdir(), "install-test-"));
  const base = path.join(root, "opt");
  const stubs = path.join(root, "stubs");
  const build = path.join(root, "build");
  for (const d of [base, stubs, build, path.join(base, "releases")]) mkdirSync(d, { recursive: true });
  const live = opts.live === undefined ? OLD : opts.live;
  if (live) {
    mkdirSync(path.join(base, "releases", live));
    symlinkSync(path.join(base, "releases", live), path.join(base, "current"));
  }

  // The release bundle for NEW, with its checksum file.
  const src = path.join(root, "src");
  mkdirSync(path.join(src, "nodejs"), { recursive: true });
  writeFileSync(path.join(src, "nodejs", "server.js"), "// app\n");
  writeFileSync(path.join(src, "nodejs", "DEPLOY_MANIFEST.json"), JSON.stringify({ git_commit: `${NEW}abcdef0123` }));
  assert.equal(spawnSync("tar", ["-czf", path.join(build, "app-build.tar.gz"), "-C", src, "nodejs"]).status, 0);
  const sum = createHash("sha256").update(readFileSync(path.join(build, "app-build.tar.gz"))).digest("hex");
  writeFileSync(path.join(build, "app-build.tar.gz.sha256"), `${sum}  app-build.tar.gz\n`);

  const failRestart = new Set(opts.failRestart ?? []);
  const unhealthy = new Set(opts.unhealthy ?? []);
  writeFileSync(path.join(root, "fail-restart"), [...failRestart].join("\n") + "\n");
  writeFileSync(path.join(root, "unhealthy"), [...unhealthy].join("\n") + "\n");

  stub(
    stubs,
    "curl",
    `out=""; url=""; wfmt=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    -w) wfmt="$2"; shift 2 ;;
    --max-time|--retry) shift 2 ;;
    http*) url="$1"; shift ;;
    *) shift ;;
  esac
done
live="$(basename "$(readlink -f "${base}/current")")"
case "$url" in
  http://build.test/*) cp "${build}/$(basename "$url")" "$out" ;;
  http://app.test/api/health)
    grep -qx "$live" "${root}/unhealthy" && exit 7
    printf '{"ok":true,"build":{"commit":"%s"},"storage":{"persistent":true,"degraded":false}}' "$live" ;;
  http://app.test/*) [ -n "$wfmt" ] && printf 200 ;;
  *) exit 22 ;;
esac`,
  );
  stub(
    stubs,
    "systemctl",
    `echo "$*" >> "${root}/systemctl.log"
live="$(basename "$(readlink -f "${base}/current")")"
if [ "$1" = restart ] && grep -qx "$live" "${root}/fail-restart"; then echo "Job for ypnusa.service failed." >&2; exit 1; fi
exit 0`,
  );
  stub(stubs, "chown", "exit 0");
  stub(stubs, "sleep", "exit 0");

  const env = {
    ...process.env,
    PATH: `${stubs}:${process.env.PATH}`,
    YPNUS_BUILD_URL: "http://build.test",
    YPNUSA_INSTALL_BASE: base,
    YPNUSA_INSTALL_HEALTH_URL: "http://app.test/api/health",
    YPNUSA_INSTALL_APP_URL: "http://app.test",
    YPNUSA_INSTALL_BACKUP_TOOL: path.join(root, "no-backup-tool"),
    YPNUSA_INSTALL_LOCK_DIR: path.join(root, "lock"),
    YPNUSA_INSTALL_VERIFY_TRIES: "2",
  };
  return { root, base, env };
}

const install = (e: Env, extra: Record<string, string> = {}) =>
  spawnSync("bash", [SCRIPT, `app-build-${NEW}`], { env: { ...e.env, ...extra }, encoding: "utf8" });
const liveOf = (e: Env) => path.basename(readlinkSync(path.join(e.base, "current")));
const restarts = (e: Env) => {
  const log = path.join(e.root, "systemctl.log");
  return existsSync(log) ? readFileSync(log, "utf8").split("\n").filter((l) => l.startsWith("restart")).length : 0;
};

test("a healthy build is switched in and kept", (t) => {
  const e = setup();
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  const r = install(e);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /DEPLOY OK: live build 2222222/);
  assert.equal(liveOf(e), NEW);
});

test("a build whose service fails to restart is rolled back to the previous build", (t) => {
  const e = setup({ failRestart: [NEW] });
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  const r = install(e);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stderr, /did not start .*rolling back/);
  assert.match(r.stdout, /ROLLED BACK: previous build 1111111 is live again/);
  assert.equal(liveOf(e), OLD);
  assert.equal(restarts(e), 2);
});

test("a build that fails its health checks is rolled back and the old one confirmed healthy", (t) => {
  const e = setup({ unhealthy: [NEW] });
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  const r = install(e);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stderr, /failed verification; rolling back/);
  assert.equal(liveOf(e), OLD);
});

test("when the rollback itself fails the installer says so with its own exit code", (t) => {
  const e = setup({ failRestart: [NEW, OLD] });
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  const r = install(e);
  assert.equal(r.status, 4, r.stdout + r.stderr);
  assert.match(r.stderr, /ROLLBACK FAILED/);
});

test("a rollback that never answers its health check is reported as failed, not as rolled back", (t) => {
  const e = setup({ unhealthy: [NEW, OLD] });
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  const r = install(e);
  assert.equal(r.status, 4, r.stdout + r.stderr);
  assert.match(r.stderr, /ROLLBACK FAILED: the previous build 1111111 did not answer/);
});

test("a pause stops the install before anything is switched or restarted", (t) => {
  const e = setup();
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  const pause = path.join(e.root, "auto-update.paused");
  writeFileSync(pause, "");
  const r = install(e, { YPNUSA_ABORT_IF_FILE: pause });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /Auto-update was paused/);
  assert.equal(liveOf(e), OLD);
  assert.equal(restarts(e), 0);
});

test("a hand install is not stopped by the auto-update pause file", (t) => {
  const e = setup();
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  writeFileSync(path.join(e.root, "auto-update.paused"), "");
  const r = install(e); // no YPNUSA_ABORT_IF_FILE, as when David installs by hand
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(liveOf(e), NEW);
});
