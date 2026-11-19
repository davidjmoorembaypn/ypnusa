import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import * as wpJson from "../app/wp-json/[[...path]]/route";
import * as wpAdmin from "../app/wp-admin/[[...path]]/route";

describe("retired WordPress paths", () => {
  it("answer 410 Gone to every method, with noindex", async () => {
    for (const route of [wpJson, wpAdmin]) {
      for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const) {
        const response = route[method]();
        assert.equal(response.status, 410, method);
        assert.equal(response.headers.get("x-robots-tag"), "noindex");
      }
      assert.match(await route.GET().text(), /permanently removed/);
    }
  });

  it("the WordPress SSO callback, its health check and its helper are gone", () => {
    for (const gone of ["src/app/api/auth/callback/route.ts", "src/app/api/health/sso/route.ts", "src/lib/sso.ts"]) {
      assert.equal(fs.existsSync(gone), false, gone);
    }
  });
});
