/**
 * Render-time cleanup for HTML migrated from ypnus.com's WordPress
 * (src/content/wp-import/*.json). The stored JSON stays as exported; these
 * helpers fix what the export carried over so the rendered page doesn't:
 *   - send every internal link through a 308 (trailing slashes, absolute
 *     ypnus.com / app.ypnus.com URLs, retired WordPress paths),
 *   - reference WordPress-only endpoints (pingback, xmlrpc, /feed/),
 *   - show a broken banner image, or load relative style.css / script.js that 404,
 *   - ship zero or several <h1>s.
 */

import { zipCodeCopyHtml } from "@/lib/zip-copy";
import mediaManifest from "@/content/wp-import/media-manifest.json";
import postsData from "@/content/wp-import/posts.json";
import redirectsData from "@/content/wp-import/redirects.json";

/** Hosts that are this site. app.ypnus.com now 301s to ypnus.com. */
const SAME_SITE_HOSTS = new Set(["ypnus.com", "www.ypnus.com", "app.ypnus.com"]);

/** Retired WordPress paths -> the page that replaced them (exact path match, after slash stripping). */
const PATH_REWRITES: Readonly<Record<string, string>> = {
  "/check-zip.html": "/claim-territory",
  "/territory": "/claim-territory",
  "/pricing-plans": "/pricing",
  "/pricing.html": "/pricing",
  "/va-loans": "/loan-types/va-loan-leads",
  "/terms": "/terms-of-service",
  "/privacy": "/privacy-policy",
  "/lo-signup": "/login?next=%2Fonboarding",
  "/register": "/login?next=%2Fonboarding",
  "/predictive-intelligence": "/predictive-lead-gen",
  "/ai-tools": "/features",
  "/marketing-tools": "/features",
};

/** Blog posts live under /blog/<slug>, but WordPress linked many of them at the site root. */
const POST_SLUGS: ReadonlySet<string> = new Set((postsData as { slug: string }[]).map((post) => post.slug));
/** WordPress-era redirects (old slug -> current path), applied to links so they skip the 308 hop. */
const LINK_REDIRECTS = redirectsData as Readonly<Record<string, string>>;

/** Resolve an internal path to where it really lives now: no .html, no redirect hop, posts under /blog. */
function resolveInternalPath(input: string): string {
  let path = (PATH_REWRITES[input] ?? input).replace(/\.html?$/i, "") || "/";
  for (let hops = 0; hops < 3; hops++) {
    const next = PATH_REWRITES[path] ?? LINK_REDIRECTS[path] ?? LINK_REDIRECTS[`${path}/`];
    if (!next || next === path || /^https?:/i.test(next)) break;
    path = next.length > 1 ? next.replace(/\/+$/, "") : next;
  }
  const single = /^\/([a-z0-9-]+)$/i.exec(path);
  if (single && POST_SLUGS.has(single[1])) return `/blog/${single[1]}`;
  return path;
}

/** The WordPress banner that was never migrated (404 on every page that used it). */
const BROKEN_IMAGE_PATHS = new Set([
  "/wp-content/uploads/2026/08/ypn-usa-mlo-banner.jpg",
  "/wp-content/uploads/2026/06/ai-replacing-real-estate-agents-family-buying-1024x559.jpg",
  "/wp-content/uploads/ypn-usa-logo.png",
]);

/**
 * WordPress media the imported pages use, rehosted in public/media/uploads (same
 * path under uploads/) with each file's [width, height]. Rewriting to these copies
 * takes the old WordPress server out of every page load. A file not listed keeps
 * its original URL.
 */
const REHOSTED_MEDIA: Record<string, readonly number[] | undefined> = mediaManifest;
const UPLOADS_URL_RE = /(?:https?:\/\/(?:www\.)?ypnus\.com)?\/wp-content\/uploads\/([A-Za-z0-9._\/-]+\.(?:jpe?g|png|webp|gif|avif|svg))/gi;

/** /wp-content/uploads URL (absolute or relative) -> rehosted /media/uploads URL, when we have the file. */
export function rehostWpMediaUrl(text: string): string {
  return text.replace(UPLOADS_URL_RE, (whole, rel: string) => (REHOSTED_MEDIA[rel] ? `/media/uploads/${rel}` : whole));
}

function rehostedSize(src: string): readonly number[] | undefined {
  const m = /^\/media\/uploads\/(.+)$/.exec(src);
  return m ? REHOSTED_MEDIA[m[1]] : undefined;
}

/**
 * Imported WordPress pages that run inline <script>/onclick code. Scripts inside
 * dangerouslySetInnerHTML only execute on a full document load, so links to these
 * must be plain <a> (never next/link client navigation).
 */
export const INTERACTIVE_WP_PATHS: ReadonlySet<string> = new Set([
  "/mortgage-payment-calculator",
  "/free-property-analyzer",
  "/agent-co-branding",
  "/social-media-deployer",
  "/gbp-ai-engine",
  "/ml-engine",
  "/mlo-marketing",
  "/ypn-usa-partner-suite",
  "/ai-mortgage-loan-leads",
]);

/** True when `href` points at an interactive imported page that needs a full page load. */
export function needsFullPageLoad(href: string): boolean {
  const path = href.split(/[?#]/)[0].replace(/(.)\/+$/, "$1");
  return INTERACTIVE_WP_PATHS.has(path);
}

/**
 * Normalizes one href. Same-site links (relative, or on ypnus.com / www / app)
 * become relative, lose their trailing slash (except "/"), and retired paths are
 * rewritten. Query strings and fragments are kept. Anything else is returned as is.
 */
export function normalizeWpHref(href: string): string {
  const raw = href.trim();
  if (!raw || raw.startsWith("#") || /^(mailto|tel|sms|javascript|data):/i.test(raw)) return href;

  let rest: string;
  const abs = raw.match(/^(?:https?:)?\/\/([^/?#]+)(.*)$/i);
  if (abs) {
    const host = abs[1].toLowerCase().replace(/:\d+$/, "");
    if (!SAME_SITE_HOSTS.has(host)) return href;
    rest = abs[2] || "/";
  } else if (raw.startsWith("/")) {
    rest = raw;
  } else {
    // Relative to the current document (e.g. "style.css"): leave it alone.
    return href;
  }

  const split = rest.search(/[?#]/);
  let path = split === -1 ? rest : rest.slice(0, split);
  const suffix = split === -1 ? "" : rest.slice(split);
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, "") || "/";
  path = resolveInternalPath(path);
  // A rewrite target may carry its own query (e.g. /login?next=...): keep it, then any original suffix.
  if (path.includes("?") && suffix.startsWith("?")) return path;
  return `${path}${suffix}`;
}

function srcPath(src: string): string | null {
  const m = src.trim().match(/^(?:(?:https?:)?\/\/([^/?#]+))?(\/[^?#]*)/i);
  if (!m) return null;
  if (m[1] && !SAME_SITE_HOSTS.has(m[1].toLowerCase())) return null;
  return m[2];
}

/** Link and asset cleanup for imported WordPress HTML. Safe to run more than once. */
export function normalizeWpHtml(html: string): string {
  let out = html;

  // WordPress-only endpoints.
  out = out.replace(/<link\b[^>]*\brel=["']?(?:pingback|EditURI|wlwmanifest)["']?[^>]*>\s*/gi, "");
  out = out.replace(/<link\b[^>]*xmlrpc\.php[^>]*>\s*/gi, "");
  out = out.replace(/<link\b[^>]*\bhref=["'][^"']*\/feed\/?["'][^>]*>\s*/gi, "");
  // <a href=".../feed/">text</a> -> text
  out = out.replace(/<a\b[^>]*\bhref=["'](?:https?:\/\/(?:www\.|app\.)?ypnus\.com)?\/(?:[^"']*\/)?feed\/?["'][^>]*>([\s\S]*?)<\/a>/gi, "$1");

  // Relative style.css / script.js from a static-site export: they 404 here.
  out = out.replace(/<link\b[^>]*\bhref=["'](?:\.\/)?style\.css["'][^>]*>\s*/gi, "");
  out = out.replace(/<script\b[^>]*\bsrc=["'](?:\.\/)?script\.js["'][^>]*>\s*<\/script>\s*/gi, "");

  // Broken images: drop the <img> (and a <p>/<figure> left empty by it).
  out = out.replace(/<img\b[^>]*\bsrc=["']([^"']*)["'][^>]*>/gi, (tag, src: string) => {
    const path = srcPath(src);
    return path && BROKEN_IMAGE_PATHS.has(path) ? "" : tag;
  });
  out = out.replace(/<(p|figure)\b[^>]*>\s*<\/\1>/gi, "");

  // Serve WordPress media from this app (src, srcset, links to full-size files, inline styles).
  out = rehostWpMediaUrl(out);

  // Images: lazy-load all but the first, decode off the main thread, and give rehosted
  // files their real width/height so the page doesn't shift as they load.
  let imageIndex = 0;
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    let next = tag;
    const isFirst = imageIndex++ === 0;
    if (!isFirst && !/\bloading=/i.test(next)) next = next.replace(/^<img\b/i, '<img loading="lazy"');
    if (!/\bdecoding=/i.test(next)) next = next.replace(/^<img\b/i, '<img decoding="async"');
    if (!/\bwidth=/i.test(next) && !/\bheight=/i.test(next)) {
      const src = /\bsrc=["']([^"']*)["']/i.exec(next)?.[1];
      const size = src ? rehostedSize(src) : undefined;
      if (size) next = next.replace(/^<img\b/i, `<img width="${size[0]}" height="${size[1]}"`);
    }
    return next;
  });

  // app.ypnus.com now 301s to ypnus.com: name the canonical host in copy and in any
  // script URLs too (a 301 would turn a script's POST into a GET).
  out = out.replace(/\bapp\.ypnus\.com\b/gi, "ypnus.com");

  // Internal links.
  out = out.replace(/(<a\b[^>]*?\bhref=)(["'])([^"']*)\2/gi, (_m, pre: string, q: string, href: string) => {
    return `${pre}${q}${normalizeWpHref(href)}${q}`;
  });

  // Copy rule: "ZIP code", never a bare "ZIP" (visible text only; see zip-copy.ts).
  out = zipCodeCopyHtml(out);
  return out;
}

/**
 * Leaves the page with exactly one <h1>. When the renderer prints its own title
 * as the <h1> (`rendererHasH1`), every body <h1> is demoted to <h2>. Otherwise the
 * first body <h1> is kept and the rest are demoted; `needsTitleH1` says whether the
 * body had none, so the renderer should print the title as the <h1>.
 */
export function enforceSingleH1(html: string, rendererHasH1: boolean): { html: string; needsTitleH1: boolean } {
  let seen = rendererHasH1;
  let count = 0;
  // Each closing tag follows the decision made for its opening tag.
  const demoteStack: boolean[] = [];
  // <script>/<style> bodies (odd indices after the split) are not markup. An <h1> a
  // script writes into the page at runtime (e.g. a live preview) would be a second
  // h1 once it renders, and the page always has its one h1 from the markup or the
  // renderer, so those are demoted unconditionally.
  const parts = html.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/i);
  const out = parts
    .map((part, i) =>
      i % 2 === 1
        ? /^<script\b(?![^>]*application\/ld\+json)/i.test(part)
          ? part.replace(/<(\/?)h1\b/gi, "<$1h2")
          : part
        : part.replace(/<(\/?)h1\b([^>]*)>/gi, (_m, close: string, attrs: string) => {
            if (close) return demoteStack.pop() ? "</h2>" : "</h1>";
            count += 1;
            const demote = seen;
            seen = true;
            demoteStack.push(demote);
            return demote ? `<h2${attrs}>` : `<h1${attrs}>`;
          }),
    )
    .join("");
  return { html: out, needsTitleH1: !rendererHasH1 && count === 0 };
}

/** Full render-time pass for an imported WordPress body. */
export function prepareWpHtml(html: string, rendererHasH1: boolean): { html: string; needsTitleH1: boolean } {
  return enforceSingleH1(normalizeWpHtml(html), rendererHasH1);
}
