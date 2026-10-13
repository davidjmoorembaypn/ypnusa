"use client";

import { useEffect, useState } from "react";
import { checkoutUrlForTier } from "@/lib/checkout";
import { ZIP_CHECKED_EVENT, ZIP_STORAGE_KEY } from "@/components/territory-claim";
import type { PricingTierId } from "@/lib/pricing";

function hrefFor(tierId: PricingTierId, zip?: string) {
  return checkoutUrlForTier(tierId, zip);
}

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
      // The ZIP enhancement is optional; keep the base CTA usable.
    }

    function onZipChecked(event: Event) {
      applyZip((event as CustomEvent<{ zip?: string | null }>).detail?.zip);
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
