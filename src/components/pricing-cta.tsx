"use client";

import { useEffect, useState } from "react";
import { checkoutUrlForTier } from "@/lib/checkout";
import { marketingUrl } from "@/lib/site";
import { readEffectiveZip, normalizeZip, ZIP_CHECKED_EVENT } from "@/lib/zip-state";
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
 * Pricing CTA — progressively enhances the initial link with a validated ZIP
 * (URL query wins, then sessionStorage). The link includes data attributes for
 * analytics and opens external targets safely.
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
  const initialZip = typeof window !== "undefined" ? readEffectiveZip() : undefined;
  const [href, setHref] = useState(() => hrefFor(tierId, initialZip));
  const [zipValue, setZipValue] = useState<string | undefined>(initialZip);

  useEffect(() => {
    const applyZip = (zip: string | null | undefined) => {
      const normalized = normalizeZip(zip);
      setZipValue(normalized);
      setHref(hrefFor(tierId, normalized));
    };

    // Seed from the current page / session
    try {
      applyZip(readEffectiveZip());
    } catch {
      // noop — the unenhanced href remains usable
    }

    const onZipChecked = (event: Event) => {
      const zip = (event as CustomEvent<{ zip?: string | null }>).detail?.zip;
      applyZip(zip ?? null);
    };

    window.addEventListener(ZIP_CHECKED_EVENT, onZipChecked);
    return () => window.removeEventListener(ZIP_CHECKED_EVENT, onZipChecked);
  }, [tierId]);

  // Use an explicit target/rel so external marketing/checkout pages open safely and
  // referrer/analytics remain consistent for conversion tracking.
  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      data-ypn-tier={tierId}
      data-ypn-zip={zipValue ?? ""}
      aria-label={`Start signup for ${tierId}${zipValue ? ` (ZIP ${zipValue})` : ""}`}
    >
      {children}
    </a>
  );
}
