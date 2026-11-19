import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { METRO_MARKETS } from "./metro-markets";
import { COMARKETING_SITE_BANNED, realtorComarketing } from "./metro-realtor-comarketing";

describe("realtor co-marketing block", () => {
  it("builds for every one of the big-city markets", () => {
    for (const m of METRO_MARKETS) {
      const c = realtorComarketing(m);
      assert.equal(c.stats.length, 4, m.slug);
      assert.equal(c.angles.length, 3, m.slug);
      assert.ok(c.outreachStarter.includes(m.city) && c.outreachStarter.includes(m.county), m.slug);
    }
  });

  it("never prints NaN, undefined or an empty number", () => {
    for (const m of METRO_MARKETS) {
      const c = realtorComarketing(m);
      const text = JSON.stringify(c);
      assert.ok(!/NaN|undefined|Infinity/.test(text), m.slug);
      for (const s of c.stats) assert.ok(s.value.length > 0 && s.value !== "$0", `${m.slug} ${s.label}`);
    }
  });

  it("makes no rate, lead-volume, referral or guarantee claims", () => {
    for (const m of METRO_MARKETS) {
      const c = realtorComarketing(m);
      const text = [...c.angles.map((a) => `${a.title} ${a.body}`), c.outreachStarter].join(" ");
      for (const pattern of COMARKETING_SITE_BANNED) assert.ok(!pattern.test(text), `${m.slug}: ${pattern}`);
    }
  });

  it("is addressed to loan officers and carries the RESPA reminder", () => {
    const c = realtorComarketing(METRO_MARKETS[0]);
    assert.match(c.complianceNote, /RESPA Section 8/);
    assert.match(c.complianceNote, /compliance team/);
  });

  it("picks a different lane for at least one purchase-light market", () => {
    const titles = new Set(METRO_MARKETS.map((m) => realtorComarketing(m).angles[0].title));
    assert.ok(titles.size >= 2, "expected both purchase-heavy and refinance-heavy framings across 25 markets");
  });
});
