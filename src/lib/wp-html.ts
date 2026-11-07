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
};

/** The WordPress banner that was never migrated (404 on every page that used it). */
const BROKEN_IMAGE_PATHS = new Set(["/wp-content/uploads/2026/08/ypn-usa-mlo-banner.jpg"]);

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
  path = PATH_REWRITES[path] ?? path;
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

  // app.ypnus.com now 301s to ypnus.com: name the canonical host in copy and in any
  // script URLs too (a 301 would turn a script's POST into a GET).
  out = out.replace(/\bapp\.ypnus\.com\b/gi, "ypnus.com");

  // Internal links.
  out = out.replace(/(<a\b[^>]*?\bhref=)(["'])([^"']*)\2/gi, (_m, pre: string, q: string, href: string) => {
    return `${pre}${q}${normalizeWpHref(href)}${q}`;
  });
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
