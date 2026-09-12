import test from "node:test";
import assert from "node:assert/strict";
import { createSafeAgentTest } from "./agent-onboarding";

test("safe onboarding test exercises the decision layer without delivery", () => {
  const result = createSafeAgentTest();
  assert.equal(result.passed, true);
  assert.equal(result.action, "send_email");
  assert.match(result.trace.join(" "), /delivery in simulation mode/i);
  assert.match(result.trace.join(" "), /consent gate/i);
});
