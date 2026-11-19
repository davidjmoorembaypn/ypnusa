import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { zipsWithinRadius } from "./geo/zip-geo";
import { MAX_AUDIT_ZIPS, parseOfficers, parseRadius, runTerritoryAudit } from "./territory-audit";
import { createZipStatusResolver, type LiveZipAnswer } from "./zip-status";

function resolver(answer: (zip: string) => LiveZipAnswer | null) {
  return createZipStatusResolver({ live: async (zip) => answer(zip) });
}

describe("territory audit", () => {
  it("counts open, claimed and unknown ZIP codes and sums only the demand the ledger reported", async () => {
    const r = resolver((zip) => {
      const n = Number(zip);
      if (n % 5 === 0) return null; // unknown
      if (n % 2 === 0) return { available: false };
      return n % 3 === 0 ? { available: true, demandTotal: 100, demandWindowDays: 60 } : { available: true };
    });
    const result = await runTerritoryAudit({ zip: "93618", radius: 15, officers: 4 }, r);
    assert.ok(result.ok);
    const { audit } = result;
    assert.equal(audit.totals.open + audit.totals.claimed + audit.totals.unknown, audit.totals.evaluated);
    assert.equal(audit.zips.filter((z) => z.status === "open").length, audit.totals.open);
    assert.equal(audit.demand.openZips, audit.totals.open);
    // Demand comes only from open ZIP codes that reported a number.
    const expected = audit.zips.filter((z) => z.status === "open" && z.demandTotal !== null).reduce((s, z) => s + (z.demandTotal ?? 0), 0);
    assert.equal(audit.demand.total, expected);
    assert.equal(audit.demand.zipsReporting, audit.zips.filter((z) => z.status === "open" && z.demandTotal !== null).length);
    assert.equal(audit.officers, 4);
    assert.equal(audit.center.city, "Dinuba");
  });

  it("starts with the office ZIP code and lists the others nearest first", async () => {
    const result = await runTerritoryAudit({ zip: "93618", radius: 10 }, resolver(() => ({ available: true })));
    assert.ok(result.ok);
    const { zips } = result.audit;
    assert.equal(zips[0].zip, "93618");
    assert.equal(zips[0].miles, 0);
    for (let i = 2; i < zips.length; i += 1) assert.ok(zips[i].miles >= zips[i - 1].miles);
  });

  it("caps lookups and reports how many ZIP codes in the radius were not looked up", async () => {
    let lookups = 0;
    const r = createZipStatusResolver({
      live: async () => {
        lookups += 1;
        return { available: true };
      },
    });
    const dense = "90012"; // downtown Los Angeles: many ZIP codes within 15 miles
    const inRadius = zipsWithinRadius(dense, 15).length + 1;
    assert.ok(inRadius > MAX_AUDIT_ZIPS, `expected a dense area, got ${inRadius}`);
    const result = await runTerritoryAudit({ zip: dense, radius: 15 }, r);
    assert.ok(result.ok);
    assert.equal(result.audit.totals.evaluated, MAX_AUDIT_ZIPS);
    assert.equal(lookups, MAX_AUDIT_ZIPS);
    assert.equal(result.audit.totals.inRadius, inRadius);
    assert.equal(result.audit.totals.notEvaluated, inRadius - MAX_AUDIT_ZIPS);
  });

  it("reports everything as unknown, with no open ZIP codes, when the ledger can't answer", async () => {
    const result = await runTerritoryAudit({ zip: "93618", radius: 5 }, resolver(() => null));
    assert.ok(result.ok);
    assert.equal(result.audit.totals.open, 0);
    assert.equal(result.audit.totals.unknown, result.audit.totals.evaluated);
    assert.equal(result.audit.demand.total, 0);
  });

  it("rejects a malformed or unknown ZIP code", async () => {
    const r = resolver(() => ({ available: true }));
    assert.deepEqual(await runTerritoryAudit({ zip: "9361" }, r), { ok: false, code: "INVALID_ZIP", message: "Enter a 5-digit ZIP code." });
    const unknown = await runTerritoryAudit({ zip: "00000" }, r);
    assert.ok(!unknown.ok && unknown.code === "UNKNOWN_ZIP");
  });

  it("only accepts the offered radii and a sane team size", () => {
    assert.equal(parseRadius("5"), 5);
    assert.equal(parseRadius(15), 15);
    assert.equal(parseRadius("500"), 10);
    assert.equal(parseRadius(undefined), 10);
    assert.equal(parseOfficers("12"), 12);
    assert.equal(parseOfficers("5000"), 50);
    assert.equal(parseOfficers("0"), null);
    assert.equal(parseOfficers("abc"), null);
    assert.equal(parseOfficers(null), null);
  });
});
