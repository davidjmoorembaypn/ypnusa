// Packages the ads Lambda: dist/ads.zip containing src/ and a package.json with "type":"module".
// The AWS SDK v3 is provided by the nodejs22.x runtime, so nothing needs to be installed.
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "dist"), { recursive: true });
const out = join(root, "dist/ads.zip");
rmSync(out, { force: true });

const zip = spawnSync("zip", ["-qr", out, "src", "package.json", "-x", "src/content/*"], { cwd: root });
if (zip.status !== 0) {
  // Fallback for machines without the zip CLI.
  const py = spawnSync("python3", ["-c", `
import zipfile, os
with zipfile.ZipFile("dist/ads.zip", "w", zipfile.ZIP_DEFLATED) as z:
    z.write("package.json")
    for d, _, files in os.walk("src"):
        if d.startswith("src/content"): continue
        for f in files: z.write(os.path.join(d, f))
`], { cwd: root });
  if (py.status !== 0) throw new Error("could not create dist/ads.zip");
}
console.log("dist/ads.zip written");
