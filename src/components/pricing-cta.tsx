"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { trackFunnel } from "@/lib/funnel-events";
import { checkoutUrlForTier, payNowUrlForTier, prepaid5yUrlForTier } from "@/lib/checkout";
import { ZIP_CHECKED_EVENT, ZIP_STORAGE_KEY } from "@/components/territory-claim";
import type { PricingTierId } from "@/lib/pricing";

/**
 * Which checkout a CTA opens:
 * - "trial": 15-day trial to try the tools; the ZIP code locks at the first payment.
 * - "pay_now": same monthly price, no trial; the ZIP code locks at checkout.
 * - "prepaid_5y": one payment; the ZIP code locks for 5 years from payment.
 */
export type PricingCtaVariant = "trial" | "pay_now" | "prepaid_5y";

function hrefFor(tierId: PricingTierId, variant: PricingCtaVariant, zip?: string): string | null {
  if (variant === "pay_now") return payNowUrlForTier(tierId, zip);
  if (variant === "prepaid_5y") return prepaid5yUrlForTier(tierId, zip);
  return checkoutUrlForTier(tierId, zip);
}

/**
 * Renders a pricing tier's signup/checkout link, then progressively enhances it
 * client-side with whatever ZIP the visitor already checked in TerritoryClaim —
 * read from this page's own `?zip=` param when present (same-page, synced via
 * history.replaceState), otherwise from sessionStorage so a ZIP checked on the
 * home page still applies after navigating to /pricing — so a paid signup
 * locks the same territory they just confirmed was available, instead of
 * making them re-enter it on ypnus.com.
 *
 * Renders nothing for a variant the tier doesn't offer (pay_now / prepaid_5y on free or
 * the retired starter tier), rather than silently falling back to another checkout.
 */
export function PricingCta({
  tierId,
  variant = "trial",
  className,
  children,
  "aria-describedby": ariaDescribedBy,
}: {
  tierId: PricingTierId;
  variant?: PricingCtaVariant;
  className?: string;
  children: React.ReactNode;
  "aria-describedby"?: string;
}) {
  const [href, setHref] = useState(() => hrefFor(tierId, variant));

  useEffect(() => {
    function applyZip(zip: string | null | undefined) {
      setHref(hrefFor(tierId, variant, zip && /^\d{5}$/.test(zip) ? zip : undefined));
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
  }, [tierId, variant]);

  if (!href) return null;

  return (
    <a
      href={href}
      className={className}
      aria-describedby={ariaDescribedBy}
      onClick={() => {
        track(
          tierId === "free" ? "sign_up_click" : "begin_checkout",
          tierId === "free" ? { plan: tierId } : { plan: tierId, checkout: variant },
        );
        if (tierId !== "free") trackFunnel("checkout_started", { plan: tierId, checkout: variant, source: "pricing" });
      }}
    >
      {children}
    </a>
  );
}
