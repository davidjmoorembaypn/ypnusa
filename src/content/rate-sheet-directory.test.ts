import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RATE_SHEET_LOAN_TYPES, RATE_SHEET_SOURCES, sourcesForLoanType } from "./rate-sheet-directory";

describe("rate-sheet directory", () => {
  it("has unique ids and https links on official or named sources", () => {
    const ids = RATE_SHEET_SOURCES.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const s of RATE_SHEET_SOURCES) {
      if (s.url !== null) assert.match(s.url, /^https:\/\//, s.id);
    }
  });

  it("covers every loan type with at least one source", () => {
    for (const type of RATE_SHEET_LOAN_TYPES) {
      assert.ok(sourcesForLoanType(type).length > 0, type);
    }
    assert.equal(sourcesForLoanType("All").length, RATE_SHEET_SOURCES.length);
  });

  it("every entry says who publishes it and how often it updates", () => {
    for (const s of RATE_SHEET_SOURCES) {
      assert.ok(s.publisher.length > 0 && s.updates.length > 0 && s.whatItShows.length > 0, s.id);
    }
  });

  it("lists sources only: no rates, percentages or promises in the copy", () => {
    for (const s of RATE_SHEET_SOURCES) {
      const text = `${s.name} ${s.whatItShows} ${s.updates}`;
      assert.ok(!/\d+(\.\d+)?\s?%/.test(text), `${s.id} contains a percentage`);
      assert.ok(!/best rate|lowest rate|guarantee/i.test(text), `${s.id} makes a rate claim`);
    }
  });

  it("DSCR has no public benchmark, so its only sources are lender sheets", () => {
    assert.ok(sourcesForLoanType("DSCR").every((s) => s.kind === "Your lender" && s.url === null));
  });
});
