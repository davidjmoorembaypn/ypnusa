// The start-up preamble spliced into every release bundle's server.js (hostinger/server-preamble.js).
// The same bundle runs on Hostinger, where the preamble loads app/.env, and on the AWS server,
// where systemd supplies the settings and the preamble must stay out of the way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const PREAMBLE = readFileSync(path.join(process.cwd(), "hostinger", "server-preamble.js"), "utf8");

/** Runs the preamble the way a bundle does: at the top of a CommonJS server.js, after chdir. */
function start(env: Record<string, string>, t: { after: (fn: () => void) => void }) {
  const dir = mkdtempSync(path.join(tmpdir(), "preamble-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const server = path.join(dir, "server.js");
  writeFileSync(
    server,
    `process.chdir(__dirname)\n${PREAMBLE}\nconsole.log(JSON.stringify({ A: process.env.PREAMBLE_A, B: process.env.PREAMBLE_B, C: process.env.PREAMBLE_C }));\n`,
  );
  const run = spawnSync(process.execPath, [server], { env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env }, encoding: "utf8" });
  return { dir, run };
}

test("away from Hostinger with no file named, the loader does nothing and prints nothing", (t) => {
  const { run } = start({ LOANPILOT_DATA_DIR: "/var/lib/ypnusa", PREAMBLE_A: "from-systemd" }, t);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stderr, "", "no 'env loader:' line in the server log");
  assert.deepEqual(JSON.parse(run.stdout), { A: "from-systemd" });
});

test("a named file is loaded: unset and empty settings are filled, set ones are kept", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "preamble-env-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "app.env");
  writeFileSync(file, '# a comment\nPREAMBLE_A=from-file\nexport PREAMBLE_B="quoted value"\nPREAMBLE_C=filled\n');
  const { run } = start({ YPNUS_ENV_FILE: file, PREAMBLE_A: "already-set", PREAMBLE_C: "" }, t);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stderr, "");
  assert.deepEqual(JSON.parse(run.stdout), { A: "already-set", B: "quoted value", C: "filled" });
});

test("a named file that cannot be read is still reported, and the server still starts", (t) => {
  const { run } = start({ YPNUS_ENV_FILE: "/nonexistent/ypn/app.env" }, t);
  assert.equal(run.status, 0);
  assert.match(run.stderr, /^env loader: ENOENT/);
});

test("on Hostinger the loader still reads that account's app/.env", () => {
  // The Hostinger path cannot exist on a test machine; check the rule itself.
  assert.match(PREAMBLE, /__dirname\.indexOf\("\/home\/u853154979\/"\) === 0 \? "\/home\/u853154979\/domains\/ypnus\.com\/app\/\.env"/);
  assert.ok(PREAMBLE.includes("YPN-ENV-LOADER"), "the marker the installers look for is kept");
});
