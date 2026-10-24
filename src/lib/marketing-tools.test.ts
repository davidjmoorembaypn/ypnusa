import assert from "node:assert/strict";
import test from "node:test";
import { buildMarketingToolPrompt, parseMarketingToolInput } from "./marketing-tools";

test("parses and trims marketing tool input", () => {
 const value=parseMarketingToolInput({tool:"social",profession:"real_estate",businessName:" Acme Realty ",market:" Fresno, CA ",services:" Buyers, sellers "});
 assert.equal(value.tool,"social"); assert.equal(value.profession,"real_estate"); assert.equal(value.businessName,"Acme Realty");
});
test("rejects missing required fields",()=>{ assert.throws(()=>parseMarketingToolInput({tool:"gbp"}),/required/); });
test("GBP prompt prohibits false Google access claims",()=>{ const p=buildMarketingToolPrompt({tool:"gbp",profession:"mortgage",businessName:"YPN",market:"Fresno",services:"FHA"}); assert.match(p,/Never claim you accessed/); assert.match(p,/estimated readiness score/); });
test("social prompt prohibits invented financial claims",()=>{ const p=buildMarketingToolPrompt({tool:"social",profession:"mortgage",businessName:"YPN",market:"Fresno",services:"FHA"}); assert.match(p,/Do not invent rates/); assert.match(p,/compliance review/); });
