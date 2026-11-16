import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyComplianceGuardrails, officerLicenseLines, requiredDisclosures, type ComplianceOfficer } from "./guardrails";
import { zipToState } from "./zip-state";

const JANE: ComplianceOfficer = { name: "Jane Doe", nmlsId: "123456" };
const JANE_CA: ComplianceOfficer = {
  name: "Jane Doe",
  nmlsId: "123456",
  company: "Valley Home Loans",
  companyNmlsId: "7890",
  licenses: [{ state: "CA", type: "ca_dre", number: "01234567" }],
};

describe("zipToState", () => {
  const cases: Array<[string, string | null]> = [
    ["93277", "CA"], ["90210", "CA"], ["96150", "CA"], ["10001", "NY"], ["00501", "NY"],
    ["85004", "AZ"], ["33101", "FL"], ["60601", "IL"], ["75201", "TX"], ["73301", "TX"],
    ["88510", "TX"], ["20500", "DC"], ["20166", "VA"], ["05501", "MA"], ["02108", "MA"],
    ["98101", "WA"], ["99501", "AK"], ["96813", "HI"], ["89101", "NV"], ["00901", "PR"],
    ["93277-1234", "CA"], ["09012", null], ["96201", null], ["abcde", null], ["123", null],
  ];
  for (const [zip, state] of cases) {
    it(`${zip} -> ${state}`, () => assert.equal(zipToState(zip), state));
  }
});

describe("applyComplianceGuardrails", () => {
  it("adds the California footer (DRE, both NMLS IDs, Equal Housing) to an email", () => {
    const result = applyComplianceGuardrails({ text: "Hi Sam, checking in.", channel: "email", officer: JANE_CA, zip: "93277" });
    assert.equal(result.blocked, false);
    assert.equal(result.state, "CA");
    assert.deepEqual(result.appended, [
      "Jane Doe, NMLS #123456",
      "Valley Home Loans, NMLS #7890",
      "CA DRE #01234567",
      "Equal Housing Opportunity",
    ]);
    assert.ok(result.text.startsWith("Hi Sam, checking in.\n\n"));
    assert.ok(result.warnings.includes("state_rule_unreviewed"));
  });

  it("is idempotent: running twice does not double the disclosures", () => {
    const once = applyComplianceGuardrails({ text: "Hello.", channel: "email", officer: JANE_CA, zip: "93277" });
    const twice = applyComplianceGuardrails({ text: once.text, channel: "email", officer: JANE_CA, zip: "93277" });
    assert.equal(twice.text, once.text);
    assert.deepEqual(twice.appended, []);
  });

  it("recognizes an NMLS ID already written another way, but not a longer number", () => {
    const has = applyComplianceGuardrails({ text: "Jane (NMLS ID: 123456).", channel: "email", officer: JANE });
    assert.ok(!has.appended.includes("Jane Doe, NMLS #123456"));
    const longer = applyComplianceGuardrails({ text: "NMLS #1234567", channel: "email", officer: JANE });
    assert.ok(longer.appended.includes("Jane Doe, NMLS #123456"));
  });

  it("blocks a message to a state the officer is not licensed in", () => {
    const result = applyComplianceGuardrails({ text: "Hi.", channel: "sms", officer: JANE_CA, zip: "85004" });
    assert.equal(result.blocked, true);
    assert.deepEqual(result.reasons, ["not_licensed_in_state"]);
    assert.equal(result.text, "Hi.");
  });

  it("blocks when the officer has no NMLS ID", () => {
    const result = applyComplianceGuardrails({ text: "Hi.", channel: "email", officer: { name: "No Id" } });
    assert.equal(result.blocked, true);
    assert.deepEqual(result.reasons, ["missing_nmls"]);
  });

  it("uses the federal baseline with warnings when licenses or state are unknown", () => {
    const result = applyComplianceGuardrails({ text: "Hi.", channel: "email", officer: JANE });
    assert.equal(result.blocked, false);
    assert.deepEqual(result.appended, ["Jane Doe, NMLS #123456", "Equal Housing Opportunity"]);
    assert.ok(result.warnings.includes("license_states_unknown"));
    assert.ok(result.warnings.includes("state_unknown"));
    const az = applyComplianceGuardrails({ text: "Hi.", channel: "email", officer: JANE, zip: "85004" });
    assert.ok(az.warnings.includes("no_state_rule"));
  });

  it("keeps texts short: no Equal Housing line, disclosure before the STOP line", () => {
    const result = applyComplianceGuardrails({
      text: "Hi Sam, it's Jane checking in. Reply STOP to opt out.",
      channel: "sms",
      officer: JANE,
      zip: "93277",
    });
    assert.equal(result.text, "Hi Sam, it's Jane checking in. Jane Doe, NMLS #123456. Reply STOP to opt out.");
    assert.ok(!result.text.includes("Equal Housing"));
  });

  it("flags a text that runs past two segments", () => {
    const result = applyComplianceGuardrails({ text: "x".repeat(330), channel: "sms", officer: JANE });
    assert.ok(result.warnings.includes("sms_too_long"));
  });

  it("prints Equal Housing Lender for lenders and the CFL line for DFPI licensees", () => {
    const lender: ComplianceOfficer = { ...JANE, equalHousing: "lender", licenses: [{ state: "CA", type: "ca_dfpi_cfl" }] };
    const lines = requiredDisclosures(lender, "landing_footer", "CA");
    assert.ok(lines.includes("Equal Housing Lender"));
    assert.ok(lines.includes("Loans made or arranged pursuant to a California Financing Law license."));
  });

  it("an explicit state wins over the ZIP code", () => {
    const result = applyComplianceGuardrails({ text: "Hi.", channel: "email", officer: JANE_CA, zip: "85004", state: "ca" });
    assert.equal(result.blocked, false);
    assert.equal(result.state, "CA");
  });
});

describe("officerLicenseLines", () => {
  it("lists company NMLS, state lines and licensed states for the officer page", () => {
    const lines = officerLicenseLines({ ...JANE_CA, licenses: [...JANE_CA.licenses!, { state: "AZ", type: "mlo", number: "LO-1" }] });
    assert.deepEqual(lines, ["Valley Home Loans, NMLS #7890", "CA DRE #01234567", "Licensed in AZ, CA"]);
  });
});

describe("marketing disclosures (upgrade 6.6)", async () => {
  const { marketingDisclosures, withMarketingDisclosures } = await import("./guardrails");
  const officer = {
    name: "Dana Diaz",
    nmlsId: "555111",
    company: "Valley Home Loans",
    companyNmlsId: "999000",
    licenses: [{ state: "CA", type: "ca_dre" as const, number: "01234567" }, { state: "NV", type: "mlo" as const }],
    equalHousing: "lender" as const,
  };

  it("covers the officer, the company, every licensed state and Equal Housing", () => {
    const lines = marketingDisclosures(officer, "social_caption");
    assert.equal(lines[0], "Dana Diaz, NMLS #555111");
    assert.ok(lines.includes("Valley Home Loans, NMLS #999000"));
    assert.ok(lines.includes("Licensed in CA, NV"));
    assert.equal(lines.at(-1), "Equal Housing Lender");
  });

  it("is idempotent and keeps an NMLS ID the post already shows", () => {
    const once = withMarketingDisclosures("Free buyer Q&A Saturday. Dana Diaz NMLS ID: 555111", officer, "social_caption");
    assert.equal(once.appended.includes("Dana Diaz, NMLS #555111"), false);
    const twice = withMarketingDisclosures(once.text, officer, "social_caption");
    assert.equal(twice.text, once.text);
    assert.deepEqual(twice.appended, []);
  });

  it("puts a visible placeholder where the NMLS ID is missing", () => {
    const lines = marketingDisclosures({ name: "Nia North" }, "social_caption");
    assert.equal(lines[0], "Nia North, NMLS #[add your NMLS ID]");
  });
});
