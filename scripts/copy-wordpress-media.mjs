#!/usr/bin/env node
/**
 * Copies the WordPress media the app still links to (/wp-content/uploads/...) onto this server,
 * so ypnus.com keeps showing its images and videos after WordPress is switched off.
 * Plain Node 20+, no dependencies; it ships inside the release bundle.
 *
 *   node scripts/copy-wordpress-media.mjs                  # dry run: lists the files, downloads nothing
 *   node scripts/copy-wordpress-media.mjs --apply          # downloads into /var/www/ypnus-uploads
 *   node scripts/copy-wordpress-media.mjs --apply --dest ./uploads --origin https://ypnus.com --scan src
 *
 * The file list comes from scanning --scan (default: ./src in a checkout, else ./.next in a
 * release). Run it while WordPress still answers at --origin. It only reads from WordPress.
 * Files already present with the same size are not rewritten, so it is safe to run again.
 * A manifest (path, bytes, sha256, failures) is written to <dest>/manifest.json; any failure
 * sets exit code 1.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UPLOAD_PATH = /\/wp-content\/uploads\/[A-Za-z0-9._\-/%]+\.(?:jpe?g|png|webp|gif|svg|avif|ico|mp4|webm|mov|pdf)/gi;

/** Every distinct upload path in the given texts (JSON-escaped slashes included), sorted. */
export function collectUploadPaths(texts) {
  const found = new Set();
  for (const text of texts) {
    for (const match of text.replace(/\\\//g, "/").matchAll(UPLOAD_PATH)) {
      let clean;
      try {
        clean = decodeURIComponent(match[0]);
      } catch {
        continue;
      }
      if (!clean.includes("..")) found.add(clean);
    }
  }
  return [...found].sort();
}

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "cache") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?|json|md|mdx|css|html|rsc)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

async function download(urlPath, origin, dest) {
  const target = path.join(dest, urlPath.replace(/^\/wp-content\/uploads\//, ""));
  if (!target.startsWith(dest + path.sep)) return { error: "path escapes destination" };
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(origin + encodeURI(urlPath), { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) return { error: `HTTP ${response.status}` };
      const body = Buffer.from(await response.arrayBuffer());
      const declared = response.headers.get("content-length");
      if (declared && Number(declared) !== body.length) throw new Error(`short read ${body.length}/${declared}`);
      const sha256 = createHash("sha256").update(body).digest("hex");
      if (!(existsSync(target) && statSync(target).size === body.length)) {
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, body);
      }
      return { bytes: body.length, sha256 };
    } catch (error) {
      if (attempt === 3) return { error: error instanceof Error ? error.message : String(error) };
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  return { error: "unreachable" };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dest = path.resolve(argValue("--dest", "/var/www/ypnus-uploads"));
  const origin = argValue("--origin", "https://ypnus.com").replace(/\/+$/, "");
  const scan = argValue("--scan", existsSync("src") ? "src" : ".next");
  const paths = collectUploadPaths(walk(scan).map((file) => readFileSync(file, "utf8")));
  console.log(`${paths.length} media files referenced (scanned ${scan}).`);
  if (!apply) {
    for (const p of paths) console.log(`  ${p}`);
    console.log(`Dry run. Add --apply to download from ${origin} into ${dest}.`);
    return;
  }
  mkdirSync(dest, { recursive: true });
  const files = [];
  const failures = [];
  const queue = [...paths];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const result = await download(next, origin, dest);
        if ("error" in result) failures.push({ path: next, error: result.error });
        else files.push({ path: next, ...result });
      }
    }),
  );
  files.sort((a, b) => a.path.localeCompare(b.path));
  writeFileSync(path.join(dest, "manifest.json"), JSON.stringify({ origin, copiedAt: new Date().toISOString(), files, failures }, null, 2));
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  console.log(`Copied ${files.length} files (${(total / 1_048_576).toFixed(1)} MB) into ${dest}.`);
  if (failures.length) {
    console.error(`${failures.length} failed:`);
    for (const failure of failures) console.error(`  ${failure.path}: ${failure.error}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
