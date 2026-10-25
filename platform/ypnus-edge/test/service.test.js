import { test } from "node:test";
import assert from "node:assert/strict";
import { SegmentStore, memoryKv, hashUserId } from "../src/segments/store.js";
import { decideAds, adsEnabledForPath, parseAdRequest } from "../src/ads/service.js";
import { createHandler } from "../src/lambda/ads.js";
import { signToken, verifyToken } from "../src/lambda/sign.js";
import { baseConfig, server, bidResponse } from "./helpers.js";

const UID = "0b9e5f7a-1111-4222-8333-444455556666";
const page = "https://ypnus.com/blog/x";
const input = (over = {}) => ({ page, slots: [{ id: "top", size: "300x250" }], consent: { personalize: true }, ...over });
const bidder = (price = 2, onBody) => server((q, r, body) => { const req = JSON.parse(body); onBody?.(req); r.setHeader("content-type", "application/json"); r.end(JSON.stringify(bidResponse(req, { price }))); });
const store = (data) => new SegmentStore({ kv: memoryKv(data) });

test("segments: allow-list, id format, cap and cache", async () => {
  const uid = hashUserId("s", UID);
  let calls = 0;
  const kv = { get: async () => { calls++; return { segments: ["reader_mlo", "Bad Id!", { id: "viewed_pricing", name: "Viewed pricing" }, "not_allowed"] }; } };
  const s = new SegmentStore({ kv, allowed: ["reader_mlo", "viewed_pricing"] });
  const a = await s.lookup(uid, 25);
  assert.deepEqual(a.segments.map((x) => x.id), ["reader_mlo", "viewed_pricing"]);
  const b = await s.lookup(uid, 25);
  assert.equal(b.source, "cache");
  assert.equal(calls, 1);
});

test("segments: a slow or failing store fails open within the timeout", async () => {
  const slow = new SegmentStore({ kv: { get: () => new Promise((r) => setTimeout(() => r({ segments: ["x1"] }), 200)) } });
  const t0 = performance.now();
  const r = await slow.lookup("u", 25);
  assert.equal(r.source, "timeout");
  assert.deepEqual(r.segments, []);
  assert.ok(performance.now() - t0 < 80);
  const broken = new SegmentStore({ kv: { get: async () => { throw new Error("redis down"); } } });
  assert.equal((await broken.lookup("u", 25)).source, "error");
});

test("end to end: opted-in visitor's segments reach the DSP in user.data and user.ext", async () => {
  const dsp = await bidder(2, (r) => (seen = r));
  let seen;
  try {
    const config = baseConfig({ dsps: [{ id: "a", url: dsp.url, noticeDomains: ["dsp.example"] }] });
    const segments = store({ [`SEG#${hashUserId(config.hmacSecret, UID)}`]: { segments: ["reader_mlo"] } });
    const out = await decideAds({ input: input(), headers: {}, ip: "203.0.113.9", cookies: { ypn_uid: UID }, deps: { config, segments } });
    assert.equal(out.status, 200);
    assert.equal(out.body.slots.top.type, "bid");
    assert.equal(out.body.slots.top.html, "<div>ad</div>");
    assert.ok(out.body.slots.top.token);
    assert.equal(seen.user.data[0].segment[0].id, "reader_mlo");
    assert.deepEqual(seen.user.ext.ypn.segs, ["reader_mlo"]);
    assert.equal(seen.device.ip, "203.0.113.0");
    assert.equal(out.setCookie, null);
  } finally { await dsp.close(); }
});

test("privacy: GPC or no opt-in sends NO user object and sets no cookie", async () => {
  let seen;
  const dsp = await bidder(2, (r) => (seen = r));
  try {
    const config = baseConfig({ dsps: [{ id: "a", url: dsp.url, noticeDomains: ["dsp.example"] }] });
    const segments = store({});
    for (const [headers, consent] of [[{ "sec-gpc": "1" }, { personalize: true }], [{}, {}]]) {
      seen = null;
      const out = await decideAds({ input: input({ consent }), headers, ip: "1.2.3.4", cookies: {}, deps: { config, segments } });
      assert.equal(seen.user, undefined);
      assert.equal(out.setCookie, null);
    }
  } finally { await dsp.close(); }
});

test("a new opted-in visitor gets a Secure HttpOnly first-party cookie", async () => {
  const dsp = await bidder();
  try {
    const config = baseConfig({ dsps: [{ id: "a", url: dsp.url, noticeDomains: ["dsp.example"] }] });
    const out = await decideAds({ input: input(), headers: {}, ip: "1.2.3.4", cookies: {}, deps: { config, segments: store({}) } });
    assert.match(out.setCookie, /^ypn_uid=[0-9a-f-]{36}; .*Secure; HttpOnly; SameSite=Lax/);
  } finally { await dsp.close(); }
});

test("FALLBACK: slow DSP -> house ad for every slot, within the window", async () => {
  const slow = await server((q, r, b) => setTimeout(() => r.end(JSON.stringify(bidResponse(JSON.parse(b)))), 500));
  try {
    const config = baseConfig({ dsps: [{ id: "slow", url: slow.url, noticeDomains: ["dsp.example"] }] });
    const t0 = performance.now();
    const out = await decideAds({ input: input({ slots: [{ id: "top", size: "300x250" }, { id: "leader", size: "728x90" }] }), headers: {}, ip: "1.2.3.4", cookies: {}, deps: { config, segments: store({}) } });
    assert.ok(performance.now() - t0 < 200);
    assert.equal(out.status, 200);
    assert.equal(out.body.slots.top.type, "house");
    assert.equal(out.body.slots.top.href, "/check-zip");
    assert.equal(out.body.slots.leader.type, "house");
    assert.equal(out.metrics.dsp[0].status, "timeout");
  } finally { await slow.close(); }
});

test("no DSP configured, or no valid bid -> house ad; blocked pages -> none", async () => {
  const none = await decideAds({ input: input(), headers: {}, ip: "1.1.1.1", cookies: {}, deps: { config: baseConfig(), segments: store({}) } });
  assert.equal(none.body.slots.top.type, "house");
  const blocked = await decideAds({ input: input({ page: "https://ypnus.com/pricing" }), headers: {}, ip: "1.1.1.1", cookies: {}, deps: { config: baseConfig({ dsps: [{ id: "a", url: "http://127.0.0.1:1" }] }), segments: store({}) } });
  assert.equal(blocked.body.slots.top.type, "none");
  assert.equal(adsEnabledForPath("/pricing/x", baseConfig()), true === false);
  assert.equal(adsEnabledForPath("/pricingfoo", baseConfig()), true);
});

test("input validation rejects hostile requests", () => {
  const cfg = baseConfig();
  for (const bad of [null, {}, input({ page: "https://evil.example/" }), input({ page: "javascript:alert(1)" }), input({ slots: [] }), input({ slots: [{ id: "a b", size: "300x250" }] }), input({ slots: [{ id: "x", size: "999x999" }] }), input({ slots: [{ id: "x", size: "300x250" }, { id: "x", size: "300x250" }] }), input({ slots: Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, size: "300x250" })) })]) {
    assert.equal(parseAdRequest(bad, cfg).ok, false);
  }
  assert.equal(parseAdRequest(input(), cfg).ok, true);
});

test("tokens: signed, expiring, tamper-proof", () => {
  const t = signToken("k", { j: "1" }, 1_000_000, 60);
  assert.equal(verifyToken("k", t, 1_000_000 + 30_000).j, "1");
  assert.equal(verifyToken("k", t, 1_000_000 + 61_000), null);
  assert.equal(verifyToken("other", t, 1_000_000), null);
  assert.equal(verifyToken("k", t.replace(/^./, "X"), 1_000_000), null);
  assert.equal(verifyToken("k", "a.b.c"), null);
  assert.equal(verifyToken("", t), null);
});

// --- Lambda handler -----------------------------------------------------------------------
const ev = (path, body, over = {}) => ({ rawPath: path, requestContext: { http: { method: "POST", path, sourceIp: "1.2.3.4" } }, headers: { "user-agent": "UA", ...(over.headers ?? {}) }, body: typeof body === "string" ? body : JSON.stringify(body), ...over.rest });

test("lambda: /api/ads returns JSON no-store; errors never leak internals", async () => {
  const handler = createHandler({ config: baseConfig(), segments: store({}), dedupe: { claim: async () => true }, log: () => {} });
  const ok = await handler(ev("/api/ads", input()));
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.headers["cache-control"], "no-store");
  assert.equal((await handler(ev("/api/ads", "{bad"))).statusCode, 400);
  assert.equal((await handler({ ...ev("/api/ads", input()), requestContext: { http: { method: "GET" } } })).statusCode, 405);
  assert.equal((await handler(ev("/api/ads", "x".repeat(20_000)))).statusCode, 413);
  assert.equal((await handler(ev("/nope", {}))).statusCode, 404);
  const crash = createHandler({ config: baseConfig({ dsps: [{ id: "a", url: "http://127.0.0.1:1", noticeDomains: [] }] }), segments: null, dedupe: null, log: () => {} });
  const r = await crash(ev("/api/ads", input({ consent: { personalize: true } })));
  assert.equal(r.statusCode, 200, "internal failures must not produce a 5xx the browser would log");
  assert.deepEqual(JSON.parse(r.body), { v: 1, reason: "error", slots: {} });
});

test("lambda: origin-verify header is enforced when configured", async () => {
  const handler = createHandler({ config: baseConfig({ originVerify: "s3cret" }), segments: store({}), dedupe: { claim: async () => true }, log: () => {} });
  assert.equal((await handler(ev("/api/ads", input()))).statusCode, 403);
  assert.equal((await handler(ev("/api/ads", input(), { headers: { "X-Origin-Verify": "wrong" } }))).statusCode, 403);
  assert.equal((await handler(ev("/api/ads", input(), { headers: { "X-Origin-Verify": "s3cret" } }))).statusCode, 200);
});

test("lambda: impression beacon fires each signed notice exactly once", async () => {
  const fired = [];
  const seen = new Set();
  const config = baseConfig();
  const handler = createHandler({ config, segments: store({}), dedupe: { claim: async (k) => !seen.has(k) && !!seen.add(k) }, fetchImpl: async (u) => { fired.push(u); return { ok: true }; }, log: () => {} });
  const token = signToken(config.hmacSecret, { j: "evt-1", n: "https://win.dsp.example/n", b: "https://bill.dsp.example/b", p: 2, d: "a" });
  assert.equal((await handler(ev("/api/ads/event", token))).statusCode, 204);
  assert.deepEqual(fired, ["https://win.dsp.example/n", "https://bill.dsp.example/b"]);
  assert.equal((await handler(ev("/api/ads/event", token))).statusCode, 204);
  assert.equal(fired.length, 2, "replay must not fire again");
  assert.equal((await handler(ev("/api/ads/event", "forged.token"))).statusCode, 400);
});
