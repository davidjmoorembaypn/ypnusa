"use client";

import { useState } from "react";
import { useBehaviorTracking } from "@/lib/hooks/useBehaviorTracking";
import { ChurnExitModal } from "./ChurnExitModal";
import { DynamicHero } from "./DynamicHero";
import { InteractiveCalculator } from "./InteractiveCalculator";
import { SelfSelectCards } from "./SelfSelectCards";

/**
 * Predictive/adaptive homepage layer. Purely additive to the existing static
 * hero — it never removes or replaces the server-rendered markup, so with
 * the flag off (the default) the homepage is byte-for-byte what it was
 * before this feature existed.
 *
 * Gate: NEXT_PUBLIC_PREDICTIVE_HOMEPAGE_ENABLED must be exactly "true".
 * Off by default / dry-run safe per the Website Autopilot precedent
 * (see src/lib/ai/website-autopilot.ts) — no live WordPress, Hostinger, or
 * chatbot changes are made by this component either way.
 */
export function PredictiveHomepageEngine() {
  const enabled = process.env.NEXT_PUBLIC_PREDICTIVE_HOMEPAGE_ENABLED === "true";
  const tracking = useBehaviorTracking();
  const [showEstimator, setShowEstimator] = useState(false);

  if (!enabled) return null;

  return (
    <div className="mt-8 space-y-4 rounded-3xl border border-white/15 bg-white/[0.04] p-5 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">What brings you here today?</p>
      <SelfSelectCards
        selected={tracking.visitorIntent}
        onSelect={(intent) => {
          tracking.selectVisitorIntent(intent);
          setShowEstimator(true);
        }}
      />

      {tracking.variant === "conversion_first" ? (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <DynamicHero copy={tracking.heroCopy} />
        </div>
      ) : null}

      {showEstimator ? (
        <div className="pt-2" onMouseEnter={tracking.recordHover}>
          <InteractiveCalculator onInteract={tracking.recordSliderInteraction} />
        </div>
      ) : null}

      <ChurnExitModal open={tracking.exitTrapOpen} onDismiss={tracking.dismissExitTrap} />
    </div>
  );
}
