import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBidRequest, truncateIp } from "../src/openrtb/builder.js";
import { evaluateConsent } from "../src/openrtb/consent.js";
import { baseConfig } from "./helpers.js";

const slots = [{ id: "top", size: "300x250", pos: 1 }];
const optIn = evaluateConsent({ consent: { personalize: true }, country: "US" });
const optOut = evaluateConsent({ consent: {}, country: "US" });
const args = (over = {}) => ({ slots, config: baseConfig(), page: "https://ypnus.com/blog/x", device: { ua: "UA", ip: "203.0.113.77", language: "en-US", country: "US" }, consent: optOut, userId: "h".repeat(32), segments: [{ id: "reader_mlo", name: "MLO reader" }], ...over });

test("builds an OpenRTB 2.6 request with required fields", () => {
  const r = buildBidRequest(args());
  assert.equal(r.at, 1);
  assert.deepEqual(r.cur, ["USD"]);
  assert.equal(r.imp[0].banner.w, 300);
  assert.equal(r.imp[0].secure, 1);
  assert.equal(r.imp[0].bidfloor, 0.25);
  assert.equal(r.site.domain, "ypnus.com");
  assert.equal(r.device.geo.country, "USA");
  assert.equal(r.regs.coppa, 0);
  assert.ok(r.id && r.source.tid);
});

test("tmax never exceeds the 150ms ceiling", () => {
  assert.equal(buildBidRequest(args({ config: baseConfig({ tmaxMs: 900 }) })).tmax, 150);
  assert.equal(buildBidRequest(args()).tmax, 130);
});

test("IPs are truncated before leaving the network", () => {
  assert.deepEqual(truncateIp("203.0.113.77"), { ip: "203.0.113.0" });
  assert.deepEqual(truncateIp("2001:db8:abcd:1234::1"), { ipv6: "2001:db8:abcd::" });
  assert.deepEqual(truncateIp(undefined), {});
});

test("no user object or segments without opt-in", () => {
  const r = buildBidRequest(args());
  assert.equal(r.user, undefined);
});

test("segments land in user.data[].segment and user.ext.ypn on opt-in", () => {
  const r = buildBidRequest(args({ consent: optIn }));
  assert.equal(r.user.id, "h".repeat(32));
  assert.deepEqual(r.user.data[0].segment, [{ id: "reader_mlo", name: "MLO reader" }]);
  assert.deepEqual(r.user.ext.ypn.segs, ["reader_mlo"]);
});

test("blocked categories and advertisers are sent to DSPs", () => {
  const r = buildBidRequest(args());
  assert.deepEqual(r.bcat, ["IAB25"]);
  assert.deepEqual(r.badv, ["badads.example"]);
});

test("requires at least one slot", () => assert.throws(() => buildBidRequest(args({ slots: [] }))));

test("consent: GPC, US opt-out and GDPR without TCF all disable personalization", () => {
  assert.equal(evaluateConsent({ headers: { "sec-gpc": "1" }, consent: { personalize: true } }).reason, "gpc");
  assert.equal(evaluateConsent({ consent: { personalize: true, usp: "1YYN" } }).personalize, false);
  assert.equal(evaluateConsent({ consent: { personalize: true }, country: "DE" }).reason, "gdpr_no_consent");
  assert.equal(evaluateConsent({ consent: { personalize: true, usp: "1YNN" } }).personalize, true);
  assert.equal(evaluateConsent({ consent: {} }).personalize, false);
});

test("consent: malformed strings are ignored", () => {
  const c = evaluateConsent({ consent: { usp: "bogus", gpp: "<script>", tcf: "x" } });
  assert.equal(c.usPrivacy, null);
  assert.equal(c.gpp, null);
  assert.equal(c.tcf, null);
});

test("opt-out request is flagged in regs and sets dnt/lmt for GPC", () => {
  const r = buildBidRequest(args({ consent: evaluateConsent({ headers: { "sec-gpc": "1" }, consent: { usp: "1YNN" } }) }));
  assert.equal(r.device.dnt, 1);
  assert.equal(r.regs.us_privacy, "1YNN");
  assert.equal(r.regs.ext.gpc, 1);
});
