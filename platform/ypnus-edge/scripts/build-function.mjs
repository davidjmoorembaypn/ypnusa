// Assembles the CloudFront Function source from the tested core + the CloudFront entrypoint.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const strip = (src) =>
  src
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("//") && !/^\/\*.*\*\/$/.test(line.trim()))
    .join("\n");

/** @param {{stubKvs?: Record<string,string>}} [opts] stubKvs replaces the CloudFront import for tests */
export function buildFunctionCode(opts = {}) {
  const core = strip(readFileSync(join(root, "edge/redirect-core.js"), "utf8"));
  let entry = strip(readFileSync(join(root, "edge/redirect-entry.js"), "utf8"));
  if (opts.stubKvs) {
    entry = entry.replace(
      "import cf from 'cloudfront';",
      "var cf = { kvs: function () { return { get: async function (k) { if (!(k in __KV)) throw new Error('KeyNotFound'); return __KV[k]; } }; } };",
    );
  }
  return `${core}\n${entry}\n`;
}
