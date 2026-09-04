"use client";

import { useState } from "react";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import type { AssistantMode } from "@/lib/types";

const TABS: Array<{ mode: AssistantMode; label: string; title: string; placeholder: string }> = [
  {
    mode: "public_site",
    label: "Public Site",
    title: "Public site assistant",
    placeholder: "Ask about YPN USA programs or territories…",
  },
  {
    mode: "mlo_dashboard",
    label: "MLO Dashboard",
    title: "MLO dashboard assistant",
    placeholder: "Ask about your pipeline…",
  },
  {
    mode: "lead_qualification",
    label: "Lead Qualification",
    title: "Lead qualification assistant",
    placeholder: "Tell us what you're looking to do…",
  },
];

export function AssistantPreviewTabs() {
  const [activeMode, setActiveMode] = useState<AssistantMode>("public_site");
  const activeTab = TABS.find((tab) => tab.mode === activeMode) ?? TABS[0];

  return (
    <>
      <div className="flex flex-wrap justify-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            onClick={() => setActiveMode(tab.mode)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              activeMode === tab.mode
                ? "border-violet-400 bg-violet-500/20 text-white"
                : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 pb-10">
        {/* key forces a clean remount per mode instead of AssistantChat trying to reconcile
            unrelated captured-field/session state across mode switches. */}
        <AssistantChat
          key={activeTab.mode}
          mode={activeTab.mode}
          title={activeTab.title}
          placeholder={activeTab.placeholder}
          funnelSource="assistant_preview_page"
        />
      </div>
    </>
  );
}
