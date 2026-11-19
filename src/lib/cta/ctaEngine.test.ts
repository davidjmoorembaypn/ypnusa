import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCtaSet, ctaForZip, nudgesWithoutDemand } from "./ctaEngine";

describe("CTA sets are scoped to one ZIP code", () => {
  const dinuba = buildCtaSet({ zip: "93618", available: true, demandTotal: 117 });
  const fresno = buildCtaSet({ zip: "93720", available: true, demandTotal: 587 });

  it("records the ZIP code a set was built for", () => {
    assert.equal(dinuba.zip, "93618");
    assert.equal(fresno.zip, "93720");
    assert.equal(buildCtaSet({}).zip, null);
    assert.equal(buildCtaSet({ zip: "abc" }).zip, null);
  });

  it("is shown only for the ZIP code on screen, never a previous lookup's", () => {
    assert.equal(ctaForZip(dinuba, "93618"), dinuba);
    // The visitor looked up 93618, then 93720: the old set must not carry over.
    assert.equal(ctaForZip(dinuba, "93720"), null);
    assert.equal(ctaForZip(dinuba, null), null);
    assert.equal(ctaForZip(null, "93618"), null);
    assert.equal(ctaForZip(buildCtaSet({}), "93618"), null);
  });

  it("never shows one ZIP code's demand figure next to another ZIP code", () => {
    assert.match(dinuba.demandNudge ?? "", /117/);
    const shown = ctaForZip(dinuba, "93720");
    assert.equal(shown, null);
    assert.ok(!(ctaForZip(fresno, "93720")?.microNudges ?? []).some((n) => n.includes("117")));
  });

  it("can drop the demand line where the screen already shows the figure", () => {
    assert.ok(dinuba.microNudges.includes(dinuba.demandNudge!));
    const rest = nudgesWithoutDemand(dinuba);
    assert.ok(!rest.some((n) => n.includes("117")));
    assert.equal(rest.length, dinuba.microNudges.length - 1);
  });

  it("has no demand line when there is no demand figure", () => {
    const none = buildCtaSet({ zip: "93618", demandTotal: 0 });
    assert.equal(none.demandNudge, null);
    assert.deepEqual(nudgesWithoutDemand(none), none.microNudges);
  });
});
