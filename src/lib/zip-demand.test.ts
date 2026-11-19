import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMAND_METHODOLOGY, allZipDemand, estimateZipDemand, zipDemandCoverage } from "./zip-demand";

const URBAN = ["10001", "90012", "60614", "93720"]; // Manhattan, downtown LA, Chicago, Fresno
const SUBURBAN = ["93611", "93619", "75034", "30097"]; // Clovis CA x2, Frisco TX, Duluth GA
const RURAL = ["93618", "59001", "82190", "67839"]; // Dinuba CA, Absarokee MT, Yellowstone WY, Dighton KS

describe("60-day zip demand estimates", () => {
  it("covers tens of thousands of ZIP codes", () => {
    assert.ok(zipDemandCoverage() > 33_000);
  });

  it("is never null for a well-formed ZIP code, across urban, suburban and rural areas", () => {
    for (const zip of [...URBAN, ...SUBURBAN, ...RURAL]) {
      const d = estimateZipDemand(zip);
      assert.ok(d, zip);
      for (const key of ["buyers", "sellers", "movers_in", "total"] as const) {
        assert.ok(Number.isInteger(d[key]) && d[key] >= 0, `${zip} ${key}=${d[key]}`);
      }
      assert.equal(d.window_days, 60);
      assert.equal(d.source, "market_demographic_model");
      assert.equal(d.methodology, DEMAND_METHODOLOGY);
      assert.match(d.methodology, /not a lead guarantee/);
    }
  });

  it("returns the full legacy-compatible shape", () => {
    assert.deepEqual(Object.keys(estimateZipDemand("93618")!).sort(), ["basis", "buyers", "methodology", "movers_in", "population", "sellers", "source", "total", "window_days"]);
  });

  it("is deterministic: the same ZIP code always gives the same numbers", () => {
    for (const zip of ["93618", "10001", "59001"]) assert.deepEqual(estimateZipDemand(zip), estimateZipDemand(zip));
  });

  it("is internally consistent: total is the sum of its parts, and sellers follow the stated assumption", () => {
    for (const zip of [...URBAN, ...SUBURBAN, ...RURAL]) {
      const d = estimateZipDemand(zip)!;
      assert.equal(d.total, d.buyers + d.sellers + d.movers_in, zip);
      assert.equal(d.sellers, d.buyers, zip);
    }
  });

  it("scales with the place instead of flooring every ZIP code to the same numbers", () => {
    const fresno = estimateZipDemand("93720")!;
    const dinuba = estimateZipDemand("93618")!;
    const absarokee = estimateZipDemand("59001")!;
    const beverlyHills = estimateZipDemand("90210")!;
    assert.equal(fresno.basis, "census_acs");
    assert.ok(fresno.total > dinuba.total && dinuba.total > absarokee.total, `${fresno.total} / ${dinuba.total} / ${absarokee.total}`);
    // A town of about 700 households cannot have dozens of buyers in 60 days.
    assert.ok(absarokee.buyers < 15, `Absarokee buyers ${absarokee.buyers}`);
    assert.notDeepEqual([absarokee.buyers, absarokee.movers_in], [beverlyHills.buyers, beverlyHills.movers_in]);
  });

  it("matches the documented formula and reports the Census population", () => {
    // 93618: population 32,223; households 8,604; 592 owner movers; 2,079 movers in all.
    const size = 32223 / 8604;
    const d = estimateZipDemand("93618")!;
    assert.equal(d.buyers, Math.round((592 / size) * (60 / 365)));
    assert.equal(d.movers_in, Math.round(((2079 - 592) / size) * (60 / 365)));
    assert.equal(d.population, 32223);
  });

  it("gives zeros with population null when the Census has no residential data, and null only for bad input", () => {
    const none = estimateZipDemand("00000")!;
    assert.deepEqual([none.buyers, none.sellers, none.movers_in, none.total, none.population, none.basis], [0, 0, 0, 0, null, "none"]);
    assert.equal(estimateZipDemand("1234"), null);
    assert.equal(estimateZipDemand("abcde"), null);
  });

  it("never produces NaN or a negative number anywhere in the dataset", () => {
    for (const row of allZipDemand()) {
      assert.ok(row.buyers >= 0 && row.movers_in >= 0 && Number.isFinite(row.total) && row.total === row.buyers + row.sellers + row.movers_in, row.zip);
    }
  });
});
