import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";

/**
 * Runs the real scripts in scripts/mcp/ (setup.sh, cleanup.sh) against a temporary settings file, a stand-in
 * for systemctl and a fake health endpoint, so the restore-on-failure and token rules cannot regress.
 */

const SCRIPTS = path.join(process.cwd(), "scripts", "mcp");
const BEGIN = "# BEGIN ypnusa-mcp (managed by scripts/mcp/setup.sh)";
const END = "# END ypnusa-mcp";
const BASE_ENV = "SESSION_SECRET=keep-me\nSTRIPE_KEY=also-keep\n";

let server: http.Server;
let healthy = true;
let healthUrl = "";
let dir = "";

const envFile = () => path.join(dir, "app.env");
const read = () => fs.readFileSync(envFile(), "utf8");
const calls = () => (fs.existsSync(path.join(dir, "systemctl.log")) ? fs.readFileSync(path.join(dir, "systemctl.log"), "utf8").trim().split("\n").filter(Boolean) : []);
const tokenIn = (text: string) => /^MCP_BEARER_TOKEN=(.*)$/m.exec(text)?.[1];

/** A systemctl stand-in that logs each call and fails the first `failFirst` restarts. */
function stubSystemctl(failFirst = 0): string {
  const file = path.join(dir, "systemctl");
  fs.writeFileSync(
    file,
    `#!/bin/sh
echo "$*" >> "${dir}/systemctl.log"
n=$(wc -l < "${dir}/systemctl.log")
[ "$n" -le ${failFirst} ] && exit 1
exit 0
`,
    { mode: 0o755 },
  );
  return file;
}

function run(script: string, args: string[], extraEnv: Record<string, string> = {}): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn("bash", [path.join(SCRIPTS, script), ...args], {
      env: {
        ...process.env,
        ENV_FILE: envFile(),
        SYSTEMCTL: path.join(dir, "systemctl"),
        HEALTH_URL: healthUrl,
        LOCAL_MCP_URL: healthUrl,
        HEALTH_TRIES: "1",
        ALLOW_NON_ROOT: "1",
        ...extraEnv,
      },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code: code ?? -1, out }));
  });
}

describe("MCP operator scripts", () => {
  before(async () => {
    server = http.createServer((_req, res) => {
      res.statusCode = healthy ? 200 : 503;
      res.setHeader("content-type", "application/json");
      res.end(healthy ? '{"ok":true}' : '{"ok":false}');
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    healthUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/health`;
  });
  after(() => server.close());
  beforeEach(() => {
    healthy = true;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ypnus-mcp-ops-"));
    fs.writeFileSync(envFile(), BASE_ENV, { mode: 0o600 });
    stubSystemctl();
  });

  describe("setup.sh", () => {
    it("writes only its own block, keeps other lines, restarts once and leaves the file mode 600", async () => {
      const r = await run("setup.sh", ["--no-cerebro", "--hourly", "60", "--origins", "https://partner.example"]);
      assert.equal(r.code, 0, r.out);
      assert.equal(read(), `${BASE_ENV}${BEGIN}\nMCP_CEREBRO_CHAT=off\nMCP_CEREBRO_HOURLY_LIMIT=60\nMCP_ALLOWED_ORIGINS=https://partner.example\n${END}\n`);
      assert.equal(fs.statSync(envFile()).mode & 0o777, 0o600);
      assert.equal(calls().length, 1);
      assert.ok(fs.readdirSync(dir).some((f) => f.startsWith("app.env.bak.")), "a backup was kept");
    });

    it("is idempotent: the same settings again change nothing and restart nothing", async () => {
      await run("setup.sh", ["--no-cerebro"]);
      const before = read();
      const r = await run("setup.sh", ["--no-cerebro"]);
      assert.match(r.out, /already match/);
      assert.equal(read(), before);
      assert.equal(calls().length, 1);
    });

    it("keeps an existing bearer token that contains equals signs, unless --rotate", async () => {
      fs.writeFileSync(envFile(), `${BASE_ENV}${BEGIN}\nMCP_BEARER_TOKEN=YWJjZA==\n${END}\n`);
      const kept = await run("setup.sh", ["--private"]);
      assert.equal(kept.code, 0, kept.out);
      assert.equal(tokenIn(read()), "YWJjZA==", "the token must not be truncated at the first =");
      assert.equal(calls().length, 0, "nothing changed, so no restart");
      const rotated = await run("setup.sh", ["--private", "--rotate"]);
      assert.equal(rotated.code, 0, rotated.out);
      assert.match(tokenIn(read()) ?? "", /^[0-9a-f]{64}$/);
    });

    it("creates a 64-hex token with --private", async () => {
      const r = await run("setup.sh", ["--private"]);
      assert.equal(r.code, 0, r.out);
      assert.match(tokenIn(read()) ?? "", /^[0-9a-f]{64}$/);
      assert.ok(r.out.includes(tokenIn(read()) as string), "the token is shown once");
    });

    it("refuses to make a token when openssl fails, and changes nothing", async () => {
      fs.writeFileSync(path.join(dir, "openssl"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
      const r = await run("setup.sh", ["--private"], { PATH: `${dir}:${process.env.PATH}` });
      assert.notEqual(r.code, 0);
      assert.equal(read(), BASE_ENV);
      assert.equal(calls().length, 0);
    });

    for (const bad of ["0", "000", "-5", "abc", "1.5"]) {
      it(`rejects --hourly ${bad} and changes nothing`, async () => {
        const r = await run("setup.sh", ["--hourly", bad]);
        assert.equal(r.code, 2, r.out);
        assert.match(r.out, /positive whole number/);
        assert.equal(read(), BASE_ENV);
      });
    }

    it("puts the old settings back, and restarts again, when the restart command fails", async () => {
      stubSystemctl(1);
      const r = await run("setup.sh", ["--no-cerebro"]);
      assert.equal(r.code, 1, r.out);
      assert.equal(read(), BASE_ENV, "the old file is restored");
      assert.equal(calls().length, 2, "restarted once with the new settings (failed) and once with the old");
      assert.match(r.out, /previous settings are back/);
    });

    it("puts the old settings back when the site restarts but is not healthy", async () => {
      healthy = false;
      const r = await run("setup.sh", ["--no-cerebro"]);
      assert.equal(r.code, 1, r.out);
      assert.equal(read(), BASE_ENV);
      assert.equal(calls().length, 2);
      assert.match(r.out, /still not healthy/);
    });

    it("a dry run writes nothing and hides the token", async () => {
      const r = await run("setup.sh", ["--dry-run", "--private"]);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /token hidden/);
      assert.equal(read(), BASE_ENV);
      assert.equal(calls().length, 0);
    });
  });

  describe("cleanup.sh", () => {
    const withBlock = `${BASE_ENV}${BEGIN}\nMCP_CEREBRO_CHAT=off\n${END}\n`;

    it("removes the block, keeps every other line and is idempotent", async () => {
      fs.writeFileSync(envFile(), withBlock);
      const r = await run("cleanup.sh", []);
      assert.equal(r.code, 0, r.out);
      assert.equal(read(), BASE_ENV);
      assert.equal(calls().length, 1);
      const again = await run("cleanup.sh", []);
      assert.match(again.out, /Nothing to change/);
      assert.equal(calls().length, 1);
    });

    it("--lockdown writes a 64-hex token nobody is shown", async () => {
      const r = await run("cleanup.sh", ["--lockdown"]);
      assert.equal(r.code, 0, r.out);
      const token = tokenIn(read()) ?? "";
      assert.match(token, /^[0-9a-f]{64}$/);
      assert.ok(!r.out.includes(token), "the lockdown token is never printed");
      assert.ok(read().startsWith(BASE_ENV));
      assert.equal(fs.statSync(envFile()).mode & 0o777, 0o600);
    });

    it("--lockdown never writes an empty token when openssl fails: it stops and changes nothing", async () => {
      fs.writeFileSync(path.join(dir, "openssl"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
      const r = await run("cleanup.sh", ["--lockdown"], { PATH: `${dir}:${process.env.PATH}` });
      assert.notEqual(r.code, 0);
      assert.equal(read(), BASE_ENV);
      assert.ok(!/MCP_BEARER_TOKEN=\s*$/m.test(read()));
      assert.equal(calls().length, 0, "no restart either");
      assert.match(r.out, /Could not generate a token/);
    });

    it("--lockdown also refuses a token that is not 64 hex characters", async () => {
      fs.writeFileSync(path.join(dir, "openssl"), "#!/bin/sh\necho short\n", { mode: 0o755 });
      const r = await run("cleanup.sh", ["--lockdown"], { PATH: `${dir}:${process.env.PATH}` });
      assert.notEqual(r.code, 0);
      assert.equal(read(), BASE_ENV);
    });

    it("restores the file, and restarts again, when the restart fails", async () => {
      fs.writeFileSync(envFile(), withBlock);
      stubSystemctl(1);
      const r = await run("cleanup.sh", []);
      assert.equal(r.code, 1, r.out);
      assert.equal(read(), withBlock);
      assert.equal(calls().length, 2);
    });

    it("--prune-backups deletes only old backups", async () => {
      const old = path.join(dir, "app.env.bak.OLD");
      const fresh = path.join(dir, "app.env.bak.FRESH");
      fs.writeFileSync(old, "x");
      fs.writeFileSync(fresh, "y");
      const past = new Date(Date.now() - 30 * 86_400_000);
      fs.utimesSync(old, past, past);
      const r = await run("cleanup.sh", ["--prune-backups"]);
      assert.equal(r.code, 0, r.out);
      assert.ok(!fs.existsSync(old));
      assert.ok(fs.existsSync(fresh));
    });
  });

  describe("action.sh", () => {
    it("has an empty-array-safe expansion for the optional auth header (bash older than 4.4 under set -u)", () => {
      const text = fs.readFileSync(path.join(SCRIPTS, "action.sh"), "utf8");
      assert.ok(!/(?<!\+)"\$\{auth\[@\]\}"/.test(text), "a bare expansion of a possibly empty array");
      assert.equal((text.match(/\$\{auth\[@\]\+"\$\{auth\[@\]\}"\}/g) ?? []).length, 3);
    });

    it("reads the last status line, because a proxy prints its own CONNECT line first", () => {
      const text = fs.readFileSync(path.join(SCRIPTS, "action.sh"), "utf8");
      assert.ok(!text.includes("head -1 | grep"), "the first status line can belong to a proxy");
      assert.ok(text.includes("tail -1"));
    });
  });
});
