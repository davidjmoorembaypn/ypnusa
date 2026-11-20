import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import * as wpJson from "../app/wp-json/[[...path]]/route";
import * as wpAdmin from "../app/wp-admin/[[...path]]/route";
import * as wpLogin from "../app/wp-login.php/route";

describe("retired WordPress paths", () => {
  it("answer 410 Gone to every method, with noindex", async () => {
    for (const route of [wpJson, wpAdmin, wpLogin]) {
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

  it("Apache no longer proxies /wp-login.php, but still proxies the retained WordPress paths", () => {
    const conf = fs.readFileSync("aws/apache/zz-ypnus-com.conf.tmpl", "utf8");
    const directives = conf
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^ProxyPass(Reverse|Match)?\s/.test(line));
    // Nothing proxies the login form to WordPress, so it falls through to the Next.js 410 route.
    assert.equal(directives.some((line) => line.includes("wp-login")), false, "wp-login.php is still proxied");
    // Retained: images, includes and the legacy .html pages keep working.
    for (const kept of ["/wp-content/", "/wp-includes/"]) {
      assert.ok(directives.some((line) => /^ProxyPass\s/.test(line) && line.includes(` ${kept} `)), `${kept} lost its ProxyPass`);
      assert.ok(directives.some((line) => /^ProxyPassReverse\s/.test(line) && line.includes(` ${kept} `)), `${kept} lost its ProxyPassReverse`);
    }
    assert.ok(directives.some((line) => /^ProxyPassMatch\s/.test(line) && line.includes("check-zip") && line.includes("pricing")), "legacy .html ProxyPassMatch is gone");
    // The Next.js app is still the catch-all.
    assert.ok(directives.some((line) => /^ProxyPass\s+\/\s+http:\/\/127\.0\.0\.1:3000\/$/.test(line)), "catch-all to Next.js is gone");
  });
});
