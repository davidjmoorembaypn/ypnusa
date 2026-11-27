#!/usr/bin/env node
// Fails the build when the standalone output (.next/standalone) contains the project's own
// source tree.
//
// Next.js copies into the standalone output every file a server route might read. A file read
// whose path is only known at runtime (fs.readFileSync(someVariable)) makes its file tracer give
// up and copy the WHOLE project: src/, docs/, sites/, a second public/. The release bundle then
// grows by half and ships the source. The fix is a /*turbopackIgnore: true*/ comment on that
// read (see src/lib/backup-status.ts or src/lib/ai/provider.ts for the pattern).
//
// Run after `npm run build`. Used by CI and by the release build before a bundle is published.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? ".next/standalone";
if (!existsSync(root)) {
  console.error(`check-standalone-bundle: ${root} does not exist. Run "npm run build" first.`);
  process.exit(2);
}

// What a correct standalone output holds at its top level. "data" is the local data folder when
// one exists on the build machine; the release build removes it before packing.
const EXPECTED = new Set([".next", "node_modules", "package.json", "server.js", "data"]);
const unexpected = readdirSync(root).filter((name) => !EXPECTED.has(name));
// The ones that prove the whole project was copied, as opposed to one stray file.
const projectCopied = ["src", "docs", "sites", ".github"].filter((name) => existsSync(join(root, name)));

if (projectCopied.length > 0) {
  console.error(
    `check-standalone-bundle: FAILED. ${root} contains the project's own ${projectCopied.join(", ")} folder(s), ` +
      `so the file tracer copied the whole project into the bundle.\n` +
      `A server file reads a path that is only known at runtime. Find the newest fs read with a variable path ` +
      `and mark it /*turbopackIgnore: true*/ (pattern: src/lib/backup-status.ts).\n` +
      `Top-level entries that should not be there: ${unexpected.join(", ")}`,
  );
  process.exit(1);
}
if (unexpected.length > 0) {
  console.warn(`check-standalone-bundle: unexpected top-level entries (not failing): ${unexpected.join(", ")}`);
}
console.log(`check-standalone-bundle: ok (${root} holds ${readdirSync(root).join(", ")})`);
