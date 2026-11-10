"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isFunnelEvent, landingPageType, trackFunnel } from "@/lib/funnel-events";

/**
 * Site-wide funnel events, mounted once in the root layout:
 * - landing_view on every public marketing page view (not app screens or borrower pages);
 * - signup_complete when sign-in lands with ?signup=1 (set only for a brand-new account),
 *   then removes that flag from the address bar;
 * - any funnel event named on a clicked link's data-funnel-event attribute
 *   (e.g. site_preview_open on "see the demo site" links in imported page HTML).
 */
export function FunnelPageEvents() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const pageType = landingPageType(pathname);
    if (pageType) trackFunnel("landing_view", { page_type: pageType, path: pathname });

    const url = new URL(window.location.href);
    if (url.searchParams.get("signup") === "1") {
      trackFunnel("signup_complete", { source: "email_link", path: pathname });
      url.searchParams.delete("signup");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest("a[data-funnel-event]") : null;
      if (!target) return;
      const name = target.getAttribute("data-funnel-event");
      if (!isFunnelEvent(name)) return;
      trackFunnel(name, { source: target.getAttribute("data-funnel-source") ?? "link", path: window.location.pathname });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
