"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeScroll,
  createInitialBehaviorState,
  loadPersistedBehavior,
  recordSignal,
  resolveContentVariant,
  resolveDynamicHeroCopy,
  savePersistedBehavior,
  type BehaviorState,
  type ContentVariant,
  type DynamicHeroCopy,
  type ScrollSample,
  type VisitorIntent,
} from "@/lib/analytics-behavior";

/**
 * Wires window/document micro-interactions into the pure analytics-behavior
 * engine and mirrors the result to localStorage. Everything that touches the
 * DOM lives here; the scoring/classification logic itself is tested without
 * a browser in src/lib/analytics-behavior.test.ts.
 */
export function useBehaviorTracking() {
  const [state, setState] = useState<BehaviorState>(() => createInitialBehaviorState());
  const [visitorIntent, setVisitorIntentState] = useState<VisitorIntent | null>(null);
  const [returningVisitor, setReturningVisitor] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const lastScroll = useRef<ScrollSample | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persisted = loadPersistedBehavior(window.localStorage);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount hydration from localStorage; initial render must match SSR output.
    setState(persisted.state);
    setVisitorIntentState(persisted.visitorIntent);
    setReturningVisitor(persisted.returningVisitor);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    savePersistedBehavior(window.localStorage, { state, visitorIntent });
  }, [state, visitorIntent, hydrated]);

  const record = useCallback((type: Parameters<typeof recordSignal>[1]["type"], weight?: number) => {
    setState((prev) => recordSignal(prev, { type, timestamp: Date.now(), weight }));
  }, []);

  const selectVisitorIntent = useCallback(
    (intent: VisitorIntent) => {
      setVisitorIntentState(intent);
      record("self_select");
    },
    [record],
  );

  // Micro-interactions: hover on pricing/features, scroll velocity + backtracking,
  // copy/paste, and tab visibility — all client-only, no network round trip.
  useEffect(() => {
    if (typeof window === "undefined" || !hydrated) return;

    const handleScroll = () => {
      const now = { scrollY: window.scrollY, timestamp: Date.now() };
      const previous = lastScroll.current;
      lastScroll.current = now;
      if (!previous) return;

      const analysis = analyzeScroll(previous, now);
      // No exit-intent pop-up (removed 2026-11-16 at David's request): scroll is only scored.
      setState((prev) =>
        recordSignal(prev, {
          type: analysis.isBacktracking ? "scroll_backtrack" : "scroll",
          timestamp: now.timestamp,
        }),
      );
    };

    const handleCopy = () => record("copy");
    const handlePaste = () => record("paste");
    const handleVisibilityChange = () => record(document.hidden ? "tab_hidden" : "tab_visible");

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hydrated, record]);

  const recordHover = useCallback(() => record("hover"), [record]);
  const recordSliderInteraction = useCallback(() => record("slider_interaction"), [record]);

  const variant: ContentVariant = resolveContentVariant({ state, visitorIntent, returningVisitor });
  const heroCopy: DynamicHeroCopy = resolveDynamicHeroCopy({ state, visitorIntent, returningVisitor }, variant);

  return {
    hydrated,
    state,
    variant,
    heroCopy,
    visitorIntent,
    returningVisitor,
    selectVisitorIntent,
    recordHover,
    recordSliderInteraction,
  };
}
