import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkMarketingCompliance } from "./marketing-compliance";
import { executeKnowledgeTool, lookUp, MORTGAGE_GUIDE, PLATFORM_HELP } from "./knowledge";

describe("Cerebro answer books", () => {
  it("finds the right borrower topic", () => {
    assert.equal(lookUp(MORTGAGE_GUIDE, "What's the difference between prequalified and preapproved?").topics[0]?.id, "prequal_vs_preapproval");
    assert.equal(lookUp(MORTGAGE_GUIDE, "Should I refinance to lower my rate?").topics[0]?.id, "refinance");
    assert.equal(lookUp(MORTGAGE_GUIDE, "what documents do I need").topics[0]?.id, "documents");
  });

  it("finds the right officer topic", () => {
    assert.equal(lookUp(PLATFORM_HELP, "how do I cancel my subscription").topics[0]?.id, "billing");
    assert.equal(lookUp(PLATFORM_HELP, "can cerebro talk to customers when I'm busy").topics[0]?.id, "follow_ups");
    assert.equal(lookUp(PLATFORM_HELP, "who owns my zip code").topics[0]?.id, "zip_codes");
  });

  it("lists every topic when nothing matches", () => {
    const result = lookUp(MORTGAGE_GUIDE, "zzz");
    assert.equal(result.topics.length, 0);
    assert.equal(result.otherTopics.length, MORTGAGE_GUIDE.length);
  });

  it("borrower guide passes the advertising checks: no rates, payments, guarantees or numbers", () => {
    for (const topic of MORTGAGE_GUIDE) {
      assert.deepEqual(checkMarketingCompliance({ fields: { [topic.id]: topic.answer } }), [], topic.id);
      assert.doesNotMatch(topic.answer.replace(/W-2s?/g, ""), /\d/, topic.id);
    }
  });

  it("returns JSON the model can use", () => {
    const parsed = JSON.parse(executeKnowledgeTool("mortgage_guide", "FHA or conventional?"));
    assert.equal(parsed.topics[0].id, "loan_types");
    assert.match(parsed.note, /loan officer/);
  });
});
