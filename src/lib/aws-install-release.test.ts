// Tests for scripts/aws-install-release.sh, the server's release installer.
// Runs the real bash script against a temporary /opt/ypnusa, a fake build download,
// a fake app health endpoint and a fake systemctl (stubs on PATH), so nothing
// touches the network or a real service.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync, utimesSync } from "node:fs";
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
  const workspace = path.join(root, "workspace");
  for (const d of [base, stubs, build, workspace, path.join(base, "releases")]) mkdirSync(d, { recursive: true });
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
    YPNUSA_INSTALL_WORK_ROOT: workspace,
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
  assert.deepEqual(readdirSync(path.join(e.root, "workspace")), []);
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

// The IndexNow ping runs after a verified deploy and must never change the deploy's result.
function pingStub(e: Env, exitCode: number) {
  const script = path.join(e.root, "ping.mjs");
  const log = path.join(e.root, "ping.log");
  writeFileSync(script, `import { appendFileSync } from "node:fs";\nappendFileSync(${JSON.stringify(log)}, "ran");\nprocess.exit(${exitCode});\n`);
  return { script, ran: () => existsSync(log) };
}

test("a healthy build runs the IndexNow ping after verification", (t) => {
  const e = setup();
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  const ping = pingStub(e, 0);
  const r = install(e, { YPNUSA_INSTALL_INDEXNOW: ping.script });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(ping.ran(), "ping did not run");
  assert.ok(r.stdout.indexOf("DEPLOY OK") < r.stdout.indexOf("IndexNow ping"));
});

test("a failing IndexNow ping only warns; the deploy still succeeds", (t) => {
  const e = setup();
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  const ping = pingStub(e, 1);
  const r = install(e, { YPNUSA_INSTALL_INDEXNOW: ping.script });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(ping.ran(), "ping did not run, so the failure path was not exercised");
  assert.match(r.stderr, /IndexNow ping failed/);
  assert.equal(liveOf(e), NEW);
});

test("a rolled-back build never pings IndexNow", (t) => {
  const e = setup({ unhealthy: [NEW] });
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  const ping = pingStub(e, 0);
  const r = install(e, { YPNUSA_INSTALL_INDEXNOW: ping.script });
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.ok(!ping.ran(), "ping ran after a rollback");
});

test("YPNUSA_SKIP_INDEXNOW=1 turns the ping off", (t) => {
  const e = setup();
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  const ping = pingStub(e, 0);
  const r = install(e, { YPNUSA_INSTALL_INDEXNOW: ping.script, YPNUSA_SKIP_INDEXNOW: "1" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(!ping.ran());
});

// Release folders grow to several GB each. Five of them filled the server's 20 GB disk on
// 2026-11-27 and stopped every update, so only three are kept and space is made before a download.
function oldReleases(e: Env, names: string[]) {
  names.forEach((name, i) => {
    const dir = path.join(e.base, "releases", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "server.js"), "");
    // Oldest first: each folder is a day older than the next.
    const when = new Date(Date.now() - (names.length - i) * 86_400_000);
    utimesSync(dir, when, when);
  });
}

test("keeps the live release and the two newest others, and removes the rest", (t) => {
  const e = setup();
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  oldReleases(e, ["aaaaaaa", "bbbbbbb", "ccccccc", "ddddddd"]);
  const r = install(e);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(liveOf(e), NEW);
  assert.deepEqual(readdirSync(path.join(e.base, "releases")).sort(), [OLD, NEW, "ddddddd"].sort());
});

test("makes room before the download when the disk is nearly full, never removing the live release", (t) => {
  const e = setup();
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  oldReleases(e, ["aaaaaaa", "bbbbbbb", "ccccccc"]);
  // A threshold no disk can meet stands in for a full disk.
  const r = install(e, { YPNUSA_INSTALL_MIN_FREE_MB: "999999999999" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.indexOf("removing old releases before the download") < r.stdout.indexOf("=== Download"));
  assert.match(r.stdout, /removing old release aaaaaaa/);
  assert.equal(liveOf(e), NEW);
  assert.deepEqual(readdirSync(path.join(e.base, "releases")).sort(), [OLD, NEW, "ccccccc"].sort());
});

test("a ping that fails at first is tried again", (t) => {
  const e = setup();
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  const counter = path.join(e.root, "ping-count");
  const script = path.join(e.root, "flaky-ping.mjs");
  writeFileSync(
    script,
    `import { appendFileSync, readFileSync } from "node:fs";\nappendFileSync(${JSON.stringify(counter)}, "x");\nprocess.exit(readFileSync(${JSON.stringify(counter)}, "utf8").length >= 2 ? 0 : 2);\n`,
  );
  const r = install(e, { YPNUSA_INSTALL_INDEXNOW: script });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(readFileSync(counter, "utf8"), "xx");
  assert.doesNotMatch(r.stderr, /IndexNow ping failed/);
});
