#!/usr/bin/env node
// Tells IndexNow (Bing, Yandex and partners) which ypnus.com URLs exist, from the live sitemaps.
//
//   node scripts/ping-indexnow.mjs            # submit
//   node scripts/ping-indexnow.mjs --dry-run  # list what would be sent
//
// The key is the name of the one public/<32 hex>.txt file; that file's body is the same key, which
// proves we own the host. Run it AFTER a deploy is live: it first checks the key file is served from
// production, then submits every ypnus.com URL in /sitemap.xml and /local-seo-sitemap.xml.
// Exit codes: 0 submitted (or dry run), 1 failed, 2 setup problem. Callers that must not fail a
// deploy over this should ignore a non-zero exit.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const origin = (process.env.SITE_ORIGIN ?? "https://ypnus.com").replace(/\/$/, "");
const host = new URL(origin).host;
const endpoint = process.env.INDEXNOW_ENDPOINT ?? "https://api.indexnow.org/indexnow";
const dryRun = process.argv.includes("--dry-run");
const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const keyFiles = readdirSync(publicDir).filter((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (keyFiles.length !== 1) {
  console.error(`Expected exactly one public/<32 hex>.txt key file, found ${keyFiles.length}.`);
  process.exit(2);
}
const key = keyFiles[0].replace(".txt", "");
if (readFileSync(join(publicDir, keyFiles[0]), "utf8").trim() !== key) {
  console.error("The key file's content must equal its file name (without .txt).");
  process.exit(2);
}
const keyLocation = `${origin}/${key}.txt`;

async function text(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

try {
  if ((await text(keyLocation)).trim() !== key) throw new Error("served key does not match");
} catch (e) {
  console.error(`Key file is not live at ${keyLocation} (${e.message}). Deploy first, then ping.`);
  process.exit(2);
}

const urls = new Set();
for (const sitemap of ["/sitemap.xml", "/local-seo-sitemap.xml"]) {
  let xml;
  try {
    xml = await text(`${origin}${sitemap}`);
  } catch (e) {
    console.error(`Skipping ${sitemap}: ${e.message}`);
    continue;
  }
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const loc = m[1].trim().replace(/&amp;/g, "&");
    // IndexNow only accepts URLs on the submitting host; skip sitemap indexes and other hosts.
    if (new URL(loc).host === host && !loc.endsWith(".xml")) urls.add(loc);
  }
}
if (urls.size === 0) {
  console.error("No URLs found in the sitemaps.");
  process.exit(1);
}
console.log(`${urls.size} URLs from the sitemaps.`);
if (dryRun) process.exit(0);

// IndexNow takes up to 10,000 URLs per request.
const list = [...urls];
let failed = false;
for (let i = 0; i < list.length; i += 10_000) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation, urlList: list.slice(i, i + 10_000) }),
    signal: AbortSignal.timeout(60_000),
  });
  // 200 = received, 202 = received and key validation pending; both are success.
  console.log(`IndexNow ${res.status} for ${Math.min(10_000, list.length - i)} URLs`);
  if (res.status !== 200 && res.status !== 202) failed = true;
}
process.exit(failed ? 1 : 0);
