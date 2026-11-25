import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The old brand name must never come back through imported WordPress content, even as a
// generic phrase that reads like it (Nov 25 audit).
test("imported WordPress posts and pages never say Young Professional(s)", () => {
  for (const file of ["posts.json", "pages.json"]) {
    const text = readFileSync(join(process.cwd(), "src/content/wp-import", file), "utf8");
    assert.doesNotMatch(text, /young professional/i, file);
  }
});
