import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { zipCodeCopy, zipCodeCopyHtml } from "./zip-copy";

describe("zipCodeCopy", () => {
  it("turns a bare ZIP into ZIP code", () => {
    assert.equal(zipCodeCopy("inside a protected ZIP you own"), "inside a protected ZIP code you own");
    assert.equal(zipCodeCopy("One licensed MLO per ZIP."), "One licensed MLO per ZIP code.");
    assert.equal(zipCodeCopy("ZIPs loan officers claim"), "ZIP codes loan officers claim");
    assert.equal(zipCodeCopy("ZIP 93720 covers"), "ZIP code 93720 covers");
  });

  it("keeps Title Case headings in Title Case", () => {
    assert.equal(zipCodeCopy("Exclusive ZIP Leads"), "Exclusive ZIP Code Leads");
    assert.equal(zipCodeCopy("Own Exclusive ZIP Territories"), "Own Exclusive ZIP Code Territories");
    assert.equal(zipCodeCopy("exclusive ZIP territories"), "exclusive ZIP code territories");
  });

  it("leaves ZIP code, ZIP+4 and identifiers alone", () => {
    for (const text of ["your ZIP code", "Enter ZIP Code", "ZIP codes", "ZIP+4", "ZIP_RE", "zipCode", "ZIPPED"]) {
      assert.equal(zipCodeCopy(text), text);
    }
  });

  it("writes hyphenated compounds as ZIP-code-…", () => {
    assert.equal(zipCodeCopy("ZIP-level estimates"), "ZIP-code-level estimates");
  });
});

describe("zipCodeCopyHtml", () => {
  it("rewrites visible text but not attributes, scripts or styles", () => {
    const html =
      '<p title="ZIP">Claim your ZIP</p><input placeholder="ZIP"><script>var label="ZIP";</script><style>.ZIP{}</style><a href="/zip/ZIP">ZIPs</a>';
    assert.equal(
      zipCodeCopyHtml(html),
      '<p title="ZIP">Claim your ZIP code</p><input placeholder="ZIP"><script>var label="ZIP";</script><style>.ZIP{}</style><a href="/zip/ZIP">ZIP codes</a>',
    );
  });
});
