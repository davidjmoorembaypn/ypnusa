import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { distanceMiles, nearestZips, zipDatasetSize, zipPlace, zipsWithinRadius } from "./zip-geo";

describe("zip geography", () => {
  it("loads tens of thousands of ZIP codes", () => {
    assert.ok(zipDatasetSize() > 40_000);
  });

  it("looks up a ZIP code and returns null for one that does not exist", () => {
    const dinuba = zipPlace("93618");
    assert.ok(dinuba);
    assert.equal(dinuba.city, "Dinuba");
    assert.equal(dinuba.state, "CA");
    assert.equal(zipPlace("00000"), null);
    assert.equal(zipPlace("abcde"), null);
  });

  it("measures distance sensibly", () => {
    const la = { lat: 34.0522, lon: -118.2437 };
    const sf = { lat: 37.7749, lon: -122.4194 };
    const miles = distanceMiles(la, sf);
    assert.ok(miles > 340 && miles < 360, `LA to SF was ${miles}`);
    assert.equal(distanceMiles(la, la), 0);
  });

  it("returns nearby ZIP codes nearest first, never the ZIP code itself", () => {
    const near = nearestZips("93618", 8);
    assert.equal(near.length, 8);
    assert.ok(!near.some((p) => p.zip === "93618"));
    for (let i = 1; i < near.length; i += 1) assert.ok(near[i].miles >= near[i - 1].miles);
    assert.ok(near[0].miles < 10);
  });

  it("radius search stays inside the radius and grows with it", () => {
    const five = zipsWithinRadius("93618", 5);
    const fifteen = zipsWithinRadius("93618", 15);
    assert.ok(five.every((p) => p.miles <= 5));
    assert.ok(fifteen.length >= five.length);
    assert.equal(zipsWithinRadius("93618", 15, 3).length, 3);
  });

  it("gives an empty result for unknown ZIP codes or a bad radius", () => {
    assert.deepEqual(zipsWithinRadius("00000", 10), []);
    assert.deepEqual(zipsWithinRadius("93618", 0), []);
    assert.deepEqual(nearestZips("00000", 5), []);
  });
});
