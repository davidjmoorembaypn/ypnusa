"use client";

import { useEffect, useRef } from "react";
import { HERO_POSTER_URL, pickHeroVideoSource } from "@/lib/hero-video";

/**
 * Decorative looping background video for the homepage hero (same behaviour as
 * the WordPress homepage it replaces: muted, looping, inline, no controls).
 *
 * Nothing is downloaded until the page has loaded, and it is skipped entirely
 * for visitors who prefer reduced motion or have Data Saver on — the poster
 * image stays, so there is no layout shift and no wasted bandwidth.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reducedMotion || saveData) return;

    let cancelled = false;
    const start = () => {
      if (cancelled || !ref.current) return;
      ref.current.src = pickHeroVideoSource(window.innerWidth).url;
      ref.current.play().catch(() => {
        // Autoplay blocked: the poster simply stays. Never surface this to the visitor.
      });
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
    };
  }, []);

  return (
    <video
      ref={ref}
      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
      muted
      loop
      playsInline
      preload="none"
      poster={HERO_POSTER_URL}
      aria-hidden="true"
      tabIndex={-1}
      disablePictureInPicture
      disableRemotePlayback
    />
  );
}
