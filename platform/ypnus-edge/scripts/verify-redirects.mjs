// Proves the SEO-equity promise: every legacy URL answers with ONE 301 to a page that returns 200.
//   node scripts/verify-redirects.mjs --base https://staging.ypnus.com --file legacy-urls.txt
//   (file: one path or full URL per line; a WordPress sitemap.xml also works with --sitemap)
// Exit code 1 if any URL fails. Use before and after the DNS cutover.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function verify({ base, paths, fetchImpl = fetch, concurrency = 8 }) {
  const failures = [];
  let ok = 0;
  const queue = [...paths];
  const worker = async () => {
    for (let p = queue.shift(); p !== undefined; p = queue.shift()) {
      try {
        const first = await fetchImpl(new URL(p, base), { redirect: "manual" });
        if (first.status === 410) { ok++; continue; } // intentional removals
        if (first.status === 200) { ok++; continue; } // URL already valid on the new site
        if (first.status !== 301) { failures.push({ path: p, problem: `expected 301, got ${first.status}` }); continue; }
        const location = first.headers.get("location");
        const target = new URL(location, base);
        const second = await fetchImpl(target, { redirect: "manual" });
        if (second.status === 301 || second.status === 302 || second.status === 308) failures.push({ path: p, problem: `redirect chain: ${location} -> ${second.headers.get("location")}` });
        else if (second.status !== 200) failures.push({ path: p, problem: `target ${location} returned ${second.status}` });
        else ok++;
      } catch (err) {
        failures.push({ path: p, problem: `request failed: ${String(err.message).slice(0, 80)}` });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, paths.length || 1) }, worker));
  return { checked: paths.length, ok, failures };
}

export const pathsFromSitemap = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => new URL(m[1]).pathname);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name) => process.argv[process.argv.indexOf(`--${name}`) + 1];
  const base = arg("base");
  const file = arg("file") ?? arg("sitemap");
  if (!base || !file) { console.error("usage: --base <url> (--file urls.txt | --sitemap sitemap.xml)"); process.exit(2); }
  const text = readFileSync(file, "utf8");
  const paths = process.argv.includes("--sitemap") ? pathsFromSitemap(text) : text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => (l.startsWith("http") ? new URL(l).pathname + new URL(l).search : l));
  const result = await verify({ base, paths });
  console.log(`${result.ok}/${result.checked} OK`);
  for (const f of result.failures.slice(0, 50)) console.log(`FAIL ${f.path}: ${f.problem}`);
  process.exit(result.failures.length ? 1 : 0);
}
