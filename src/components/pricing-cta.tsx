"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { checkoutUrlForTier } from "@/lib/checkout";
import { marketingUrl } from "@/lib/site";
import { ZIP_CHECKED_EVENT, ZIP_STORAGE_KEY } from "@/components/territory-claim";
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
 * client-side with whatever ZIP the visitor already checked in TerritoryClaim —
 * read from this page's own `?zip=` param when present (same-page, synced via
 * history.replaceState), otherwise from sessionStorage so a ZIP checked on the
 * home page still applies after navigating to /pricing — so a paid signup
 * locks the same territory they just confirmed was available, instead of
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
      setHref(hrefFor(tierId, zip && /^\d{5}$/.test(zip) ? zip : undefined));
    }

    try {
      const fromUrl = new URLSearchParams(window.location.search).get("zip");
      applyZip(fromUrl ?? sessionStorage.getItem(ZIP_STORAGE_KEY));
    } catch {
      /** noop — falls back to the zip-less href already rendered. */
    }

    function onZipChecked(event: Event) {
      applyZip((event as CustomEvent<{ zip?: string | null }>).detail?.zip);
    }
    window.addEventListener(ZIP_CHECKED_EVENT, onZipChecked);
    return () => window.removeEventListener(ZIP_CHECKED_EVENT, onZipChecked);
  }, [tierId]);

  return (
    <a
      href={href}
      className={className}
      onClick={() => track(tierId === "free" ? "sign_up_click" : "begin_checkout", { plan: tierId })}
    >
      {children}
    </a>
  );
}
