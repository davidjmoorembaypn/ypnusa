"use client";

import { useCallback, useState } from "react";
import { track } from "@/lib/track";
import type { UpgradeOptions } from "@/lib/upgrade-options";
import { BlurredLeadFeed } from "./blurred-lead-feed";
import { CerebroLivePreview } from "./cerebro-live-preview";
import { TerritoryUpgradeModal, type UpgradeRequest } from "./territory-upgrade-modal";

/** The ZIP code lead feed, plus (Free plan only) the Cerebro preview, sharing one upgrade slide-over. */
export function DashboardUpsell(props: {
  paid: boolean;
  options: UpgradeOptions;
  freeMessages: number;
  freeActions: number;
  /** "feed" renders the lead feed; "cerebro" the Cerebro preview. Both share one slide-over per instance. */
  part: "feed" | "cerebro";
}) {
  const { paid, options, freeMessages, freeActions, part } = props;
  const [request, setRequest] = useState<UpgradeRequest | null>(null);
  const open = useCallback((next: UpgradeRequest) => {
    track("upgrade_slideover_open", { reason: next.reason, zip_set: Boolean(next.zip) });
    setRequest(next);
  }, []);
  const close = useCallback(() => setRequest(null), []);

  return (
    <>
      {part === "feed" ? <BlurredLeadFeed onUpgrade={open} /> : null}
      {part === "cerebro" && !paid ? (
        <CerebroLivePreview freeMessages={freeMessages} freeActions={freeActions} onUpgrade={open} />
      ) : null}
      <TerritoryUpgradeModal request={request} options={options} paid={paid} onClose={close} />
    </>
  );
}
