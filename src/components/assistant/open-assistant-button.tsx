"use client";

import type { ReactNode } from "react";

export const OPEN_ASSISTANT_EVENT = "ypn:open-assistant";

/** Opens the site-wide floating assistant (see FloatingAssistantWidget). */
export function OpenAssistantButton(props: { className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className={props.className}
      onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))}
    >
      {props.children}
    </button>
  );
}
