import assert from "node:assert/strict";
import { it } from "node:test";
import { calculateScenario, MORTGAGE_SCENARIO, PROPERTY_SCENARIO } from "./property-scenarios";
import { housingMarketTrend, observations } from "./housing-market";

it("recasts after interest-only years and amortizes zero-interest debt", () => {
  const inputs = { price: 2500000, downPayment: 500000, ratePct: 6, termYears: 30, interestOnlyYears: 10 };
  const result = calculateScenario(MORTGAGE_SCENARIO.name, inputs);
  assert.equal(result.purchasePriceLtvPct, 80);
  assert.equal(result.monthlyInterestOnly, 10000);
  assert.equal(result.monthlyPrincipalAndInterest?.toFixed(2), "14328.62");
  assert.equal(calculateScenario(MORTGAGE_SCENARIO.name, { ...inputs, ratePct: 0 }).monthlyPrincipalAndInterest, 2000000 / 240);
  assert.throws(() => calculateScenario(MORTGAGE_SCENARIO.name, { ...inputs, interestOnlyYears: 30 }));
  assert.throws(() => calculateScenario(MORTGAGE_SCENARIO.name, { ...inputs, downPayment: -1 }));
});

it("separates the property's return from financing and covers unlevered properties", () => {
  const inputs = { price: 4000000, effectiveAnnualIncome: 400000, annualOperatingExpenses: 160000, annualDebtService: 180000, targetCapPct: 5 };
  const result = calculateScenario(PROPERTY_SCENARIO.name, inputs);
  assert.equal(result.annualNOI, 240000);
  assert.equal(result.goingInCapRatePct, 6);
  assert.equal(result.noiDebtServiceCoverageRatio, 4 / 3);
  assert.equal(result.impliedValueAtTargetCap, 4800000);
  assert.equal(result.annualCashFlowBeforeCapexAndTax, 60000);
  assert.equal(calculateScenario(PROPERTY_SCENARIO.name, { ...inputs, annualDebtService: 0 }).noiDebtServiceCoverageRatio, null);
});

it("reports valid observations, previous and year-ago dates without treating blanks as zero", () => {
  const csv = "observation_date,TEST\n2025-11-13,5\n2026-11-05,5.5\n2026-11-12,6\n2026-11-19,\n2026-11-26,8";
  const result = observations(csv, "TEST", "2026-11-20", "weekly");
  assert.equal(result.latest.value, 6);
  assert.equal(result.previousObservation?.changeInSourceUnits, 0.5);
  assert.equal(result.yearAgoObservation?.changeInSourceUnits, 1);
  assert.throws(() => observations(csv, "OTHER", "2026-11-20", "weekly"));
  assert.throws(() => observations(csv, "TEST", "2024-01-01", "weekly"));
});

it("reports unsupported queries and future cutoffs", async () => {
  assert.ok("error" in await housingMarketTrend({seriesId: "../invalid"}));
  assert.ok("error" in await housingMarketTrend({seriesId: "HOUST", asOf: "2999-01-01"}));
});

it("compares FHFA purchase and jumbo refinance observations with the proper quarter", async () => {
  const { originationTrend } = await import("./originations");
  const purchase = originationTrend({ segment: "all", purpose: "purchase", quarter: "2025Q4" });
  assert.equal(purchase.observation?.countThousands, 754);
  assert.equal(purchase.previousQuarter?.quarter, "2025Q3");
  assert.equal(purchase.yearAgoQuarter?.quarter, "2024Q4");
  const jumbo = originationTrend({ segment: "jumbo", purpose: "refinance", quarter: "2025Q4" });
  assert.equal(jumbo.observation?.volumeMillionsUSD, 28689);
  assert.ok("error" in originationTrend({ segment: "jumbo", purpose: "all", quarter: "2099Q4" }));
});

it("returns dated market evidence to the conversation after a tool call", async (t) => {
  const { runWithTools, toolsForMode } = await import("./chat-agent");
  t.mock.method(globalThis, "fetch", async () => new Response("observation_date,MORTGAGE30US\n2025-01-02,6.3\n2025-01-09,6.4"));
  let rounds = 0;
  const result = await runWithTools({
    name: "test",
    async generate(request) {
      if (++rounds === 1) return { text: "", toolCalls: [{toolName:"housing_market_trend",input:{seriesId:"MORTGAGE30US"}}], stopReason: "tool_use" };
      const data = request.messages.at(-1)!.content;
      assert.match(data, /2025-01-09/);
      assert.match(data, /fred.stlouisfed.org\/series\/MORTGAGE30US/);
      return {text:"The latest returned observation is dated January 9, 2025.",toolCalls:[],stopReason:"end_turn"};
    },
  }, "sys", [{role:"user",content:"What is the national mortgage rate trend?"}], toolsForMode("mlo_dashboard"), {
    id:"test", mode:"mlo_dashboard",createdAt:"",updatedAt:"",messages:[],capturedFields:{},status:"active",
  }, () => {});
  assert.equal(result.actionCalls.length, 1);
  assert.match(result.text, /2025/);
});
