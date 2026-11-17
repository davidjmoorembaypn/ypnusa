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
 * Existing files are kept, so only new photos download. Files for photos no longer in the
 * manifest are deleted. Run by .github/workflows/blog-images.yml when photos.json changes
 * on a branch; it can also be run locally with `node scripts/fetch-blog-images.mjs`.
 */
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MANIFEST = path.join(ROOT, "src/content/blog-images/photos.json");
const OUT_DIR = path.join(ROOT, "public/images/blog");

const VARIANTS = [
  { suffix: ".webp", params: "w=1200&h=675&fit=crop&crop=entropy&fm=webp&q=68" },
  { suffix: "-480.webp", params: "w=480&h=270&fit=crop&crop=entropy&fm=webp&q=62" },
  { suffix: "-og.jpg", params: "w=1200&h=630&fit=crop&crop=entropy&fm=jpg&q=62" },
];

const photos = JSON.parse(await fs.readFile(MANIFEST, "utf8"));
await fs.mkdir(OUT_DIR, { recursive: true });

const wanted = new Set();
let fetched = 0;
const failures = [];

async function download(url, file) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) throw new Error(`HTTP ${res.status} ${type}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 3000) throw new Error(`only ${buf.length} bytes`);
      await fs.writeFile(file, buf);
      return;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
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
      await download(`https://images.unsplash.com/${key}?${v.params}`, file);
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
