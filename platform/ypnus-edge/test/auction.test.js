import { test } from "node:test";
import assert from "node:assert/strict";
import { runAuction } from "../src/openrtb/client.js";
import { selectWinners, isAllowedNoticeUrl, substituteMacros } from "../src/openrtb/response.js";
import { buildBidRequest } from "../src/openrtb/builder.js";
import { evaluateConsent } from "../src/openrtb/consent.js";
import { baseConfig, server, bidResponse } from "./helpers.js";

const mkRequest = (config) => buildBidRequest({ slots: [{ id: "top", size: "300x250" }], config, page: "https://ypnus.com/", device: {}, consent: evaluateConsent({}) });
const fast = (price) => (req, res, body) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(bidResponse(JSON.parse(body), { price }))); };

test("a fast DSP returns a bid and the JSON body is the OpenRTB request", async () => {
  let seen;
  const dsp = await server((req, res, body) => { seen = { headers: req.headers, body: JSON.parse(body) }; fast(2)(req, res, body); });
  try {
    const config = baseConfig({ dsps: [{ id: "a", url: dsp.url }] });
    const out = await runAuction({ dsps: config.dsps, request: mkRequest(config) });
    assert.equal(out[0].status, "bid");
    assert.equal(seen.headers["x-openrtb-version"], "2.6");
    assert.match(seen.headers["content-type"], /application\/json/);
    assert.equal(seen.body.imp[0].id, "top");
  } finally { await dsp.close(); }
});

test("HARD CEILING: a slow DSP is cut off at ~150ms and the fast one still wins", async () => {
  const slow = await server((req, res, body) => setTimeout(() => fast(9)(req, res, body), 400));
  const quick = await server(fast(1.1));
  try {
    const config = baseConfig({ dsps: [{ id: "slow", url: slow.url }, { id: "quick", url: quick.url }] });
    const t0 = performance.now();
    const results = await runAuction({ dsps: config.dsps, request: mkRequest(config) });
    const elapsed = performance.now() - t0;
    assert.ok(elapsed < 185, `auction took ${elapsed}ms`);
    assert.equal(results.find((r) => r.dsp === "slow").status, "timeout");
    assert.equal(results.find((r) => r.dsp === "quick").status, "bid");
  } finally { await Promise.all([slow.close(), quick.close()]); }
});

test("windowMs above 150 is clamped to 150", async () => {
  const slow = await server((req, res) => setTimeout(() => res.end("{}"), 600));
  try {
    const t0 = performance.now();
    await runAuction({ dsps: [{ id: "s", url: slow.url }], request: {}, windowMs: 5000 });
    assert.ok(performance.now() - t0 < 200);
  } finally { await slow.close(); }
});

test("204, 500, redirects, bad JSON and refused connections never throw", async () => {
  const nobid = await server((q, r) => { r.statusCode = 204; r.end(); });
  const boom = await server((q, r) => { r.statusCode = 500; r.end("x"); });
  const redirect = await server((q, r) => { r.statusCode = 302; r.setHeader("location", "http://169.254.169.254/"); r.end(); });
  const junk = await server((q, r) => r.end("not json"));
  try {
    const dsps = [nobid, boom, redirect, junk].map((s, i) => ({ id: `d${i}`, url: s.url })).concat([{ id: "dead", url: "http://127.0.0.1:1" }]);
    const out = await runAuction({ dsps, request: {} });
    const by = Object.fromEntries(out.map((r) => [r.dsp, r.status]));
    assert.deepEqual(by, { d0: "nobid", d1: "error", d2: "error", d3: "error", dead: "error" });
  } finally { await Promise.all([nobid, boom, redirect, junk].map((s) => s.close())); }
});

test("oversized responses are rejected without buffering them all", async () => {
  const big = await server((q, r) => r.end("x".repeat(500_000)));
  try {
    const out = await runAuction({ dsps: [{ id: "big", url: big.url }], request: {}, maxBytes: 1000 });
    assert.equal(out[0].status, "error");
  } finally { await big.close(); }
});

// --- selection / validation -------------------------------------------------------------
const config = baseConfig({ dsps: [{ id: "a", url: "x", noticeDomains: ["dsp.example"] }, { id: "b", url: "y", noticeDomains: ["dsp.example"] }] });
const req = mkRequest(config);
const pick = (...bids) => selectWinners({ request: req, config, results: bids.map(([dsp, body]) => ({ dsp, status: "bid", body })) });

test("highest valid price wins and notice macros are substituted", () => {
  const { winners } = pick(["a", bidResponse(req, { price: 1 })], ["b", bidResponse(req, { price: 2.5 })]);
  const w = winners.get("top");
  assert.equal(w.dsp, "b");
  assert.equal(w.price, 2.5);
  assert.equal(w.nurl, "https://win.dsp.example/n?p=2.5");
});

test("rejects: wrong id, below floor, wrong size, no crid, non-USD, blocked advertiser, blocked category, bad adm", () => {
  const cases = {
    response_id_mismatch: { ...bidResponse(req), id: "other" },
    below_floor: bidResponse(req, { price: 0.01 }),
    size_mismatch: bidResponse(req, { w: 728, h: 90 }),
    no_crid: bidResponse(req, { crid: "" }),
    currency: { ...bidResponse(req), cur: "EUR" },
    blocked_advertiser: bidResponse(req, { extra: { adomain: ["badads.example"] } }),
    adm_invalid: bidResponse(req, { adm: "" }),
    not_banner: bidResponse(req, { extra: { mtype: 2 } }),
  };
  for (const [reason, body] of Object.entries(cases)) {
    const { winners, rejected } = pick(["a", body]);
    assert.equal(winners.size, 0, reason);
    assert.equal(rejected[0].reason, reason);
  }
  const { winners, rejected } = pick(["a", bidResponse(req, { extra: { cat: ["IAB25"] } })]);
  assert.equal(winners.size, 0);
  assert.equal(rejected[0].reason, "blocked_advertiser");
  const oversize = pick(["a", bidResponse(req, { adm: "x".repeat(200_000) })]);
  assert.equal(oversize.rejected[0].reason, "adm_invalid");
});

test("a bid for an unknown impression is skipped without dropping later valid bids", () => {
  const bad = bidResponse(req);
  bad.seatbid[0].bid.unshift({ ...bad.seatbid[0].bid[0], impid: "nope" });
  const { winners, rejected } = pick(["a", bad]);
  assert.ok(winners.has("top"));
  assert.equal(rejected[0].reason, "unknown_imp");
});

test("notice URLs: https only, no IPs/localhost/credentials, must be on the DSP's domains", () => {
  const ok = ["dsp.example"];
  assert.equal(isAllowedNoticeUrl("https://win.dsp.example/x", ok), true);
  assert.equal(isAllowedNoticeUrl("http://win.dsp.example/x", ok), false);
  assert.equal(isAllowedNoticeUrl("https://evil.example/x", ok), false);
  assert.equal(isAllowedNoticeUrl("https://dsp.example.evil.com/x", ok), false);
  assert.equal(isAllowedNoticeUrl("https://169.254.169.254/latest", ["169.254.169.254"]), false);
  assert.equal(isAllowedNoticeUrl("https://localhost/x", ["localhost"]), false);
  assert.equal(isAllowedNoticeUrl("https://u:p@win.dsp.example/x", ok), false);
  assert.equal(isAllowedNoticeUrl("not a url", ok), false);
});

test("macros strip newlines so they cannot inject headers", () => {
  assert.equal(substituteMacros("a=${AUCTION_ID}", { auctionId: "x\r\ny" }), "a=xy");
});
