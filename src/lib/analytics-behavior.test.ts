import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BEHAVIOR_STORAGE_KEY,
  HIGH_INTENT_SCORE_THRESHOLD,
  analyzeScroll,
  classifyIntent,
  createInitialBehaviorState,
  detectExitRisk,
  loadPersistedBehavior,
  markExitTrapShown,
  recordSignal,
  resolveContentVariant,
  resolveDynamicHeroCopy,
  savePersistedBehavior,
  type BehaviorState,
  type KeyValueStorage,
  type PersistedBehavior,
} from "./analytics-behavior";

/** In-memory stand-in for window.localStorage — keeps these tests DOM-free and network-free. */
function createFakeStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

test("classifyIntent: below threshold is low_intent, at/above is high_intent", () => {
  assert.equal(classifyIntent(0), "low_intent");
  assert.equal(classifyIntent(HIGH_INTENT_SCORE_THRESHOLD - 1), "low_intent");
  assert.equal(classifyIntent(HIGH_INTENT_SCORE_THRESHOLD), "high_intent");
  assert.equal(classifyIntent(HIGH_INTENT_SCORE_THRESHOLD + 50), "high_intent");
});

test("recordSignal: accumulates weighted score and reclassifies intent", () => {
  let state = createInitialBehaviorState(1000);
  assert.equal(state.intent, "low_intent");

  state = recordSignal(state, { type: "hover", timestamp: 1001 });
  assert.equal(state.score, 2);
  assert.equal(state.signals.length, 1);

  state = recordSignal(state, { type: "self_select", timestamp: 1002 });
  assert.equal(state.score, 12);
  assert.equal(state.intent, "low_intent");

  state = recordSignal(state, { type: "copy", timestamp: 1003 });
  assert.equal(state.score, 18);

  state = recordSignal(state, { type: "slider_interaction", timestamp: 1004 });
  assert.ok(state.score >= HIGH_INTENT_SCORE_THRESHOLD, "score should cross the high-intent threshold");
  assert.equal(state.intent, "high_intent");
});

test("recordSignal: score never goes negative even with heavy negative signals", () => {
  let state = createInitialBehaviorState(0);
  state = recordSignal(state, { type: "tab_hidden", timestamp: 1 });
  state = recordSignal(state, { type: "tab_hidden", timestamp: 2 });
  state = recordSignal(state, { type: "tab_hidden", timestamp: 3 });
  assert.equal(state.score, 0);
});

test("recordSignal: a custom weight overrides the default for that signal type", () => {
  let state = createInitialBehaviorState(0);
  state = recordSignal(state, { type: "hover", timestamp: 1, weight: 100 });
  assert.equal(state.score, 100);
});

test("recordSignal: trims signal history so it never grows unbounded", () => {
  let state = createInitialBehaviorState(0);
  for (let i = 0; i < 500; i += 1) {
    state = recordSignal(state, { type: "scroll", timestamp: i });
  }
  assert.ok(state.signals.length <= 200);
});

test("analyzeScroll: detects backtracking and fast upward exit scroll", () => {
  const down = analyzeScroll({ scrollY: 0, timestamp: 0 }, { scrollY: 500, timestamp: 100 });
  assert.equal(down.isBacktracking, false);
  assert.equal(down.isFastExitScroll, false);

  const slowUp = analyzeScroll({ scrollY: 500, timestamp: 0 }, { scrollY: 490, timestamp: 100 });
  assert.equal(slowUp.isBacktracking, true);
  assert.equal(slowUp.isFastExitScroll, false);

  const fastUp = analyzeScroll({ scrollY: 800, timestamp: 0 }, { scrollY: 0, timestamp: 100 });
  assert.equal(fastUp.isBacktracking, true);
  assert.equal(fastUp.isFastExitScroll, true);
});

test("detectExitRisk: fires for a low-score visitor with an exit signal, not for an engaged one", () => {
  const lowIntentState = createInitialBehaviorState(0);
  assert.equal(detectExitRisk(lowIntentState, { pointerLeftTop: true }), true);
  assert.equal(detectExitRisk(lowIntentState, { fastExitScroll: true }), true);
  assert.equal(detectExitRisk(lowIntentState, {}), false);

  let engagedState = createInitialBehaviorState(0);
  for (let i = 0; i < 10; i += 1) {
    engagedState = recordSignal(engagedState, { type: "copy", timestamp: i });
  }
  assert.equal(detectExitRisk(engagedState, { pointerLeftTop: true }), false);
});

test("detectExitRisk: never re-fires once markExitTrapShown has recorded it for the session", () => {
  const state = createInitialBehaviorState(0);
  const shown = markExitTrapShown(state);
  assert.equal(shown.exitTrapShown, true);
  assert.equal(shown.intent, "exit_risk");
  assert.equal(detectExitRisk(shown, { pointerLeftTop: true }), false);
});

test("loadPersistedBehavior: returns a fresh state when storage is empty", () => {
  const storage = createFakeStorage();
  const persisted = loadPersistedBehavior(storage, 5000);
  assert.equal(persisted.returningVisitor, false);
  assert.equal(persisted.visitorIntent, null);
  assert.equal(persisted.state.score, 0);
});

test("loadPersistedBehavior: returns a fresh state when storage holds malformed JSON, never throws", () => {
  const storage = createFakeStorage();
  storage.setItem(BEHAVIOR_STORAGE_KEY, "{not json");
  const persisted = loadPersistedBehavior(storage, 5000);
  assert.equal(persisted.state.score, 0);
  assert.equal(persisted.returningVisitor, false);
});

test("savePersistedBehavior + loadPersistedBehavior round-trip state and visitor intent", () => {
  const storage = createFakeStorage();
  let state: BehaviorState = createInitialBehaviorState(0);
  state = recordSignal(state, { type: "self_select", timestamp: 1 });

  savePersistedBehavior(storage, { state, visitorIntent: "refinancing" });
  const reloaded = loadPersistedBehavior(storage, 2);

  assert.equal(reloaded.returningVisitor, true);
  assert.equal(reloaded.visitorIntent, "refinancing");
  assert.equal(reloaded.state.score, state.score);
  assert.equal(reloaded.state.signals.length, state.signals.length);
});

test("savePersistedBehavior: a storage that throws on write is swallowed, never crashes the caller", () => {
  const throwingStorage: KeyValueStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota exceeded");
    },
  };
  assert.doesNotThrow(() => savePersistedBehavior(throwingStorage, { state: createInitialBehaviorState(0), visitorIntent: null }));
});

test("resolveContentVariant: first-time, low-intent visitor gets trust_first", () => {
  const persisted: PersistedBehavior = { state: createInitialBehaviorState(0), visitorIntent: null, returningVisitor: false };
  assert.equal(resolveContentVariant(persisted), "trust_first");
});

test("resolveContentVariant: high-intent score forces conversion_first regardless of visit history", () => {
  let state = createInitialBehaviorState(0);
  state = recordSignal(state, { type: "self_select", timestamp: 1 });
  state = recordSignal(state, { type: "copy", timestamp: 2 });
  state = recordSignal(state, { type: "slider_interaction", timestamp: 3 });
  const persisted: PersistedBehavior = { state, visitorIntent: null, returningVisitor: false };
  assert.equal(resolveContentVariant(persisted), "conversion_first");
});

test("resolveContentVariant: a returning visitor with a known intent gets conversion_first even at low score", () => {
  const persisted: PersistedBehavior = { state: createInitialBehaviorState(0), visitorIntent: "buying", returningVisitor: true };
  assert.equal(resolveContentVariant(persisted), "conversion_first");
});

test("resolveDynamicHeroCopy: trust_first always shows the default acquisition hero", () => {
  const persisted: PersistedBehavior = { state: createInitialBehaviorState(0), visitorIntent: "buying", returningVisitor: false };
  const copy = resolveDynamicHeroCopy(persisted, "trust_first");
  assert.equal(copy.primaryCtaHref, "#territories");
});

test("resolveDynamicHeroCopy: conversion_first + mlo intent points at booking a demo", () => {
  const persisted: PersistedBehavior = { state: createInitialBehaviorState(0), visitorIntent: "mlo", returningVisitor: true };
  const copy = resolveDynamicHeroCopy(persisted, "conversion_first");
  assert.equal(copy.primaryCtaLabel, "Book a demo");
  assert.equal(copy.primaryCtaHref, "#demo");
});

test("resolveDynamicHeroCopy: conversion_first + buyer/refi intent points at resuming pre-approval", () => {
  const persisted: PersistedBehavior = { state: createInitialBehaviorState(0), visitorIntent: "refinancing", returningVisitor: true };
  const copy = resolveDynamicHeroCopy(persisted, "conversion_first");
  assert.equal(copy.primaryCtaLabel, "Resume pre-approval");
  assert.match(copy.eyebrow, /refinance/);
});
