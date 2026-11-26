"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { clarityTagUrl, shouldRecordWithClarity } from "@/lib/clarity";

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

const SCRIPT_ID = "ms-clarity-tag";

/**
 * Microsoft Clarity (session recordings and heatmaps) on public marketing pages only.
 * The tag loads async when the browser is idle, after the page and hero have rendered,
 * so it never competes with first paint. Recording stops when a visitor moves into an
 * app, admin or borrower page in the same tab and starts again when they come back.
 */
export function ClarityTag({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    const record = shouldRecordWithClarity(pathname);
    const loaded = Boolean(document.getElementById(SCRIPT_ID));

    if (!record) {
      if (loaded) window.clarity?.("stop");
      return;
    }
    if (loaded) {
      window.clarity?.("start");
      return;
    }

    const load = () => {
      if (document.getElementById(SCRIPT_ID)) return;
      // Standard Clarity queue: calls made before the library arrives wait and replay.
      if (!window.clarity) {
        const queued: ClarityFn = (...args: unknown[]) => {
          (queued.q = queued.q || []).push(args);
        };
        window.clarity = queued;
      }
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = clarityTagUrl(projectId);
      document.head.appendChild(script);
    };

    if ("requestIdleCallback" in window) {
      const handle = window.requestIdleCallback(load, { timeout: 4000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = setTimeout(load, 1500);
    return () => clearTimeout(timer);
  }, [pathname, projectId]);

  return null;
}
