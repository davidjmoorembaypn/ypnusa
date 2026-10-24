"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { track } from "@/lib/track";

/** next/link that also fires a GA4 event on click (no-op when GA is absent). */
export function TrackedLink({
  event,
  eventParams,
  onClick,
  ...props
}: ComponentProps<typeof Link> & {
  event: string;
  eventParams?: Parameters<typeof track>[1];
}) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        track(event, eventParams);
        onClick?.(e);
      }}
    />
  );
}
