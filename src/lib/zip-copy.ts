/**
 * Copy rule from the Nov 2026 SEO plan: visitors read "ZIP code", never "ZIP" on its own
 * ("Exclusive ZIP Leads" -> "Exclusive ZIP Code Leads", "protected ZIP" -> "protected ZIP code").
 *
 * Hand-written pages say "ZIP code" in their source. Content migrated from WordPress
 * (src/content/wp-import/*.json) is left as exported and rewritten here at render time,
 * so the import stays a faithful snapshot. Only visible text is rewritten: URLs, slugs,
 * HTML attributes and <script>/<style> bodies are never touched.
 */

/**
 * "ZIP" or "ZIPs" as a whole word that isn't already followed by "code", "ZIP+4", or
 * part of an identifier (ZIP_RE, zipCode). Hyphenated compounds ("ZIP-level") are
 * handled separately so they read "ZIP-code-level".
 */
const BARE_ZIP = /\bZIP(s?)\b(?![  -]?(?:[Cc]odes?|CODES?)\b)(?![+_])/g;

/**
 * A lowercase or capitalized "zip" used as a word ("your zip code", "Zip Codes", "per zip"):
 * not part of a URL, path, parameter, email or identifier ("/zip/93720", "?zip=", "zipCode").
 */
const LOWER_ZIP = /(?<![\w/.=&?#@-])[Zz]ip(?=s?(?![\w/=@-]|\.\w))/g;

export function zipCodeCopy(text: string): string {
  if (!/zip/i.test(text)) return text;
  return text.replace(LOWER_ZIP, "ZIP").replace(BARE_ZIP, (match, plural: string, offset: number, whole: string) => {
    const after = whole.slice(offset + match.length);
    if (after.startsWith("-")) return `ZIP-code${plural ? "s" : ""}`;
    // Title Case headings ("Exclusive ZIP Territories") keep their capitals.
    const before = whole.slice(0, offset);
    const titleCase = /^[  ][A-Z][A-Za-z]/.test(after) && (before === "" || /(^|[\s(])[A-Z][A-Za-z&]*[  ]$/.test(before));
    return `ZIP ${titleCase ? "Code" : "code"}${plural ? "s" : ""}`;
  });
}

/**
 * zipCodeCopy for an HTML fragment: rewrites text between tags only, and skips the
 * contents of <script>, <style>, <code> and <pre> blocks.
 */
export function zipCodeCopyHtml(html: string): string {
  if (!/zip/i.test(html)) return html;
  let out = "";
  let skipUntil: string | null = null;
  // Split into tags and text runs; tags keep their attributes untouched.
  const parts = html.split(/(<[^>]*>)/);
  for (const part of parts) {
    if (part.startsWith("<")) {
      const open = /^<\s*(script|style|code|pre|textarea)\b/i.exec(part);
      const close = /^<\s*\/\s*(script|style|code|pre|textarea)\s*>/i.exec(part);
      if (skipUntil && close && close[1].toLowerCase() === skipUntil) skipUntil = null;
      else if (!skipUntil && open && !part.endsWith("/>")) skipUntil = open[1].toLowerCase();
      out += part;
    } else {
      out += skipUntil ? part : zipCodeCopy(part);
    }
  }
  return out;
}
