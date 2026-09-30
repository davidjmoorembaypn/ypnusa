#!/usr/bin/env node
// Inserts hostinger/server-preamble.js (persistent data dir + app/.env loader) into a
// standalone build's server.js, right after `process.chdir(__dirname)`, so every release
// bundle carries it instead of depending on the build that happens to be live.
// Usage: node scripts/inject-server-preamble.mjs dist/nodejs/server.js
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const target = process.argv[2];
if (!target) {
  console.error("usage: node scripts/inject-server-preamble.mjs <server.js>");
  process.exit(2);
}

const preamble = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../hostinger/server-preamble.js"), "utf8");
const server = readFileSync(target, "utf8");
if (server.includes("YPN-ENV-LOADER")) {
  console.log(`${target}: preamble already present`);
  process.exit(0);
}

const anchor = "process.chdir(__dirname)";
const at = server.indexOf(anchor);
if (at < 0 || server.indexOf("const currentPort") < at) {
  console.error(`${target}: no \`${anchor}\` before \`const currentPort\`; is this a Next.js standalone server.js?`);
  process.exit(1);
}

const end = at + anchor.length;
writeFileSync(target, server.slice(0, end) + "\n" + preamble + server.slice(end));
console.log(`${target}: preamble injected`);
