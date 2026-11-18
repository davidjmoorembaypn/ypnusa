import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";
// Imported by relative path, not the "@/" alias: next.config.ts runs outside the
// app's webpack/TS path-alias resolution, so "@/content/wp-import" (which itself
// imports "@/content/blog") would fail to resolve here.
import wpRedirects from "./src/content/wp-import/redirects.json";
import legacyRedirects from "./src/content/legacy-redirects.json";
import consolidatedPages from "./src/content/consolidated-pages.json";
import wpPages from "./src/content/wp-import/pages.json";
import wpPosts from "./src/content/wp-import/posts.json";

function gitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

// Stamped at build time so /api/health shows which build is live after a deploy.
const buildInfo = {
  APP_BUILT_AT: new Date().toISOString(),
  APP_COMMIT: process.env.APP_COMMIT ?? process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? gitCommit(),
};

const immutableCache = "public, max-age=31536000, immutable";
const publicAssetCache = "public, max-age=86400, stale-while-revalidate=604800";
const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    // Belt-and-suspenders: hPanel/LiteSpeed should also force HTTPS + HSTS at
    // the edge, but the app enforces it at the origin too so this host never
    // silently serves plain HTTP if that toggle is ever missed or reset.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

type Redirect = { source: string; destination: string; permanent: boolean };

/**
 * Lets each redirect source match with or without a trailing slash ("{/}?"), so "/old"
 * and "/old/" both reach the target in one hop from one rule. The WordPress map lists
 * both spellings of most paths; they collapse into one rule here, keeping the redirect
 * count well under Next's 1,000-route performance guideline.
 */
function withOptionalTrailingSlash(redirects: Redirect[]): Redirect[] {
  const seen = new Set<string>();
  const out: Redirect[] = [];
  for (const r of redirects) {
    const base = r.source === "/" ? "/" : r.source.replace(/\/+$/, "");
    if (seen.has(base)) continue;
    seen.add(base);
    out.push(base === "/" ? r : { ...r, source: `${base}{/}?` });
  }
  return out;
}

/**
 * WordPress also served every post at the site root ("/<slug>/"), and Google picked
 * those root addresses as the canonical copy of many posts. They now 404, so send each
 * one to its /blog page in one hop. Skips slugs that are already a page, a route folder
 * or another redirect's source, so nothing that works today changes.
 */
function rootPostRedirects(taken: Redirect[]): Redirect[] {
  const reserved = new Set<string>([
    ...readdirSync(join(process.cwd(), "src/app")),
    ...((wpPages as { top?: { slug: string }[] }).top ?? []).map((page) => page.slug),
    ...taken.map((r) => r.source.replace(/\{\/\}\?$/, "").replace(/\/+$/, "").slice(1)),
  ]);
  return (wpPosts as { slug: string }[])
    .filter((post) => !reserved.has(post.slug))
    .map((post) => ({ source: `/${post.slug}`, destination: `/blog/${post.slug}`, permanent: true }));
}

const nextConfig: NextConfig = {
  // Smaller Hostinger / Node host deploys; `next start` still works.
  output: "standalone",
  // Don't advertise the framework on every response.
  poweredByHeader: false,
  env: buildInfo,
  // With the root layout's revalidate = 300: s-maxage=300, stale-while-revalidate=300.
  expireTime: 600,
  // Hostinger LVE reports 64 CPUs but caps processes far lower; cap Next's build workers so page-data collection does not hit EAGAIN.
  experimental: { cpus: 2, workerThreads: false },
  images: {
    formats: ["image/avif", "image/webp"],
    // Homepage hero poster lives in the media library under ypnus.com/wp-content/uploads.
    remotePatterns: [{ protocol: "https", hostname: "ypnus.com", pathname: "/wp-content/uploads/**" }],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  // Old WordPress URLs end in "/" (that is what Google has indexed). Next's own
  // trailing-slash redirect ran before ours, so each old URL took two hops: "/x/" -> "/x"
  // -> its new page. Handling the slash ourselves sends every old URL to its final page in
  // one 308, and still strips the slash from any other URL (last rule in redirects()).
  skipTrailingSlashRedirect: true,
  async redirects() {
    const mapped = withOptionalTrailingSlash([
      {
        // Marketing copy, Stripe success URLs and prior deploy docs point at
        // /register. WordPress's lo-signup.html is gone now that ypnus.com runs this
        // app, so send sign-up intent to the free-account sign-in (FREE_SIGNUP_HREF
        // in src/lib/checkout.ts). The incoming query string is carried over.
        source: "/register",
        destination: "/login?next=%2Fonboarding",
        permanent: true,
      },
      // The imported WordPress /terms and /privacy pages duplicate the native legal
      // pages (same titles); consolidate on the long forms.
      { source: "/terms", destination: "/terms-of-service", permanent: true },
      { source: "/privacy", destination: "/privacy-policy", permanent: true },
      // Migrated from ypnus.com's WordPress (docs/AWS_MIGRATION.md item 1): duplicate
      // post URLs redirecting to their canonical post, plus the handful of page slugs
      // remapped or dropped in favor of an existing native page. See
      // src/content/wp-import/index.ts for how this map is generated.
      ...Object.entries(wpRedirects as Record<string, string>).map(([source, destination]) => ({
        source,
        destination,
        permanent: true,
      })),
      // Old ypnus.com addresses that Google Search Console still shows and that 404ed
      // (checked 2026-11-10), each sent to its closest live page. Kept apart from
      // redirects.json because that file is regenerated from the WordPress export.
      ...Object.entries(legacyRedirects as Record<string, string>).map(([source, destination]) => ({
        source,
        destination,
        permanent: true,
      })),
      // Old WordPress top-level pages folded into the native page that covers the same topic
      // (thin, broken or duplicate copies). See WP_TOP_PAGES in src/content/wp-import/index.ts.
      ...Object.entries(consolidatedPages as Record<string, string>).map(([source, destination]) => ({
        source,
        destination,
        permanent: true,
      })),
      // WordPress addresses Search Console still lists that 404ed (checked 2026-11-17).
      // Junk pages (test posts, form-plugin screens) stay 404 so Google drops them.
      { source: "/about-us", destination: "/about", permanent: true },
      { source: "/contact-3", destination: "/contact", permanent: true },
      { source: "/cart", destination: "/pricing", permanent: true },
      { source: "/real-estate-coaching-technology", destination: "/features", permanent: true },
      { source: "/top-5-tips-for-stress-free-home-buying-in-2025", destination: "/blog", permanent: true },
      { source: "/keywords/:tag", destination: "/blog", permanent: true },
      { source: "/category/:name", destination: "/blog", permanent: true },
      { source: "/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})", destination: "/blog", permanent: true },
    ]);
    return mapped.concat(withOptionalTrailingSlash(rootPostRedirects(mapped))).concat([
      // WordPress's machine-translated Hebrew copies (/he/...) that Google still crawls:
      // send each to the English address it copied.
      { source: "/he", destination: "/", permanent: true },
      { source: "/he/:path*", destination: "/:path*", permanent: true },
      // Every other URL with a trailing slash: one hop to the slash-less URL (what
      // Next did on its own before skipTrailingSlashRedirect). Must stay last.
      { source: "/:path+/", destination: "/:path+", permanent: true },
    ]);
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // /embed/* is intentionally iframe-embeddable on MLO sites; everything
        // else (intake, login, dashboards) must not be framable.
        source: "/((?!embed/).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        // Cerebro launcher: only the marketing site may frame it. The DENY rule
        // above already skips /embed/*, and this comes after it so that, per
        // Next docs, the last matching rule wins for the same header key.
        source: "/embed/cerebro",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors https://ypnus.com https://www.ypnus.com",
          },
        ],
      },
      {
        // Service worker: always revalidate so a fixed worker reaches phones on the next
        // visit, and allow it to control the whole site (start_url is /dashboard).
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: immutableCache,
          },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: immutableCache,
          },
        ],
      },
      {
        source: "/:path*.(avif|webp|png|jpg|jpeg|gif|svg|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: publicAssetCache,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
