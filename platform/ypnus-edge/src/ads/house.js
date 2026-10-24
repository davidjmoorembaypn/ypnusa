// Lightweight house ads. Plain data, rendered by the loader with textContent (no HTML), so they
// are safe, instant and cost no extra request.

const DEFAULT = {
  title: "Own your zip code",
  body: "Check if your zip code is open for exclusive loan officer leads.",
  cta: "Check your zip code",
  href: "/check-zip",
};

const SHORT = { title: "Check your zip code", body: "", cta: "See if it is open", href: "/check-zip" };

export function houseAdFor(size) {
  return size === "728x90" || size === "320x50" || size === "320x100" ? { ...SHORT } : { ...DEFAULT };
}
