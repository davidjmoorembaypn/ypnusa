import { test } from "node:test";
import assert from "node:assert/strict";
import { verify, pathsFromSitemap } from "../scripts/verify-redirects.mjs";
import { server } from "./helpers.js";

test("verify: passes one-hop 301->200, flags chains, 404 targets, 302s and non-redirects", async () => {
  const srv = await server((req, res) => {
    const routes = {
      "/old-good/": [301, "/blog/good"], "/blog/good": [200],
      "/old-chain/": [301, "/hop"], "/hop": [301, "/blog/good"],
      "/old-404/": [301, "/blog/missing"], "/blog/missing": [404],
      "/old-302/": [302, "/blog/good"], "/gone": [410],
    };
    const [status, location] = routes[req.url] ?? [404];
    res.statusCode = status; if (location) res.setHeader("location", location); res.end();
  });
  try {
    const out = await verify({ base: srv.url, paths: ["/old-good/", "/old-chain/", "/old-404/", "/old-302/", "/gone", "/nope"] });
    assert.equal(out.ok, 2);
    const by = Object.fromEntries(out.failures.map((f) => [f.path, f.problem]));
    assert.match(by["/old-chain/"], /redirect chain/);
    assert.match(by["/old-404/"], /returned 404/);
    assert.match(by["/old-302/"], /got 302/);
    assert.match(by["/nope"], /got 404/);
  } finally { await srv.close(); }
});

test("sitemap parsing extracts paths", () => {
  assert.deepEqual(pathsFromSitemap("<urlset><url><loc>https://ypnus.com/a/</loc></url><url><loc> https://ypnus.com/b </loc></url></urlset>"), ["/a/", "/b"]);
});
