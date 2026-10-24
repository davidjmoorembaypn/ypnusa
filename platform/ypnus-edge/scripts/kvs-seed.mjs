// Builds CloudFront KeyValueStore batches from the existing 330-entry WordPress redirect map
// plus extra rules. Output: infra/dist/kvs/puts-NNN.json (<=50 keys each, the API limit).
//   aws cloudfront-keyvaluestore update-keys --kvs-arn $ARN --if-match $ETAG --puts file://puts-001.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const legacy = JSON.parse(readFileSync(join(root, "../../src/content/wp-import/redirects.json"), "utf8"));
const extra = JSON.parse(readFileSync(join(root, "edge/extra-redirects.json"), "utf8")).redirects;

export function buildEntries(...maps) {
  const merged = new Map();
  for (const map of maps) {
    for (const [from, to] of Object.entries(map)) {
      const key = from.toLowerCase().replace(/\/+$/, "") || "/";
      if (merged.has(key) && merged.get(key) !== to) throw new Error(`conflicting redirect for ${key}`);
      if (!to.startsWith("/")) throw new Error(`target must be a path: ${key} -> ${to}`);
      if (Buffer.byteLength(key) > 512 || Buffer.byteLength(to) > 1024) throw new Error(`key/value too large: ${key}`);
      merged.set(key, to);
    }
  }
  return [...merged].map(([Key, Value]) => ({ Key, Value }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const entries = buildEntries(legacy, extra);
  mkdirSync(join(root, "infra/dist/kvs"), { recursive: true });
  for (let i = 0; i < entries.length; i += 50) {
    const name = `puts-${String(i / 50 + 1).padStart(3, "0")}.json`;
    writeFileSync(join(root, "infra/dist/kvs", name), JSON.stringify({ Puts: entries.slice(i, i + 50) }, null, 2));
  }
  console.log(`${entries.length} redirect keys in ${Math.ceil(entries.length / 50)} batch file(s)`);
}
