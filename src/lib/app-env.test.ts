import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { appEnvFilePath, loadAppEnvFile, parseEnvFile } from "./app-env";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-appenv-"));

describe("parseEnvFile", () => {
  it("handles comments, quotes, export, blank lines and CRLF", () => {
    const parsed = parseEnvFile(
      ["# comment", "", "A=1", 'B="two words"', "C='single'", "export D=four", "E=five # trailing", "F=", "bad line", "G = spaced\r"].join("\r\n"),
    );
    assert.deepEqual(parsed, { A: "1", B: "two words", C: "single", D: "four", E: "five", F: "", G: "spaced" });
  });

  it("keeps = and # inside quoted values", () => {
    assert.deepEqual(parseEnvFile('TOKEN="a=b#c"'), { TOKEN: "a=b#c" });
  });
});

describe("appEnvFilePath", () => {
  it("does nothing outside a Hostinger versions folder (so local dev never reads a stray .env)", () => {
    assert.equal(appEnvFilePath({}, path.join(tmp, "some", "project")), null);
  });

  it("finds the app folder four levels above the version's nodejs folder", () => {
    const cwd = path.join(tmp, "app", "hbuilds", "versions", "abc", "nodejs");
    assert.equal(appEnvFilePath({}, cwd), path.join(tmp, "app", ".env"));
  });

  it("honors an explicit YPNUS_ENV_FILE anywhere", () => {
    assert.equal(appEnvFilePath({ YPNUS_ENV_FILE: "/x/.env" }, "/anywhere"), "/x/.env");
  });
});

describe("loadAppEnvFile", () => {
  it("fills missing values, never overrides existing ones, and returns only names", () => {
    const app = fs.mkdtempSync(path.join(tmp, "app-"));
    const cwd = path.join(app, "hbuilds", "versions", "v1", "nodejs");
    fs.mkdirSync(cwd, { recursive: true });
    fs.writeFileSync(path.join(app, ".env"), "LOANPILOT_DATA_DIR=/persist\nSESSION_SECRET=from-file\nEMPTY_ONE=filled\n");
    const env: Record<string, string | undefined> = { SESSION_SECRET: "already-set", EMPTY_ONE: "" };
    const names = loadAppEnvFile(env, cwd);
    assert.deepEqual(names.sort(), ["EMPTY_ONE", "LOANPILOT_DATA_DIR"]);
    assert.equal(env.LOANPILOT_DATA_DIR, "/persist");
    assert.equal(env.SESSION_SECRET, "already-set");
    assert.equal(env.EMPTY_ONE, "filled");
  });

  it("is a no-op when the file is missing", () => {
    const cwd = path.join(tmp, "nowhere", "hbuilds", "versions", "v1", "nodejs");
    assert.deepEqual(loadAppEnvFile({}, cwd), []);
  });
});
