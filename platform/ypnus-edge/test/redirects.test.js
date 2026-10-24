import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { buildFunctionCode } from "../scripts/build-function.mjs";
import { buildEntries } from "../scripts/kvs-seed.mjs";

const legacy = JSON.parse(readFileSync(new URL("../../../src/content/wp-import/redirects.json", import.meta.url), "utf8"));
const extra = JSON.parse(readFileSync(new URL("../edge/extra-redirects.json", import.meta.url), "utf8")).redirects;
const kv = Object.fromEntries(buildEntries(legacy, extra).map((e) => [e.Key, e.Value]));
kv["p:42"] = "/blog/hello-world";
kv["slug:moved-post"] = "/blog/new-name";

const load = (store = kv) => {
  const ctx = { __KV: store };
  vm.createContext(ctx);
  vm.runInContext(buildFunctionCode({ stubKvs: true }), ctx);
  return ctx;
};
const ctx = load();
const call = async (uri, { host = "ypnus.com", qs = {} } = {}) => {
  const res = await ctx.handler({ request: { uri, method: "GET", headers: { host: { value: host } }, querystring: qs } });
  return res.statusCode ? { status: res.statusCode, location: res.headers.location?.value, cache: res.headers["cache-control"]?.value } : { pass: true };
};
const to = (path) => `https://ypnus.com${path}`;

test("function fits CloudFront's 10KB limit with room to spare", () => {
  assert.ok(Buffer.byteLength(buildFunctionCode()) < 8000);
});

test("EVERY legacy URL in the existing 330-entry map redirects 301 to its target", async () => {
  let n = 0;
  for (const [from, target] of Object.entries(legacy)) {
    const r = await call(from);
    assert.equal(r.status, 301, from);
    assert.equal(r.location, to(target), from);
    n++;
  }
  assert.equal(n, 330);
});

test("date permalinks /YYYY/MM/DD/slug/ and /YYYY/MM/slug/ -> /blog/slug", async () => {
  assert.equal((await call("/2024/05/17/my-post/")).location, to("/blog/my-post"));
  assert.equal((await call("/2024/05/my-post")).location, to("/blog/my-post"));
  assert.equal((await call("/2024/05/17/my-post/amp/")).location, to("/blog/my-post"));
  assert.equal((await call("/2024/05/17/my-post/comment-page-2/")).location, to("/blog/my-post"));
  assert.equal((await call("/2024/05/17/my-post/feed/")).location, to("/blog/my-post"));
});

test("per-slug overrides in the KeyValueStore beat the automatic rule", async () => {
  assert.equal((await call("/2023/01/02/moved-post/")).location, to("/blog/new-name"));
});

test("archives, categories, tags, authors, pagination -> /blog", async () => {
  for (const u of ["/2024/", "/2024/05/", "/2024/05/17/", "/category/mortgage-tips/", "/category/a/b/page/2/", "/tag/fha/", "/author/admin/", "/page/3/", "/blog/page/2", "/feed/", "/comments/feed/"]) {
    const r = await call(u);
    assert.equal(r.status, 301, u);
    assert.equal(r.location, to("/blog"), u);
  }
});

test("/?p=ID and /?page_id=ID use the store, with safe fallbacks", async () => {
  assert.equal((await call("/", { qs: { p: { value: "42" } } })).location, to("/blog/hello-world"));
  assert.equal((await call("/", { qs: { p: { value: "999" } } })).location, to("/blog"));
  assert.equal((await call("/", { qs: { page_id: { value: "7" } } })).location, to("/"));
});

test("uploads move to /media, other wp-content/admin/login/xmlrpc are 410 Gone", async () => {
  assert.equal((await call("/wp-content/uploads/2024/05/Hero-Image.PNG")).location, to("/media/2024/05/Hero-Image.PNG"));
  for (const u of ["/xmlrpc.php", "/wp-login.php", "/wp-admin/", "/wp-admin/admin-ajax.php", "/wp-includes/js/x.js", "/wp-content/plugins/a/b.js", "/wp-content/themes/t/s.css"]) {
    assert.equal((await call(u)).status, 410, u);
  }
});

test("marketing params survive; WordPress params are dropped", async () => {
  const r = await call("/2024/05/my-post/", { qs: { utm_source: { value: "li" }, utm_campaign: { value: "a b" }, replytocom: { value: "9" }, gclid: { value: "" } } });
  assert.equal(r.location, to("/blog/my-post?utm_source=li&utm_campaign=a%20b&gclid"));
});

test("legacy .html pages and trailing slashes are normalised; www goes to apex", async () => {
  assert.equal((await call("/lo-signup.html")).location, to("/pricing"));
  assert.equal((await call("/check-zip.html")).location, to("/check-zip"));
  assert.equal((await call("/about-us.html")).location, to("/about-us"));
  assert.equal((await call("/mortgage-loans/fha/")).location, to("/mortgage-loans/fha"));
  assert.equal((await call("/pricing", { host: "www.ypnus.com" })).location, to("/pricing"));
  assert.equal((await call("/", { host: "www.ypnus.com" })).location, to("/"));
});

test("normal URLs pass straight through; wp-json is left alone for the legacy origin", async () => {
  for (const u of ["/", "/pricing", "/blog/some-post", "/mortgage-loans/fha", "/assets/ypn-ads.js", "/api/ads", "/robots.txt", "/wp-json/ypnus/v1/zip-check/90210"]) {
    assert.deepEqual(await call(u), { pass: true }, u);
  }
});

test("redirects are cacheable for an hour so a mistake is fixable; 410 for a day", async () => {
  assert.equal((await call("/2024/05/my-post/")).cache, "public, max-age=3600");
  assert.equal((await call("/xmlrpc.php")).status, 410);
});

test("a missing KeyValueStore key never breaks the request", async () => {
  const empty = load({});
  const res = await empty.handler({ request: { uri: "/blog/x", headers: { host: { value: "ypnus.com" } }, querystring: {} } });
  assert.equal(res.uri, "/blog/x");
});
