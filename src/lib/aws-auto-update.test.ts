// Tests for scripts/aws-auto-update.sh, the server's release auto-installer.
// Runs the real bash script against a fake GitHub (a stub `curl` on PATH that
// serves fixture files) and a temporary /opt/ypnusa, so nothing touches the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT = path.resolve(process.cwd(), "scripts/aws-auto-update.sh");
const REPO = "acme/app";
const API = "https://api.test";
const RAW = "https://raw.test";

type Env = {
  root: string;
  base: string;
  fixtures: string;
  curlLog: string;
  installLog: string;
  bin: string;
  env: NodeJS.ProcessEnv;
};

function fixtureName(url: string) {
  return url.replace(/[^A-Za-z0-9]/g, "_");
}

function setup(live: string | null): Env {
  const root = mkdtempSync(path.join(tmpdir(), "au-test-"));
  const base = path.join(root, "opt");
  const fixtures = path.join(root, "fixtures");
  const stubs = path.join(root, "stubs");
  const curlLog = path.join(root, "curl.log");
  const installLog = path.join(root, "install.log");
  const bin = path.join(root, "sbin", "ypnusa-auto-update");
  for (const d of [base, fixtures, stubs, path.join(base, "releases"), path.dirname(bin)]) mkdirSync(d, { recursive: true });
  if (live) {
    mkdirSync(path.join(base, "releases", live));
    symlinkSync(path.join(base, "releases", live), path.join(base, "current"));
  }
  // Stub curl: logs the URL, writes the matching fixture to -o FILE or stdout, else fails like `curl -f` on a 404.
  writeFileSync(
    path.join(stubs, "curl"),
    `#!/usr/bin/env bash
out=""; url=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    -H|--max-time|--retry) shift 2 ;;
    http*) url="$1"; shift ;;
    *) shift ;;
  esac
done
echo "$url" >> "${curlLog}"
f="${fixtures}/$(printf '%s' "$url" | sed 's/[^A-Za-z0-9]/_/g')"
[ -f "$f" ] || exit 22
if [ -n "$out" ]; then cp "$f" "$out"; else cat "$f"; fi
`,
  );
  chmodSync(path.join(stubs, "curl"), 0o755);
  const env = {
    ...process.env,
    PATH: `${stubs}:${process.env.PATH}`,
    YPNUSA_AU_REPO: REPO,
    YPNUSA_AU_API: API,
    YPNUSA_AU_RAW: RAW,
    YPNUSA_AU_BASE: base,
    YPNUSA_AU_STATE_DIR: path.join(root, "state"),
    YPNUSA_AU_PAUSE_FILE: path.join(root, "etc", "auto-update.paused"),
    YPNUSA_AU_LOCK: path.join(root, "lock", "au.lock"),
    YPNUSA_AU_BIN: bin,
    YPNUSA_AU_MAX_ATTEMPTS: "2",
  };
  return { root, base, fixtures, curlLog, installLog, bin, env };
}

function serve(e: Env, url: string, body: string) {
  writeFileSync(path.join(e.fixtures, fixtureName(url)), body);
}

function latestRelease(e: Env, tag: string, extra: Partial<{ draft: boolean; prerelease: boolean }> = {}) {
  serve(
    e,
    `${API}/repos/${REPO}/releases/latest`,
    JSON.stringify({ tag_name: tag, draft: extra.draft ?? false, prerelease: extra.prerelease ?? false }, null, 2),
  );
}

function compare(e: Env, live: string, latest: string, status: string) {
  serve(e, `${API}/repos/${REPO}/compare/${live}...${latest}`, JSON.stringify({ status }, null, 2));
}

// A fake installer for `tag`: "ok" switches current to the new release, "rollback" fails its checks,
// "early" fails before changing anything (like a download or backup failure).
function installer(e: Env, tag: string, mode: "ok" | "rollback" | "early") {
  const sha = tag.replace("app-build-", "");
  const body = {
    ok: `mkdir -p "${e.base}/releases/${sha}/scripts"; ln -sfn "${e.base}/releases/${sha}" "${e.base}/current"; echo "=== DEPLOY OK: live build ${sha}"`,
    rollback: `echo "ERROR: release ${sha} failed verification; rolling back" >&2; exit 1`,
    early: `echo "ERROR: pre-deploy backup failed; aborting before any change." >&2; exit 1`,
  }[mode];
  serve(e, `${RAW}/${REPO}/${tag}/scripts/aws-install-release.sh`, `#!/usr/bin/env bash\necho "$1" >> "${e.installLog}"\n${body}\n`);
}

function run(e: Env, cmd = "run") {
  return spawnSync("bash", [SCRIPT, cmd], { env: e.env, encoding: "utf8" });
}

const installs = (e: Env) => (existsSync(e.installLog) ? readFileSync(e.installLog, "utf8").trim().split("\n").filter(Boolean) : []);
const urls = (e: Env) => (existsSync(e.curlLog) ? readFileSync(e.curlLog, "utf8") : "");
const liveOf = (e: Env) => path.basename(readlinkSync(path.join(e.base, "current")));
const lastResult = (e: Env) => readFileSync(path.join(e.root, "state", "last-result"), "utf8");

test("installs a newer release with the installer from that release's tag, not main", (t) => {
  const e = setup("1111111");
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  latestRelease(e, "app-build-2222222");
  compare(e, "1111111", "2222222", "ahead");
  installer(e, "app-build-2222222", "ok");

  const r = run(e);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(installs(e), ["app-build-2222222"]);
  assert.equal(liveOf(e), "2222222");
  assert.match(urls(e), /raw\.test\/acme\/app\/app-build-2222222\/scripts\/aws-install-release\.sh/);
  assert.doesNotMatch(urls(e), /\/main\//);
  assert.match(lastResult(e), /INSTALLED app-build-2222222/);
});

test("does nothing when the live build is already the latest release", (t) => {
  const e = setup("2222222");
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  latestRelease(e, "app-build-2222222");
  installer(e, "app-build-2222222", "ok");

  const r = run(e);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /nothing to do/);
  assert.deepEqual(installs(e), []);
});

test("a paused updater does not even ask GitHub", (t) => {
  const e = setup("1111111");
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  latestRelease(e, "app-build-2222222");
  installer(e, "app-build-2222222", "ok");

  assert.equal(run(e, "pause").status, 0);
  const r = run(e);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /paused/);
  assert.equal(urls(e), "");
  assert.deepEqual(installs(e), []);

  assert.equal(run(e, "resume").status, 0);
  compare(e, "1111111", "2222222", "ahead");
  assert.equal(run(e).status, 0);
  assert.deepEqual(installs(e), ["app-build-2222222"]);
});

test("a release that fails and rolls back is never retried", (t) => {
  const e = setup("1111111");
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  latestRelease(e, "app-build-2222222");
  compare(e, "1111111", "2222222", "ahead");
  installer(e, "app-build-2222222", "rollback");

  assert.equal(run(e).status, 1);
  assert.match(lastResult(e), /ROLLED_BACK app-build-2222222/);
  const second = run(e);
  assert.equal(second.status, 0);
  assert.match(second.stdout, /not retrying/);
  assert.deepEqual(installs(e), ["app-build-2222222"]);
  assert.equal(liveOf(e), "1111111");
  assert.match(run(e, "status").stdout, /Never retried: +app-build-2222222/);
});

test("a failure before any change is retried, then given up after the attempt limit", (t) => {
  const e = setup("1111111");
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  latestRelease(e, "app-build-2222222");
  compare(e, "1111111", "2222222", "ahead");
  installer(e, "app-build-2222222", "early");

  assert.equal(run(e).status, 1);
  assert.equal(run(e).status, 1);
  const third = run(e);
  assert.equal(third.status, 0);
  assert.match(third.stdout, /giving up/);
  assert.equal(installs(e).length, 2); // YPNUSA_AU_MAX_ATTEMPTS=2
  assert.equal(run(e).status, 0);
  assert.equal(installs(e).length, 2);
});

test("never installs a build older than the live one", (t) => {
  const e = setup("3333333");
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  latestRelease(e, "app-build-2222222");
  compare(e, "3333333", "2222222", "behind");
  installer(e, "app-build-2222222", "ok");

  const r = run(e);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /not newer/);
  assert.deepEqual(installs(e), []);
});

test("ignores drafts, pre-releases and tags that are not app builds", (t) => {
  for (const [tag, extra] of [
    ["app-build-2222222", { draft: true }],
    ["app-build-2222222", { prerelease: true }],
    ["v1.0.0", {}],
    ["app-build-2222222; rm -rf /", {}],
  ] as const) {
    const e = setup("1111111");
    t.after(() => rmSync(e.root, { recursive: true, force: true }));
    latestRelease(e, tag, extra);
    installer(e, "app-build-2222222", "ok");
    const r = run(e);
    assert.equal(r.status, 0, `${tag} ${JSON.stringify(extra)}`);
    assert.deepEqual(installs(e), [], `${tag} ${JSON.stringify(extra)}`);
  }
});

test("GitHub being unreachable is not an error and installs nothing", (t) => {
  const e = setup("1111111");
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  const r = run(e);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /could not read the latest release/);
  assert.deepEqual(installs(e), []);
});

test("skips the run while another run holds the lock", (t) => {
  const e = setup("1111111");
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  latestRelease(e, "app-build-2222222");
  compare(e, "1111111", "2222222", "ahead");
  installer(e, "app-build-2222222", "ok");
  mkdirSync(path.dirname(e.env.YPNUSA_AU_LOCK!), { recursive: true });

  const r = spawnSync("flock", [e.env.YPNUSA_AU_LOCK!, "bash", SCRIPT, "run"], {
    env: { ...e.env, YPNUSA_AU_LOCK: e.env.YPNUSA_AU_LOCK },
    encoding: "utf8",
  });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /another update run/);
  assert.deepEqual(installs(e), []);
});

test("after a good install the updater refreshes itself from the release bundle", (t) => {
  const e = setup("1111111");
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  latestRelease(e, "app-build-2222222");
  compare(e, "1111111", "2222222", "ahead");
  writeFileSync(e.bin, "#!/usr/bin/env bash\necho old\n");
  const sha = "2222222";
  serve(
    e,
    `${RAW}/${REPO}/app-build-${sha}/scripts/aws-install-release.sh`,
    `#!/usr/bin/env bash
mkdir -p "${e.base}/releases/${sha}/scripts"
printf '#!/usr/bin/env bash\\necho new\\n' > "${e.base}/releases/${sha}/scripts/aws-auto-update.sh"
ln -sfn "${e.base}/releases/${sha}" "${e.base}/current"
`,
  );

  assert.equal(run(e).status, 0);
  assert.equal(readFileSync(e.bin, "utf8"), "#!/usr/bin/env bash\necho new\n");
});

test("install writes the 10-minute timer, turns it on and clears a pause", (t) => {
  const e = setup("1111111");
  t.after(() => rmSync(e.root, { recursive: true, force: true }));
  const stubs = path.join(e.root, "stubs");
  const units = path.join(e.root, "units");
  mkdirSync(units);
  writeFileSync(path.join(stubs, "id"), "#!/usr/bin/env bash\necho 0\n");
  writeFileSync(path.join(stubs, "systemctl"), `#!/usr/bin/env bash\necho "$*" >> "${e.root}/systemctl.log"\n`);
  chmodSync(path.join(stubs, "id"), 0o755);
  chmodSync(path.join(stubs, "systemctl"), 0o755);
  mkdirSync(path.dirname(e.env.YPNUSA_AU_PAUSE_FILE!), { recursive: true });
  writeFileSync(e.env.YPNUSA_AU_PAUSE_FILE!, "");

  const r = spawnSync("bash", [SCRIPT, "install"], { env: { ...e.env, YPNUSA_AU_UNIT_DIR: units }, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /AUTO-UPDATE ON/);
  assert.equal(readFileSync(e.bin, "utf8"), readFileSync(SCRIPT, "utf8"));
  assert.match(readFileSync(path.join(units, "ypnusa-auto-update.service"), "utf8"), new RegExp(`ExecStart=${e.bin} run`));
  assert.match(readFileSync(path.join(units, "ypnusa-auto-update.timer"), "utf8"), /OnUnitActiveSec=10min/);
  assert.match(readFileSync(path.join(e.root, "systemctl.log"), "utf8"), /enable --now ypnusa-auto-update\.timer/);
  assert.equal(existsSync(e.env.YPNUSA_AU_PAUSE_FILE!), false);
});
