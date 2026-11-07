"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { HERO_POSTER_URL, pickHeroVideoSource } from "@/lib/hero-video";

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
      <Image
        src={HERO_POSTER_URL}
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        className="pointer-events-none object-cover"
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
