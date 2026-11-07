import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectUploadPaths } from "../../scripts/copy-wordpress-media.mjs";

describe("collectUploadPaths", () => {
  it("finds absolute, relative and JSON-escaped upload paths once each", () => {
    const paths = collectUploadPaths([
      '<img src="https://ypnus.com/wp-content/uploads/2026/05/a-300x164.jpg">',
      '{"html":"<img src=\\"\\/wp-content\\/uploads\\/2026\\/05\\/a-300x164.jpg\\">"}',
      "poster /wp-content/uploads/2026/09/hero%20poster.webp and /wp-content/uploads/2026/10/v.mp4",
    ]);
    assert.deepEqual(paths, [
      "/wp-content/uploads/2026/05/a-300x164.jpg",
      "/wp-content/uploads/2026/09/hero poster.webp",
      "/wp-content/uploads/2026/10/v.mp4",
    ]);
  });

  it("ignores traversal and non-media paths", () => {
    assert.deepEqual(collectUploadPaths(["/wp-content/uploads/../wp-config.php /wp-content/uploads/x/../../a.jpg"]), []);
  });
});
