/**
 * Client-side behavioral scoring engine for the predictive homepage.
 *
 * Pure, synchronous, no fetch/fs — mirrors what GA4's predictive metrics
 * (purchase/churn probability) infer server-side, but computed entirely in
 * the browser from micro-interactions (hover, scroll, copy, tab focus) so
 * no data leaves the client. `useBehaviorTracking` (src/lib/hooks) is the
 * only piece that touches window/document; everything here is plain data
 * in, data out, so it runs under Node's test runner with no DOM.
 */

export type IntentState = "low_intent" | "high_intent" | "exit_risk";

export type BehaviorSignalType =
  | "hover"
  | "scroll"
  | "scroll_backtrack"
  | "copy"
  | "paste"
  | "tab_hidden"
  | "tab_visible"
  | "slider_interaction"
  | "self_select";

export interface BehaviorSignal {
  type: BehaviorSignalType;
  timestamp: number;
  /** Overrides the default weight for this signal type, e.g. a stronger hover target. */
  weight?: number;
}

export interface BehaviorState {
  score: number;
  intent: IntentState;
  signals: BehaviorSignal[];
  sessionStartedAt: number;
  lastUpdatedAt: number;
  /** True once an exit-risk trap has already fired this session, so callers can avoid repeat nags. */
  exitTrapShown: boolean;
}

const DEFAULT_SIGNAL_WEIGHT: Record<BehaviorSignalType, number> = {
  hover: 2,
  scroll: 0.5,
  scroll_backtrack: 4,
  copy: 6,
  paste: 3,
  tab_hidden: -3,
  tab_visible: 1,
  slider_interaction: 5,
  self_select: 10,
};

const MAX_TRACKED_SIGNALS = 200;
export const HIGH_INTENT_SCORE_THRESHOLD = 20;
const EXIT_RISK_SCORE_CEILING = 15;

export function createInitialBehaviorState(now: number = Date.now()): BehaviorState {
  return {
    score: 0,
    intent: "low_intent",
    signals: [],
    sessionStartedAt: now,
    lastUpdatedAt: now,
    exitTrapShown: false,
  };
}

export function classifyIntent(score: number): "low_intent" | "high_intent" {
  return score >= HIGH_INTENT_SCORE_THRESHOLD ? "high_intent" : "low_intent";
}

/** Folds one signal into state: updates score, trims history, and reclassifies intent. */
export function recordSignal(state: BehaviorState, signal: BehaviorSignal): BehaviorState {
  const weight = signal.weight ?? DEFAULT_SIGNAL_WEIGHT[signal.type] ?? 0;
  const score = Math.max(0, state.score + weight);
  const signals = [...state.signals, signal].slice(-MAX_TRACKED_SIGNALS);
  return {
    ...state,
    score,
    signals,
    lastUpdatedAt: signal.timestamp,
    intent: classifyIntent(score),
  };
}

export interface ScrollSample {
  scrollY: number;
  timestamp: number;
}

export interface ScrollAnalysis {
  deltaY: number;
  velocityPxPerMs: number;
  isBacktracking: boolean;
  /** Fast upward scroll near the top of a long page reads as "about to leave", not "re-reading". */
  isFastExitScroll: boolean;
}

const FAST_UPWARD_VELOCITY_PX_PER_MS = 1.2;

export function analyzeScroll(previous: ScrollSample, current: ScrollSample): ScrollAnalysis {
  const dt = Math.max(1, current.timestamp - previous.timestamp);
  const deltaY = current.scrollY - previous.scrollY;
  const velocityPxPerMs = deltaY / dt;
  const isBacktracking = deltaY < 0;
  return {
    deltaY,
    velocityPxPerMs,
    isBacktracking,
    isFastExitScroll: velocityPxPerMs <= -FAST_UPWARD_VELOCITY_PX_PER_MS,
  };
}

export interface ExitRiskInput {
  /** Pointer left through the top of the viewport (classic desktop exit-intent). */
  pointerLeftTop?: boolean;
  /** A fast upward scroll, from analyzeScroll().isFastExitScroll. */
  fastExitScroll?: boolean;
}

/**
 * Exit risk only fires below the exit-risk ceiling and only once per
 * session (via state.exitTrapShown) — an already-engaged or already-shown
 * visitor never gets re-interrupted.
 */
export function detectExitRisk(state: BehaviorState, input: ExitRiskInput): boolean {
  if (state.exitTrapShown) return false;
  if (state.score >= EXIT_RISK_SCORE_CEILING) return false;
  return Boolean(input.pointerLeftTop || input.fastExitScroll);
}

export function markExitTrapShown(state: BehaviorState): BehaviorState {
  return { ...state, intent: "exit_risk", exitTrapShown: true };
}

export type VisitorIntent = "buying" | "refinancing" | "mlo";

export interface PersistedBehavior {
  state: BehaviorState;
  visitorIntent: VisitorIntent | null;
  returningVisitor: boolean;
}

/** Minimal Storage surface (subset of window.localStorage) so this stays DOM-free and testable with a fake. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const BEHAVIOR_STORAGE_KEY = "ypnus_behavior_state_v1";

export function loadPersistedBehavior(storage: KeyValueStorage, now: number = Date.now()): PersistedBehavior {
  try {
    const raw = storage.getItem(BEHAVIOR_STORAGE_KEY);
    if (!raw) return { state: createInitialBehaviorState(now), visitorIntent: null, returningVisitor: false };
    const parsed = JSON.parse(raw) as Partial<PersistedBehavior> & { state?: Partial<BehaviorState> };
    if (!parsed || typeof parsed !== "object" || !parsed.state) {
      return { state: createInitialBehaviorState(now), visitorIntent: null, returningVisitor: false };
    }
    const state: BehaviorState = {
      score: typeof parsed.state.score === "number" ? parsed.state.score : 0,
      intent: parsed.state.intent === "high_intent" || parsed.state.intent === "exit_risk" ? parsed.state.intent : "low_intent",
      signals: Array.isArray(parsed.state.signals) ? parsed.state.signals : [],
      sessionStartedAt: typeof parsed.state.sessionStartedAt === "number" ? parsed.state.sessionStartedAt : now,
      lastUpdatedAt: typeof parsed.state.lastUpdatedAt === "number" ? parsed.state.lastUpdatedAt : now,
      exitTrapShown: Boolean(parsed.state.exitTrapShown),
    };
    const visitorIntent: VisitorIntent | null =
      parsed.visitorIntent === "buying" || parsed.visitorIntent === "refinancing" || parsed.visitorIntent === "mlo"
        ? parsed.visitorIntent
        : null;
    return { state, visitorIntent, returningVisitor: true };
  } catch {
    return { state: createInitialBehaviorState(now), visitorIntent: null, returningVisitor: false };
  }
}

export function savePersistedBehavior(
  storage: KeyValueStorage,
  data: Pick<PersistedBehavior, "state" | "visitorIntent">,
): void {
  try {
    storage.setItem(BEHAVIOR_STORAGE_KEY, JSON.stringify({ state: data.state, visitorIntent: data.visitorIntent }));
  } catch {
    /** noop — storage unavailable or quota exceeded; the session just stays ephemeral. */
  }
}

export type ContentVariant = "trust_first" | "conversion_first";

/**
 * The core "predictive metrics -> content" mapping: a first-time/low-intent
 * visitor gets trust-building, low-friction content; a returning or
 * high-intent visitor gets a direct conversion path.
 */
export function resolveContentVariant(persisted: PersistedBehavior): ContentVariant {
  if (persisted.state.intent === "high_intent") return "conversion_first";
  if (persisted.returningVisitor && persisted.visitorIntent) return "conversion_first";
  return "trust_first";
}

export interface DynamicHeroCopy {
  eyebrow: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
}

const INTENT_LABEL: Record<VisitorIntent, string> = {
  buying: "buyer",
  refinancing: "refinance",
  mlo: "loan officer",
};

/** Self-selection -> copy for the hero + downstream sections, per visitor intent and content variant. */
export function resolveDynamicHeroCopy(persisted: PersistedBehavior, variant: ContentVariant): DynamicHeroCopy {
  if (variant === "conversion_first") {
    if (persisted.visitorIntent === "mlo") {
      return { eyebrow: "Welcome back, loan officer", primaryCtaLabel: "Book a demo", primaryCtaHref: "#demo" };
    }
    if (persisted.visitorIntent) {
      return {
        eyebrow: `Welcome back, ${INTENT_LABEL[persisted.visitorIntent]}`,
        primaryCtaLabel: "Resume pre-approval",
        primaryCtaHref: "#calculator",
      };
    }
    return { eyebrow: "Welcome back", primaryCtaLabel: "Resume pre-approval", primaryCtaHref: "#calculator" };
  }
  return { eyebrow: "Exclusive ZIP demand · for MLOs", primaryCtaLabel: "Claim your ZIP — free", primaryCtaHref: "#territories" };
}
