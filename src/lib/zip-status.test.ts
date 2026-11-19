import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findOpenNeighbors } from "./zip-neighbors";
import { createZipStatusResolver, type LiveZipAnswer } from "./zip-status";

function resolverWith(answers: Record<string, LiveZipAnswer | null | "throw">, extra: { now?: () => number } = {}) {
  const calls: string[] = [];
  const resolver = createZipStatusResolver({
    live: async (zip) => {
      calls.push(zip);
      const answer = answers[zip];
      if (answer === "throw") throw new Error("boom");
      return answer ?? null;
    },
    ...extra,
  });
  return { resolver, calls };
}

describe("zip status resolver", () => {
  it("maps the live answer to open or claimed and keeps reported demand", async () => {
    const { resolver } = resolverWith({ "93618": { available: true, demandTotal: 390, demandWindowDays: 60 }, "93616": { available: false } });
    const open = await resolver.resolve("93618");
    assert.equal(open.status, "open");
    assert.equal(open.demandTotal, 390);
    assert.equal(open.demandWindowDays, 60);
    assert.equal((await resolver.resolve("93616")).status, "claimed");
  });

  it("is unknown, never open, when the live ledger can't answer or throws", async () => {
    const { resolver } = resolverWith({ "93618": null, "93616": "throw" });
    assert.equal((await resolver.resolve("93618")).status, "unknown");
    assert.equal((await resolver.resolve("93616")).status, "unknown");
    assert.equal((await resolver.resolve("nope")).status, "unknown");
  });

  it("caches answers for the ttl, then asks again", async () => {
    let t = 0;
    const { resolver, calls } = resolverWith({ "93618": { available: true } }, { now: () => t });
    await resolver.resolve("93618");
    await resolver.resolve("93618");
    assert.equal(calls.length, 1);
    t += 6 * 60_000;
    await resolver.resolve("93618");
    assert.equal(calls.length, 2);
  });

  it("limits concurrency and keeps result order", async () => {
    let active = 0;
    let peak = 0;
    const resolver = createZipStatusResolver({
      concurrency: 3,
      live: async (zip) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
        return { available: Number(zip) % 2 === 0 };
      },
    });
    const zips = ["10000", "10001", "10002", "10003", "10004", "10005", "10006", "10007"];
    const out = await resolver.resolveMany(zips);
    assert.ok(peak <= 3, `peak concurrency ${peak}`);
    assert.deepEqual(out.map((o) => o.zip), zips);
  });
});

describe("findOpenNeighbors", () => {
  it("returns only confirmed-open ZIP codes, nearest first, and counts unknowns", async () => {
    // Everything claimed except a few; one lookup fails.
    const answers = new Proxy({} as Record<string, LiveZipAnswer | null>, {
      get: (_t, zip: string) => (zip === "93618" ? null : { available: Number(zip) % 3 === 0 }),
    });
    const resolver = createZipStatusResolver({ live: async (zip) => answers[zip] });
    const result = await findOpenNeighbors("93618", { limit: 3, resolver });
    assert.ok(result.neighbors.length <= 3);
    for (let i = 1; i < result.neighbors.length; i += 1) assert.ok(result.neighbors[i].miles >= result.neighbors[i - 1].miles);
    for (const n of result.neighbors) assert.equal(Number(n.zip) % 3, 0);
    assert.ok(!result.neighbors.some((n) => n.zip === "93618"));
  });

  it("lists nothing when the ledger can't answer", async () => {
    const resolver = createZipStatusResolver({ live: async () => null });
    const result = await findOpenNeighbors("93618", { limit: 5, resolver, maxCandidates: 12 });
    assert.equal(result.neighbors.length, 0);
    assert.equal(result.unknownCount, 12);
  });

  it("stops looking once it has enough open ZIP codes", async () => {
    const seen: string[] = [];
    const resolver = createZipStatusResolver({
      live: async (zip) => {
        seen.push(zip);
        return { available: true };
      },
    });
    const result = await findOpenNeighbors("93618", { limit: 3, resolver, maxCandidates: 40 });
    assert.equal(result.neighbors.length, 3);
    assert.ok(seen.length <= 8, `looked up ${seen.length}`);
  });

  it("returns nothing for a ZIP code that is not in the geo data", async () => {
    const resolver = createZipStatusResolver({ live: async () => ({ available: true }) });
    const result = await findOpenNeighbors("00000", { limit: 3, resolver });
    assert.deepEqual(result, { neighbors: [], unknownCount: 0, checked: 0 });
  });
});
