"use client";

import { useEffect, useRef, useState } from "react";
import { HERO_POSTER_SRCSET, HERO_POSTER_URL, pickHeroVideoSource } from "@/lib/hero-video";

/**
 * Decorative looping background video for the homepage hero (same behaviour as
 * the WordPress homepage it replaces: muted, looping, inline, no controls).
 *
 * The poster is a real, preloaded, responsive image so it is the page's fast
 * Largest Contentful Paint on phones; the video fades in over it only once it is
 * actually playing. Nothing is downloaded for the video until the page has
 * loaded, and it is skipped entirely for visitors who prefer reduced motion or
 * have Data Saver on: the poster stays, so there is no layout shift and no
 * wasted bandwidth.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

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
    <>
      {/* Plain <img>: the poster is a small static file served by this app, so it skips the
          on-demand image optimizer. srcSet lets phones fetch the ~30 KB rendition. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static LCP poster, see hero-video.ts */}
      <img
        src={HERO_POSTER_URL}
        srcSet={HERO_POSTER_SRCSET}
        sizes="100vw"
        alt=""
        aria-hidden="true"
        width={1600}
        height={900}
        fetchPriority="high"
        decoding="async"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <video
        ref={ref}
        className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${playing ? "opacity-100" : "opacity-0"}`}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        tabIndex={-1}
        disablePictureInPicture
        disableRemotePlayback
        onPlaying={() => setPlaying(true)}
      />
    </>
  );
}
