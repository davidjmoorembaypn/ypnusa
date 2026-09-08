import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { runWithTools, toolsForMode } from "./chat-agent";
import { findExplainerVideo, type ExplainerVideo } from "./explainer-videos";
import * as explainerVideos from "./explainer-videos";
import {
  CAPTURE_LEAD_QUALIFICATION_TOOL,
  CHECK_TERRITORY_AVAILABILITY_TOOL,
  FIND_EXPLAINER_VIDEO_TOOL,
} from "./prompts";
import type { AiGenerateRequest, AiGenerateResult, AiProvider, AiToolCall } from "./provider";

describe("findExplainerVideo", () => {
  it("returns null against the default empty registry", () => {
    assert.equal(findExplainerVideo("how does territory locking work"), null);
  });

  it("matches the best (most topic hits) video when the registry has entries", () => {
    // EXPLAINER_VIDEOS is a `const` array — reassignment is blocked, but
    // mutating it in place (push/length reset) is how tests populate the
    // otherwise-empty registry without a real video URL.
    const video: ExplainerVideo = {
      id: "territory-lock",
      title: "How ZIP territory locking works",
      url: "https://ypnus.com/videos/territory-lock.mp4",
      description: "Walks through claiming a ZIP.",
      topics: ["territory", "zip lock", "exclusive"],
    };
    explainerVideos.EXPLAINER_VIDEOS.push(video);
    try {
      const found = findExplainerVideo("Can you explain how your ZIP territory exclusive lock works?");
      assert.equal(found?.id, "territory-lock");
      assert.equal(findExplainerVideo("what's the weather like"), null);
    } finally {
      explainerVideos.EXPLAINER_VIDEOS.length = 0;
    }
  });
});

describe("toolsForMode", () => {
  it("gives public_site the video + territory tools but not lead capture", () => {
    const names = toolsForMode("public_site").map((t) => t.name);
    assert.deepEqual(new Set(names), new Set([FIND_EXPLAINER_VIDEO_TOOL.name, CHECK_TERRITORY_AVAILABILITY_TOOL.name]));
  });

  it("gives lead_qualification all three tools", () => {
    const names = new Set(toolsForMode("lead_qualification").map((t) => t.name));
    assert.ok(names.has(CAPTURE_LEAD_QUALIFICATION_TOOL.name));
    assert.ok(names.has(CHECK_TERRITORY_AVAILABILITY_TOOL.name));
    assert.ok(names.has(FIND_EXPLAINER_VIDEO_TOOL.name));
  });

  it("keeps mlo_dashboard customer-facing-free: video tool only, no territory tool", () => {
    const names = new Set(toolsForMode("mlo_dashboard").map((t) => t.name));
    assert.ok(names.has(FIND_EXPLAINER_VIDEO_TOOL.name));
    assert.ok(!names.has(CHECK_TERRITORY_AVAILABILITY_TOOL.name));
    assert.ok(!names.has(CAPTURE_LEAD_QUALIFICATION_TOOL.name));
  });
});

/** Fake provider whose generate() is scripted call-by-call for deterministic tests. */
function scriptedProvider(script: AiGenerateResult[]): AiProvider {
  let i = 0;
  return {
    name: "fake",
    async generate(): Promise<AiGenerateResult> {
      const next = script[Math.min(i, script.length - 1)];
      i++;
      return next;
    },
  };
}

function toolCallResult(calls: AiToolCall[], text = ""): AiGenerateResult {
  return { text, toolCalls: calls, stopReason: calls.length ? "tool_use" : "end_turn" };
}

describe("runWithTools", () => {
  afterEach(() => {
    mock.restoreAll();
    explainerVideos.EXPLAINER_VIDEOS.length = 0;
  });

  it("returns immediately when the model makes no tool calls", async () => {
    const provider = scriptedProvider([toolCallResult([], "Hi there!")]);
    const { text, captureCalls } = await runWithTools(provider, "sys", [], [FIND_EXPLAINER_VIDEO_TOOL]);
    assert.equal(text, "Hi there!");
    assert.deepEqual(captureCalls, []);
  });

  it("collects capture_lead_qualification calls without triggering a round-trip", async () => {
    const call: AiToolCall = { toolName: "capture_lead_qualification", input: { name: "Sam" } };
    const provider = scriptedProvider([toolCallResult([call], "Thanks Sam!")]);
    const { text, captureCalls } = await runWithTools(provider, "sys", [], [CAPTURE_LEAD_QUALIFICATION_TOOL]);
    assert.equal(text, "Thanks Sam!");
    assert.equal(captureCalls.length, 1);
    assert.equal(captureCalls[0]?.toolName, "capture_lead_qualification");
  });

  it("executes find_explainer_video and feeds the (empty-registry) result back for a second turn", async () => {
    const call: AiToolCall = { toolName: "find_explainer_video", input: { topic: "how territory locking works" } };
    let secondCallMessages: AiGenerateRequest["messages"] = [];
    const provider: AiProvider = {
      name: "fake",
      async generate(request) {
        if (request.messages.length === 0) return toolCallResult([call]);
        secondCallMessages = request.messages;
        return toolCallResult([], "There's no video on that yet, but here's how it works in text...");
      },
    };
    const { text } = await runWithTools(provider, "sys", [], [FIND_EXPLAINER_VIDEO_TOOL]);
    assert.match(text, /no video on that yet/);
    const toolResultMessage = secondCallMessages.find((m) => m.content.includes("find_explainer_video result"));
    assert.ok(toolResultMessage, "expected the tool result to be fed back as a message");
    assert.match(toolResultMessage!.content, /"found":false/);
  });

  it("executes check_territory_availability against a mocked live lookup", async () => {
    mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ available: true, zip: "93720", city: "Fresno", state: "CA" }), { status: 200 }),
    );
    const call: AiToolCall = { toolName: "check_territory_availability", input: { zip: "93720" } };
    let sawResult = false;
    const provider: AiProvider = {
      name: "fake",
      async generate(request) {
        if (request.messages.length === 0) return toolCallResult([call]);
        sawResult = request.messages.some((m) => m.content.includes("check_territory_availability result"));
        return toolCallResult([], "93720 is open!");
      },
    };
    const { text } = await runWithTools(provider, "sys", [], [CHECK_TERRITORY_AVAILABILITY_TOOL]);
    assert.equal(text, "93720 is open!");
    assert.ok(sawResult, "expected the territory lookup result to be fed back");
  });

  it("stops after MAX_TOOL_ROUNDS and forces a final tool-less answer", async () => {
    const call: AiToolCall = { toolName: "find_explainer_video", input: { topic: "x" } };
    let calls = 0;
    const provider: AiProvider = {
      name: "fake",
      async generate(request) {
        calls++;
        if (request.tools === undefined) return toolCallResult([], "final answer, no more tools offered");
        return toolCallResult([call]); // always wants another round
      },
    };
    const { text } = await runWithTools(provider, "sys", [], [FIND_EXPLAINER_VIDEO_TOOL]);
    assert.equal(text, "final answer, no more tools offered");
    assert.ok(calls <= 4, `expected at most MAX_TOOL_ROUNDS + 1 calls, got ${calls}`);
  });
});
