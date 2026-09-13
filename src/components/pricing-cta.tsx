"use client";

import { useEffect, useState } from "react";
import { checkoutUrlForTier } from "@/lib/checkout";
import { marketingUrl } from "@/lib/site";
import { ZIP_CHECKED_EVENT } from "@/components/territory-claim";
import type { PricingTierId } from "@/lib/pricing";

function signupHrefForPlan(plan: string, zip?: string) {
  const params = new URLSearchParams({ plan });
  if (zip) params.set("zip", zip);
  return marketingUrl(`/lo-signup.html?${params.toString()}`);
}

function hrefFor(tierId: PricingTierId, zip?: string) {
  return tierId === "free" ? signupHrefForPlan(tierId, zip) : checkoutUrlForTier(tierId, zip);
}

/**
 * Renders a pricing tier's signup/checkout link, then progressively enhances it
 * client-side with whatever ZIP the visitor already checked in TerritoryClaim
 * (synced into the URL's `?zip=` param via history.replaceState) — so a paid
 * signup locks the same territory they just confirmed was available, instead of
 * making them re-enter it on ypnus.com.
 */
export function PricingCta({
  tierId,
  className,
  children,
}: {
  tierId: PricingTierId;
  className?: string;
  children: React.ReactNode;
}) {
  const [href, setHref] = useState(() => hrefFor(tierId));

  useEffect(() => {
    function applyZip(zip: string | null | undefined) {
      if (zip && /^\d{5}$/.test(zip)) {
        setHref(hrefFor(tierId, zip));
      }
    }

    try {
      applyZip(new URLSearchParams(window.location.search).get("zip"));
    } catch {
      /** noop — falls back to the zip-less href already rendered. */
    }

    function onZipChecked(event: Event) {
      applyZip((event as CustomEvent<{ zip?: string }>).detail?.zip);
    }
    window.addEventListener(ZIP_CHECKED_EVENT, onZipChecked);
    return () => window.removeEventListener(ZIP_CHECKED_EVENT, onZipChecked);
  }, [tierId]);

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
