/**
 * A tiny, safe Markdown subset for assistant replies: paragraphs, "-"/"*"/"1." lists,
 * **bold**, [text](url) links and bare URLs. It produces plain data that rich-text.tsx
 * renders as React elements, so model text is never injected as HTML.
 */

export type RichInline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string };

export type RichBlock =
  | { type: "paragraph"; lines: RichInline[][] }
  | { type: "list"; ordered: boolean; items: RichInline[][] };

/**
 * Only these links become clickable: web links, email, phone, and same-site paths.
 * Anything else (javascript:, data:, protocol-relative //host) stays plain text.
 */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^\/(?!\/)/.test(href)) return href;
  if (/^mailto:[^\s]+$/i.test(href) || /^tel:[+\d\-().\s]+$/i.test(href)) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// [text](url) | **bold** | bare http(s) URL
const INLINE_PATTERN = /\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)|\*\*([^*\n]{1,500})\*\*|(https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"])/g;

export function parseInline(text: string): RichInline[] {
  const out: RichInline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ type: "text", text: text.slice(last, index) });
    const [whole, linkText, linkHref, bold, bareUrl] = match;
    if (linkText !== undefined && linkHref !== undefined) {
      const href = safeHref(linkHref);
      out.push(href ? { type: "link", text: linkText, href } : { type: "text", text: whole });
    } else if (bold !== undefined) {
      out.push({ type: "bold", text: bold });
    } else if (bareUrl !== undefined) {
      const href = safeHref(bareUrl);
      out.push(href ? { type: "link", text: bareUrl, href } : { type: "text", text: bareUrl });
    }
    last = index + whole.length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/;

export function parseRichText(body: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  let paragraph: RichInline[][] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", lines: paragraph });
    paragraph = [];
  };

  for (const line of body.replace(/\r\n?/g, "\n").split("\n")) {
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      const content = parseInline((bullet ?? numbered)![1]);
      const previous = blocks[blocks.length - 1];
      if (previous && previous.type === "list" && previous.ordered === ordered) previous.items.push(content);
      else blocks.push({ type: "list", ordered, items: [content] });
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    // "## Heading" renders as a bold line; the chat bubble has no room for real headings.
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    paragraph.push(heading ? [{ type: "bold", text: heading[1] }] : parseInline(line));
  }
  flushParagraph();
  return blocks;
}
