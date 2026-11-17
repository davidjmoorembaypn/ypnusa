"use client";

import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import {
  HERO_PHONE_MEDIA,
  HERO_PHONE_POSTER_SIZE,
  HERO_PHONE_POSTER_URL,
  HERO_POSTER_SRCSET,
  HERO_POSTER_URL,
  HERO_WIDE_MEDIA,
  pickHeroVideoSource,
} from "@/lib/hero-video";

/**
 * Decorative looping background video for the homepage hero (muted, looping,
 * inline, no controls).
 *
 * The poster is a real, high-priority responsive image so it is the page's fast
 * Largest Contentful Paint; the video fades in over it only once it is actually
 * playing. Phones never load the video (see hero-video.ts). On larger screens
 * nothing is downloaded until the page has loaded and the browser is idle, and it
 * is skipped for visitors who prefer reduced motion or have Data Saver on. The
 * poster always stays underneath, so there is no layout shift.
 *
 * Phones get a light portrait crop of the poster through <picture>. React does not
 * preload an <img> inside <picture>, so both renditions are preloaded here with media
 * queries: each visitor downloads exactly one, at high priority.
 */
export function HeroVideo() {
  preload(HERO_PHONE_POSTER_URL, { as: "image", fetchPriority: "high", media: HERO_PHONE_MEDIA });
  preload(HERO_POSTER_URL, {
    as: "image",
    fetchPriority: "high",
    imageSrcSet: HERO_POSTER_SRCSET,
    imageSizes: "100vw",
    media: HERO_WIDE_MEDIA,
  });

  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reducedMotion || saveData) return;

    const source = pickHeroVideoSource(window.innerWidth);
    if (!source) return;

    let cancelled = false;
    let idleHandle: number | undefined;
    const play = () => {
      if (cancelled || !ref.current) return;
      ref.current.src = source.url;
      ref.current.play().catch(() => {
        // Autoplay blocked: the poster simply stays. Never surface this to the visitor.
      });
    };
    // Wait for load, then for an idle moment, so the video never competes with the
    // poster, fonts or scripts for bandwidth.
    const start = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(play, { timeout: 3000 });
      } else {
        idleHandle = window.setTimeout(play, 1500);
      }
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
      if (idleHandle !== undefined) {
        if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleHandle);
        else window.clearTimeout(idleHandle);
      }
    };
  }, []);

  return (
    <>
      {/* Plain <img>: the poster is a small static file served by this app, so it skips the
          on-demand image optimizer. srcSet lets phones fetch the ~30 KB rendition. */}
      <picture>
        <source
          media={HERO_PHONE_MEDIA}
          srcSet={HERO_PHONE_POSTER_URL}
          width={HERO_PHONE_POSTER_SIZE.width}
          height={HERO_PHONE_POSTER_SIZE.height}
        />
        <img
          src={HERO_POSTER_URL}
          srcSet={HERO_POSTER_SRCSET}
          sizes="100vw"
          alt=""
          aria-hidden="true"
          width={1600}
          height={900}
          fetchPriority="high"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      </picture>
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
