#!/usr/bin/env node
/**
 * Downloads the blog header photos listed in src/content/blog-images/photos.json into
 * public/images/blog/ so the site serves them itself (no third-party request per page view).
 *
 * Every photo is from Unsplash under the Unsplash License (free for commercial use, no
 * attribution required); each entry keeps its source page. Unsplash's image CDN does the
 * crop and format conversion, so this needs no image tooling.
 *
 * Per photo it writes three files:
 *   <key>.webp      1200x675  header image on the post page
 *   <key>-480.webp   480x270  thumbnail on /blog and topic pages
 *   <key>-og.jpg    1200x630  social share image (og:image, twitter:image, JSON-LD)
 *
 * Files already present are kept, so only new photos download; files for photos no longer
 * in the manifest are deleted. Run by .github/workflows/blog-images.yml when photos.json changes
 * on a branch; it can also be run locally with `node scripts/fetch-blog-images.mjs`.
 */
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MANIFEST = path.join(ROOT, "src/content/blog-images/photos.json");
const OUT_DIR = path.join(ROOT, "public/images/blog");

// Busy photos (aerials, foliage) compress badly, so each variant steps down in quality until
// it fits its size budget; the header is the page's largest element, so it matters most.
const VARIANTS = [
  { suffix: ".webp", params: "w=1200&h=675&fit=crop&crop=entropy&fm=webp", qualities: [68, 58, 48, 40], maxBytes: 160_000 },
  { suffix: "-480.webp", params: "w=480&h=270&fit=crop&crop=entropy&fm=webp", qualities: [62, 50, 42], maxBytes: 40_000 },
  { suffix: "-og.jpg", params: "w=1200&h=630&fit=crop&crop=entropy&fm=jpg", qualities: [62, 52, 44, 38], maxBytes: 150_000 },
];

const photos = JSON.parse(await fs.readFile(MANIFEST, "utf8"));
await fs.mkdir(OUT_DIR, { recursive: true });

const wanted = new Set();
let fetched = 0;
const failures = [];

async function fetchImage(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) throw new Error(`HTTP ${res.status} ${type}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 3000) throw new Error(`only ${buf.length} bytes`);
      return buf;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

/** Downloads at the highest quality that fits the variant's budget (the lowest if none does). */
async function download(key, variant, file) {
  let buf;
  for (const q of variant.qualities) {
    buf = await fetchImage(`https://images.unsplash.com/${key}?${variant.params}&q=${q}`);
    if (buf.length <= variant.maxBytes) break;
  }
  await fs.writeFile(file, buf);
}

for (const key of Object.keys(photos)) {
  if (!/^photo-[0-9]+-[0-9a-f]+$/.test(key)) {
    failures.push(`${key}: not an Unsplash photo id`);
    continue;
  }
  for (const v of VARIANTS) {
    const name = `${key}${v.suffix}`;
    wanted.add(name);
    const file = path.join(OUT_DIR, name);
    try {
      await fs.access(file);
      continue;
    } catch {}
    try {
      await download(key, v, file);
      fetched++;
    } catch (err) {
      failures.push(`${name}: ${err.message}`);
    }
  }
}

let removed = 0;
for (const name of await fs.readdir(OUT_DIR)) {
  if (!wanted.has(name)) {
    await fs.rm(path.join(OUT_DIR, name));
    removed++;
  }
}

console.log(`blog images: ${Object.keys(photos).length} photos, ${fetched} files downloaded, ${removed} removed`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
