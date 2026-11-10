"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { OPEN_ASSISTANT_EVENT } from "./open-assistant-button";

const FloatingAssistantWidget = dynamic(
  () => import("./floating-assistant-widget").then((m) => m.FloatingAssistantWidget),
  { ssr: false },
);

/**
 * Loads the floating Cerebro widget after the page is interactive, so its code stays
 * out of the first paint on phones. The widget only greets after a few seconds anyway.
 * A click on an "ask Cerebro" button before then mounts it at once and replays the
 * click by opening straight into the chat, so no visitor's tap is lost.
 */
export function FloatingAssistantLazy() {
  const [mounted, setMounted] = useState(false);
  const [openedEarly, setOpenedEarly] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const mountNow = () => setMounted(true);
    const openEarly = () => {
      setOpenedEarly(true);
      setMounted(true);
    };
    window.addEventListener(OPEN_ASSISTANT_EVENT, openEarly);
    let idle: number | undefined;
    let timer: number | undefined;
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(mountNow, { timeout: 2500 });
      else timer = window.setTimeout(mountNow, 1500);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener(OPEN_ASSISTANT_EVENT, openEarly);
      window.removeEventListener("load", schedule);
      if (idle !== undefined && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [mounted]);

  return mounted ? <FloatingAssistantWidget startInChat={openedEarly} /> : null;
}
