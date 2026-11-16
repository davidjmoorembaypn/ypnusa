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

  it("capitalizes a lowercase zip and adds code when it is missing", () => {
    assert.equal(zipCodeCopy("secure a zip code"), "secure a ZIP code");
    assert.equal(zipCodeCopy("Exclusive Zip Codes"), "Exclusive ZIP Codes");
    assert.equal(zipCodeCopy("one officer per zip."), "one officer per ZIP code.");
    assert.equal(zipCodeCopy("zips nearby"), "ZIP codes nearby");
  });

  it("leaves zip in URLs, parameters and identifiers alone", () => {
    for (const text of ["ypnus.com/zip/93720", "/claim-territory?zip=93720", "zipCode", "unzip", "zip_code", "a.zip file"]) {
      assert.equal(zipCodeCopy(text), text);
    }
  });

  it("writes hyphenated compounds as ZIP-code-…", () => {
    assert.equal(zipCodeCopy("ZIP-level estimates"), "ZIP-code-level estimates");
  });
});

describe("zipCodeCopyHtml", () => {
  it("rewrites visible text and visible attributes, not scripts, styles or URLs", () => {
    const html =
      '<p title="ZIP">Claim your ZIP</p><input placeholder="ZIP"><script>var label="ZIP";</script><style>.ZIP{}</style><a href="/zip/ZIP">ZIPs</a>';
    assert.equal(
      zipCodeCopyHtml(html),
      '<p title="ZIP code">Claim your ZIP code</p><input placeholder="ZIP code"><script>var label="ZIP";</script><style>.ZIP{}</style><a href="/zip/ZIP">ZIP codes</a>',
    );
  });

  it("rewrites lowercase hyphenated prose but not identifiers", () => {
    assert.equal(zipCodeCopy("from zip-level demand intelligence"), "from ZIP-code-level demand intelligence");
    assert.equal(zipCodeCopy("your zip-code lookup"), "your ZIP-code lookup");
    assert.equal(zipCodeCopy("the zip-check endpoint"), "the ZIP-code-check endpoint");
    assert.equal(zipCodeCopy("see /zip-check/93720"), "see /zip-check/93720");
    assert.equal(zipCodeCopy("open check-zip.html"), "open check-zip.html");
  });

  it("rewrites visible attributes in HTML but leaves technical ones alone", () => {
    const html = '<input name="zip" id="zip-guide" pattern="[0-9]{5}" placeholder="Enter your ZIP" aria-label="Your ZIP"><img alt="ZIP map" src="/img/zip.png">';
    assert.equal(
      zipCodeCopyHtml(html),
      '<input name="zip" id="zip-guide" pattern="[0-9]{5}" placeholder="Enter your ZIP code" aria-label="Your ZIP code"><img alt="ZIP code map" src="/img/zip.png">',
    );
  });
});
