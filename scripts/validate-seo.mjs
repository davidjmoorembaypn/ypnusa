#!/usr/bin/env node
// Validates structured data and llms.txt against a running server.
//
//   BASE_URL=http://localhost:3000 node scripts/validate-seo.mjs
//
// Checks:
//   - /llms.txt exists, starts with an H1, and every link in it resolves
//   - every page listed in /sitemap.xml that returns 200 has JSON-LD that parses,
//     with a schema.org @context and an @type on every node
// Redirects and non-200 pages in the sitemap are skipped here (they are covered by the
// redirect tests); only the JSON-LD and llms.txt are judged.

const base = process.env.BASE_URL ?? "http://localhost:3000";
const concurrency = Number(process.env.CONCURRENCY ?? 8);
const canonicalOrigin = (process.env.CANONICAL_ORIGIN ?? "https://ypnus.com").replace(/\/$/, "");
const ALLOWED_PRICES = new Set([0, 99, 199, 299]);
const FORBIDDEN = [
  [/Young Professionals Network/i, '"Young Professionals Network"'],
  [/\$\s?29\.99/, "the retired $29.99 price"],
];
const errors = [];

async function get(path, { follow = false } = {}) {
  return fetch(new URL(path, base), {
    redirect: follow ? "follow" : "manual",
    signal: AbortSignal.timeout(30_000),
  });
}

// --- llms.txt ---------------------------------------------------------------------
async function checkLlms() {
  const res = await get("/llms.txt");
  if (res.status !== 200) {
    errors.push(`/llms.txt returned ${res.status}`);
    return;
  }
  const type = res.headers.get("content-type") ?? "";
  if (!/^text\/(plain|markdown)/i.test(type)) errors.push(`/llms.txt content-type is "${type}", expected text/plain or text/markdown`);
  const text = await res.text();
  if (!text.trimStart().startsWith("# ")) errors.push("llms.txt must start with an H1 ('# Name')");
  if (!/^>\s+\S/m.test(text)) errors.push("llms.txt should have a '> summary' blockquote under the H1");

  // Links may use the production origin; resolve them against the server under test.
  const links = new Set([...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]));
  for (const link of links) {
    let url;
    try {
      url = new URL(link, base);
    } catch {
      errors.push(`llms.txt has an unparseable link: ${link}`);
      continue;
    }
    const res2 = await get(url.pathname + url.search, { follow: true }).catch((e) => ({ status: `error: ${e.message}` }));
    if (res2.status !== 200) errors.push(`llms.txt link ${link} -> ${res2.status}`);
  }
  console.log(`llms.txt: checked ${links.size} links.`);
}

// --- JSON-LD ----------------------------------------------------------------------
function checkNode(path, node, where = "") {
  if (!node || typeof node !== "object") {
    errors.push(`${path}: JSON-LD${where} is not an object`);
    return;
  }
  if (Array.isArray(node["@graph"])) {
    if (!String(node["@context"] ?? "").includes("schema.org")) errors.push(`${path}: @graph without a schema.org @context`);
    for (const member of node["@graph"]) checkNode(path, { "@context": node["@context"], ...member }, " (in @graph)");
    return;
  }
  if (!String(node["@context"] ?? "").includes("schema.org")) errors.push(`${path}: JSON-LD${where} has no schema.org @context`);
  if (!node["@type"]) errors.push(`${path}: JSON-LD${where} has no @type`);
}

let pagesChecked = 0;
let blocksChecked = 0;
async function checkPage(path) {
  let res;
  try {
    res = await get(path);
  } catch (e) {
    errors.push(`${path}: fetch failed (${e.message})`);
    return;
  }
  if (res.status !== 200) return;
  const html = await res.text();
  pagesChecked++;

  // Canonical: exactly one, self-referencing, on the canonical origin (https, no www, no trailing slash).
  const canonicals = [...html.matchAll(/<link[^>]*rel="canonical"[^>]*>/g)].map((m) => /href="([^"]*)"/.exec(m[0])?.[1]);
  const expected = `${canonicalOrigin}${path === "/" ? "" : path.replace(/\/$/, "")}`;
  if (canonicals.length !== 1) errors.push(`${path}: expected 1 canonical link, found ${canonicals.length}`);
  else if (canonicals[0] !== expected) errors.push(`${path}: canonical is ${canonicals[0]}, expected ${expected}`);

  // Words that must never appear in what search engines read: title, description, JSON-LD.
  const head = [
    /<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? "",
    /<meta[^>]*name="description"[^>]*>/.exec(html)?.[0] ?? "",
  ];
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  for (const part of [...head, ...blocks]) {
    for (const [re, label] of FORBIDDEN) if (re.test(part)) errors.push(`${path}: metadata/JSON-LD mentions ${label}`);
  }

  for (const raw of blocks) {
    blocksChecked++;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      errors.push(`${path}: invalid JSON-LD (${e.message})`);
      continue;
    }
    for (const node of Array.isArray(data) ? data : [data]) {
      checkNode(path, node);
      checkOffers(path, node);
    }
  }
}

// Only the four public plans may be advertised: $0 Free, $99 Pro, $199 Growth, $299 Exclusive.
function checkOffers(path, node) {
  const members = Array.isArray(node?.["@graph"]) ? node["@graph"] : [node];
  for (const n of members) {
    const types = [].concat(n?.["@type"] ?? []);
    if (!types.includes("SoftwareApplication")) continue;
    for (const offer of [].concat(n.offers ?? [])) {
      const price = String(offer?.price ?? offer?.priceSpecification?.price ?? "");
      if (price && !ALLOWED_PRICES.has(Number(price))) errors.push(`${path}: SoftwareApplication offer price ${price} is not one of 0/99/199/299`);
    }
  }
}

async function checkJsonLd() {
  const res = await get("/sitemap.xml", { follow: true });
  if (res.status !== 200) {
    errors.push(`/sitemap.xml returned ${res.status}`);
    return;
  }
  const xml = await res.text();
  const paths = [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1].trim()).pathname))];
  if (paths.length === 0) errors.push("/sitemap.xml lists no URLs");
  const queue = [...paths];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length) await checkPage(queue.shift());
    }),
  );
  console.log(`JSON-LD: ${blocksChecked} blocks on ${pagesChecked} of ${paths.length} sitemap pages (the rest redirect or are not 200).`);
}

await checkLlms();
await checkJsonLd();

if (errors.length) {
  const shown = errors.slice(0, 100);
  console.error(`\n${errors.length} problem(s):\n- ${shown.join("\n- ")}`);
  if (errors.length > shown.length) console.error(`...and ${errors.length - shown.length} more`);
  process.exit(1);
}
console.log("SEO validation passed.");
