#!/usr/bin/env node
/**
 * WordPress WXR -> ypnus-node content importer.
 *
 * Usage:
 *   npm run import -- ./wxr/*.xml            (refuses to overwrite existing content)
 *   npm run import -- --force ./wxr/*.xml    (rebuilds content/ and data/ from the exports)
 *
 * Several exports can be passed at once (full export + pages/posts/media exports);
 * items are merged by WordPress post ID and the most recently modified copy wins.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
const he = require('he');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const DATA = path.join(ROOT, 'data');
const SITE_HOST_RE = /https?:\/\/(?:www\.)?ypnus\.com/;

const args = process.argv.slice(2);
const force = args.includes('--force');
const files = args.filter((a) => !a.startsWith('--'));

if (!files.length) {
  console.error('Usage: npm run import -- [--force] <export.xml> [more.xml ...]');
  process.exit(1);
}
if (!force && fs.existsSync(path.join(CONTENT, 'pages'))) {
  console.error('content/pages already exists. Re-run with --force to rebuild content from the exports (local edits in content/ will be overwritten).');
  process.exit(1);
}

/* ------------------------------------------------------------------ parse */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  processEntities: true,
  htmlEntities: false,
  isArray: (name) => ['item', 'wp:postmeta', 'category', 'wp:category', 'wp:tag', 'wp:term', 'wp:author', 'wp:comment'].includes(name),
});

const txt = (v) => {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return v['#text'] !== undefined ? String(v['#text']) : '';
  return String(v);
};

const items = new Map();
const channelData = { categories: new Map(), tags: new Map(), authors: new Map(), site: {} };
const fileStats = [];

for (const file of files) {
  const xml = fs.readFileSync(file, 'utf8');
  const doc = parser.parse(xml);
  const ch = doc.rss && doc.rss.channel;
  if (!ch) { console.error(`Not a WXR file: ${file}`); process.exit(1); }
  channelData.site = { title: txt(ch.title), description: txt(ch.description), baseUrl: txt(ch['wp:base_site_url']) };
  for (const c of ch['wp:category'] || []) {
    channelData.categories.set(txt(c['wp:category_nicename']), {
      slug: txt(c['wp:category_nicename']), name: he.decode(txt(c['wp:cat_name'])),
      parent: txt(c['wp:category_parent']), description: he.decode(txt(c['wp:category_description'])),
    });
  }
  for (const t of ch['wp:tag'] || []) {
    channelData.tags.set(txt(t['wp:tag_slug']), { slug: txt(t['wp:tag_slug']), name: he.decode(txt(t['wp:tag_name'])) });
  }
  for (const a of ch['wp:author'] || []) {
    channelData.authors.set(txt(a['wp:author_login']), { login: txt(a['wp:author_login']), name: he.decode(txt(a['wp:author_display_name'])) });
  }
  let n = 0; let replaced = 0;
  for (const it of ch.item || []) {
    n++;
    const id = txt(it['wp:post_id']);
    const meta = {};
    const metaList = [];
    for (const m of it['wp:postmeta'] || []) {
      const k = txt(m['wp:meta_key']); const v = txt(m['wp:meta_value']);
      metaList.push([k, v]);
      if (!(k in meta)) meta[k] = v;
    }
    const rec = {
      id, type: txt(it['wp:post_type']), status: txt(it['wp:status']),
      title: he.decode(txt(it.title)).trim(), link: txt(it.link), slug: txt(it['wp:post_name']),
      parent: txt(it['wp:post_parent']), menuOrder: Number(txt(it['wp:menu_order']) || 0),
      date: txt(it['wp:post_date_gmt']) || txt(it['wp:post_date']), modified: txt(it['wp:post_modified_gmt']) || txt(it['wp:post_modified']),
      author: txt(it['dc:creator']), content: txt(it['content:encoded']), excerpt: txt(it['excerpt:encoded']),
      attachmentUrl: txt(it['wp:attachment_url']),
      cats: (it.category || []).map((c) => ({ domain: c['@_domain'], slug: c['@_nicename'], name: he.decode(txt(c)) })),
      meta, metaList, source: path.basename(file),
    };
    const prev = items.get(id);
    if (prev) {
      replaced++;
      if ((rec.modified || '') < (prev.modified || '')) continue;
    }
    items.set(id, rec);
  }
  fileStats.push({ file: path.basename(file), items: n, alreadySeen: replaced });
}

/* --------------------------------------------------------------- helpers */

const report = { generatedAt: new Date().toISOString(), files: fileStats, counts: {}, flagged: [], unpublished: [], stalePricing: [], notes: [] };
const flag = (url, issue) => report.flagged.push({ url, issue });

const toPath = (link) => {
  try {
    const u = new URL(link);
    if (u.search) return null; // ?page_id= / ?p= links belong to unpublished items
    return u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
  } catch { return null; }
};

const isNoindex = (robots) => /noindex/i.test(robots || '');

function stripTags(html) {
  return he.decode(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function truncate(s, n) {
  if (!s || s.length <= n) return s || '';
  const cut = s.slice(0, n - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 20))}…`;
}

function replaceVars(s, rec) {
  return String(s || '')
    .replace(/%title%/g, rec.title)
    .replace(/%sep%/g, '|')
    .replace(/%sitename%/g, 'YPN USA')
    .replace(/%(page|pagenumber|pagetotal)%/g, '')
    .replace(/%excerpt%/g, truncate(stripTags(rec.excerpt || rec.content), 155))
    .replace(/%[a-z_]+%/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* Simplified wpautop for classic-editor posts that carry no <p> markup. */
function autop(html) {
  const block = '(?:table|thead|tfoot|caption|col|colgroup|tbody|tr|td|th|div|dl|dd|dt|ul|ol|li|pre|form|map|area|blockquote|address|math|style|p|h[1-6]|hr|fieldset|legend|section|article|aside|hgroup|header|footer|nav|figure|figcaption|details|menu|summary|script|iframe|video|audio)';
  let s = html.replace(/\r\n|\r/g, '\n');
  s = s.replace(new RegExp(`(<${block}[\\s/>])`, 'gi'), '\n\n$1');
  s = s.replace(new RegExp(`(</${block}>)`, 'gi'), '$1\n\n');
  return s.split(/\n\s*\n/).map((chunk) => {
    const c = chunk.trim();
    if (!c) return '';
    if (new RegExp(`^</?${block}[\\s/>]`, 'i').test(c)) return c;
    return `<p>${c.replace(/\n/g, '<br>\n')}</p>`;
  }).filter(Boolean).join('\n');
}

const DYNAMIC_BLOCK_MARKERS = {
  'rank-math/related-posts': '<!--ypx:related-posts-->',
  'rank-math/local-business': '<!--ypx:local-business-->',
  'post-author-biography': '<!--ypx:author-bio-->',
  'post-author-name': '<span class="ypx-author-name">David J. Moore, MBA</span>',
  'site-tagline': '<p class="ypx-tagline">Lead Generation for Mortgage Loan Officers</p>',
  'breadcrumbs': '', // breadcrumbs are rendered by the layout
  'navigation': '', // site navigation is rendered by the layout
  'google-site-kit/rrm-contribute-with-google': '', // Google Site Kit widget, WordPress-only
  'page-list': '',
};
// Empty core blocks carry no content when self-closed; dropping them loses nothing.
const EMPTY_CORE_BLOCKS = new Set(['paragraph', 'group', 'list', 'list-item', 'heading', 'image', 'spacer', 'separator', 'columns', 'column', 'buttons', 'embed']);

// Old tier names -> current tiers (Free $0, Pro $99, Growth $199, Exclusive $299). Exact phrases only.
const PRICING_FIXES = [
  ['Growth $99/mo, Pro $199/mo, Elite $299/mo', 'Pro $99/mo, Growth $199/mo, Exclusive $299/mo'],
  ['Free → Growth $99 → Pro $199 → Elite $299', 'Free → Pro $99 → Growth $199 → Exclusive $299'],
  ['Free &rarr; Growth $99 &rarr; Pro $199 &rarr; Elite $299', 'Free &rarr; Pro $99 &rarr; Growth $199 &rarr; Exclusive $299'],
  ['Growth, Pro, or Elite', 'Pro, Growth, or Exclusive'],
  ['Growth / Pro / Elite', 'Pro / Growth / Exclusive'],
  ['Growth, Pro and Elite', 'Pro, Growth and Exclusive'],
  ['Growth $99 · Pro $199 · Elite $299', 'Pro $99 · Growth $199 · Exclusive $299'],
  ['Growth $99/mo, Pro $199/mo, and Elite $299/mo', 'Pro $99/mo, Growth $199/mo, and Exclusive $299/mo'],
  ['Growth $99, Pro $199, or Elite $299', 'Pro $99, Growth $199, or Exclusive $299'],
  ['Growth $99, Pro $199, Elite $299', 'Pro $99, Growth $199, Exclusive $299'],
  ['Growth ($99) → Pro ($199) → Elite ($299)', 'Pro ($99) → Growth ($199) → Exclusive ($299)'],
  ['Growth $99.99, Pro $199.99, Elite $299.99', 'Pro $99, Growth $199, Exclusive $299'],
  ['Free, Growth, Pro, and Elite', 'Free, Pro, Growth, and Exclusive'],
  ['Growth, Pro, and Elite', 'Pro, Growth, and Exclusive'],
  ['Growth, Pro or Elite', 'Pro, Growth or Exclusive'],
  ['(Growth, Pro, Elite)', '(Pro, Growth, Exclusive)'],
];
const fixStats = { strayN: 0, pricing: 0 };

function cleanContent(rec, url) {
  let h = rec.content || '';
  const faq = [];

  // Rank Math FAQ block attributes -> FAQPage schema data
  h.replace(/<!--\s*wp:rank-math\/faq-block\s+(\{[\s\S]*?\})\s*-->/g, (_, json) => {
    try {
      const attrs = JSON.parse(json);
      for (const q of attrs.questions || []) {
        if (q.visible === false) continue;
        const question = stripTags(q.title); const answer = stripTags(q.content);
        if (question && answer) faq.push({ q: question, a: answer });
      }
    } catch { /* malformed attrs: schema falls back to <details> parsing */ }
    return _;
  });

  // Self-closing (dynamic) blocks have no saved HTML: replace with runtime markers or drop.
  h = h.replace(/<!--\s*wp:([a-z0-9\-/]+)(\s+\{[\s\S]*?\})?\s*\/-->/g, (m, name) => {
    if (name in DYNAMIC_BLOCK_MARKERS) return DYNAMIC_BLOCK_MARKERS[name];
    if (EMPTY_CORE_BLOCKS.has(name)) return '';
    flag(url, `Dynamic block "${name}" has no saved HTML in the export and was removed; rebuild it by hand if it mattered.`);
    return '';
  });

  // Shortcodes
  h = h.replace(/\[mwai_chatbot[^\]]*\]/g, () => {
    flag(url, 'AI Engine chatbot shortcode [mwai_chatbot id="Cerebro"] replaced with a Cerebro card linking to https://app.ypnus.com/assistant (the WordPress chatbot plugin cannot run in Node).');
    return '<!--ypx:cerebro-->';
  });
  h = h.replace(/\[wpforms[^\]]*\]/g, () => {
    flag(url, 'WPForms shortcode [wpforms id="2711"] replaced with the native claim-territory form (posts to /api/lead). Check the fields match what WPForms collected.');
    return '<!--ypx:lead-form source=claim-territory zip=1 phone=1-->';
  });
  h = h.replace(/\[ypnus_onboarding_form[^\]]*\]/g, () => {
    flag(url, 'Custom [ypnus_onboarding_form] shortcode (WordPress mu-plugin) replaced with the native lead form; automatic site provisioning is not wired in the Node app.');
    return '<!--ypx:lead-form source=onboarding zip=1 phone=1-->';
  });
  h = h.replace(/\[(contact-form-7|gravityform|fluentform|caption|embed|video|audio|playlist)\b[^\]]*\]/g, (m) => {
    flag(url, `Shortcode ${m.slice(0, 60)} left as text; needs manual conversion.`);
    return m;
  });

  // Remove remaining block delimiters and editor-only comments
  h = h.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '').replace(/<!--(more|nextpage|noteaser)-->/g, '');

  // Source data bug: escaped newlines lost their backslash and render as stray "n" text between tags.
  h = h.replace(/(^|>)(n+)(?=\s*<|$)/g, (m, a) => { fixStats.strayN++; return `${a}\n`; });

  for (const [from, to] of PRICING_FIXES) {
    const parts = h.split(from);
    if (parts.length > 1) { fixStats.pricing += parts.length - 1; h = parts.join(to); }
  }

  // Full HTML documents pasted into the editor: keep their styles, drop the document shell.
  if (/<!DOCTYPE|<html\b|<head\b|<title\b/i.test(h)) {
    h = h.replace(/<head\b[^>]*>([\s\S]*?)<\/head>/gi, (m, inner) => (inner.match(/<style\b[\s\S]*?<\/style>|<link\b[^>]*rel=["']?stylesheet[^>]*>/gi) || []).join('\n'));
    h = h.replace(/<!DOCTYPE[^>]*>|<\/?html\b[^>]*>|<\/?body\b[^>]*>|<title\b[\s\S]*?<\/title>|<meta\b[^>]*(charset|viewport)[^>]*>/gi, '');
    flag(url, 'Content was a full HTML document (doctype/head/title); the document shell was removed and its styles kept.');
  }

  const isClassic = !/<(p|div|section|h[1-6]|ul|ol|table|figure)\b/i.test(h);
  if (isClassic) h = autop(h);

  // Root-relative internal links so the same HTML works on localhost, staging and production.
  h = h.replace(/(srcset=")([^"]+)(")/gi, (m, a, v, b) => a + v.replace(/https?:\/\/(?:www\.)?ypnus\.com\//g, '/') + b);
  h = h.replace(/(["'(`=])https?:\/\/(?:www\.)?ypnus\.com(\/?)/g, '$1/');
  h = h.replace(/(href|src|action)="\/\/(?=[^/])/g, '$1="/'); // guard against accidental protocol-relative output

  // Lazy-load every image except the first (likely the LCP element)
  let imgIndex = 0;
  h = h.replace(/<img\b(?![^>]*\bloading=)([^>]*)>/gi, (m, attrs) => {
    imgIndex++;
    return imgIndex === 1 ? `<img${attrs} decoding="async">` : `<img loading="lazy" decoding="async"${attrs}>`;
  });

  // FAQ fallback: visible <details><summary> pairs
  const existingFaqSchema = /"@type"\s*:\s*"FAQPage"/.test(h);
  if (!faq.length && !existingFaqSchema) {
    const re = /<details\b[^>]*>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
    let m;
    while ((m = re.exec(h))) {
      const q = stripTags(m[1]); const a = stripTags(m[2]);
      if (q && a) faq.push({ q, a });
    }
    if (faq.length < 2) faq.length = 0;
  }

  const ownHeader = /<nav\b[^>]*class="[^"]*\b(ypn-nav|site-nav|main-nav|navbar|nav-bar|topnav)\b/i.test(h) || /<header\b/i.test(h);
  const jsonLdTypes = [...new Set([...h.matchAll(/"@type"\s*:\s*"([A-Za-z]+)"/g)].map((x) => x[1]))];

  return { html: h.trim(), faq: existingFaqSchema ? [] : faq, ownHeader, hasH1: /<h1\b/i.test(h), jsonLdTypes, isClassic };
}

/* --------------------------------------------------------------- build */

const attachments = new Map();
for (const rec of items.values()) {
  if (rec.type !== 'attachment') continue;
  const url = rec.attachmentUrl || rec.link;
  attachments.set(rec.id, {
    id: rec.id, url: url.replace(SITE_HOST_RE, ''), absoluteUrl: url,
    file: rec.meta._wp_attached_file || '', alt: he.decode(rec.meta._wp_attachment_image_alt || ''),
    title: rec.title, parent: rec.parent, attachmentPage: toPath(rec.link),
  });
}

const PUBLIC_TYPES = new Set(['page', 'post', 'mlo_profile']);
const docs = [];
const idToPath = {};
const redirects = {};

for (const dir of ['pages', 'posts', '_unpublished']) {
  fs.rmSync(path.join(CONTENT, dir), { recursive: true, force: true });
  fs.mkdirSync(path.join(CONTENT, dir), { recursive: true });
}

const fm = (obj) => `---\n${Object.entries(obj)
  .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
  .map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n`;

const counts = { page: 0, post: 0, mlo_profile: 0, unpublished: 0, attachments: attachments.size, classicAutop: 0 };

for (const rec of items.values()) {
  if (!PUBLIC_TYPES.has(rec.type)) continue;
  const url = toPath(rec.link);
  const published = rec.status === 'publish' && url;
  const cleaned = cleanContent(rec, url || rec.link);
  const m = rec.meta;
  const robots = isNoindex(m.rank_math_robots) ? 'noindex,follow' : 'index,follow';
  const thumb = m._thumbnail_id ? attachments.get(m._thumbnail_id) : null;
  const author = { name: 'David J. Moore, MBA' }; // all three WordPress accounts in the export are David Moore
  const description = replaceVars(m.rank_math_description, rec) || truncate(stripTags(rec.excerpt), 158) || truncate(stripTags(cleaned.html), 158);

  const front = {
    id: Number(rec.id),
    type: rec.type === 'mlo_profile' ? 'profile' : rec.type,
    title: rec.title || (url === '/blog/' ? 'Blog' : ''),
    permalink: published ? url : undefined,
    status: rec.status,
    date: rec.date ? `${rec.date.replace(' ', 'T')}Z` : undefined,
    modified: rec.modified ? `${rec.modified.replace(' ', 'T')}Z` : undefined,
    author: author ? author.name : rec.author,
    seoTitle: replaceVars(m.rank_math_title, rec) || undefined,
    description,
    focusKeyword: m.rank_math_focus_keyword || undefined,
    robots,
    ogTitle: m.rank_math_facebook_title || undefined,
    ogDescription: m.rank_math_facebook_description || undefined,
    ogImage: (m.rank_math_facebook_image || '').replace(SITE_HOST_RE, '') || (thumb ? thumb.url : undefined),
    twitterTitle: m.rank_math_twitter_title || undefined,
    twitterDescription: m.rank_math_twitter_description || undefined,
    featuredImage: thumb ? thumb.url : undefined,
    featuredImageAlt: thumb ? (thumb.alt || rec.title) : undefined,
    categories: rec.cats.filter((c) => c.domain === 'category').map((c) => c.slug),
    tags: rec.cats.filter((c) => c.domain === 'post_tag').map((c) => c.slug),
    parentId: rec.parent && rec.parent !== '0' ? Number(rec.parent) : undefined,
    menuOrder: rec.menuOrder || undefined,
    fullWidth: m['_generate-full-width-content'] ? true : undefined,
    hideTitle: m['_generate-disable-headline'] === 'true' || cleaned.hasH1 ? true : undefined,
    ownHeader: cleaned.ownHeader || undefined,
    faq: cleaned.faq,
    contentSchemaTypes: cleaned.jsonLdTypes,
    wpSource: rec.source,
  };

  if (cleaned.isClassic) counts.classicAutop++;

  if (published && /\$(99|199|299)\.99|\bElite\b/.test(cleaned.html)) {
    const hits = [...new Set([...cleaned.html.matchAll(/[^<>]{0,50}(?:\$(?:99|199|299)\.99|\bElite\b)[^<>]{0,40}/g)].map((x) => x[0].trim()))].slice(0, 3);
    report.stalePricing.push({ url, examples: hits });
  }

  let outFile;
  if (published) {
    idToPath[rec.id] = url;
    if (rec.type === 'post') {
      outFile = path.join(CONTENT, 'posts', `${rec.slug || rec.id}.html`);
    } else {
      outFile = url === '/' ? path.join(CONTENT, 'pages', 'index.html') : path.join(CONTENT, 'pages', `${url.slice(1, -1)}.html`);
    }
    counts[rec.type]++;
    docs.push(front);
    // Old slugs (WordPress keeps these as automatic 301s)
    for (const [k, v] of rec.metaList) {
      if (k === '_wp_old_slug' && v && v !== rec.slug) {
        const oldPath = rec.type === 'post' ? `/${v}/` : url.replace(/[^/]+\/$/, `${v}/`);
        if (oldPath !== url) redirects[oldPath] = url;
      }
    }
  } else {
    outFile = path.join(CONTENT, '_unpublished', `${rec.id}-${rec.slug || 'untitled'}.html`);
    counts.unpublished++;
    report.unpublished.push({ id: rec.id, status: rec.status, title: rec.title, link: rec.link });
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, fm(front) + cleaned.html + '\n');
}

// Attachment pages -> parent page (Rank Math default) or the file itself
for (const a of attachments.values()) {
  if (!a.attachmentPage || a.attachmentPage === '/') continue;
  if (idToPath[a.parent]) redirects[a.attachmentPage] = idToPath[a.parent];
  else if (a.url.startsWith('/wp-content/')) redirects[a.attachmentPage] = a.url;
}
// Never let a redirect shadow a live URL
for (const p of Object.values(idToPath)) delete redirects[p];

/* --------------------------------------------------------------- menu */

const navItems = [...items.values()].filter((r) => r.type === 'nav_menu_item' && r.status === 'publish');
const menu = navItems.map((r) => {
  const m = r.meta;
  const objId = m._menu_item_object_id;
  const target = m._menu_item_type === 'custom' ? m._menu_item_url : (idToPath[objId] ? `https://ypnus.com${idToPath[objId]}` : '');
  const linked = items.get(objId);
  return {
    id: r.id, parent: m._menu_item_menu_item_parent || '0', order: r.menuOrder,
    label: r.title || (linked ? linked.title : ''), url: target.replace(SITE_HOST_RE, '') || '/',
    menu: (r.cats.find((c) => c.domain === 'nav_menu') || {}).slug,
  };
}).sort((a, b) => a.order - b.order);

/* --------------------------------------------------------------- media */

const referenced = new Set();
for (const f of fs.readdirSync(path.join(CONTENT, 'pages'), { recursive: true })) {
  const full = path.join(CONTENT, 'pages', String(f));
  if (fs.statSync(full).isFile()) for (const x of fs.readFileSync(full, 'utf8').matchAll(/\/wp-content\/uploads\/[^"'\s)<>,]+/g)) referenced.add(x[0]);
}
for (const f of fs.readdirSync(path.join(CONTENT, 'posts'))) {
  for (const x of fs.readFileSync(path.join(CONTENT, 'posts', f), 'utf8').matchAll(/\/wp-content\/uploads\/[^"'\s)<>,]+/g)) referenced.add(x[0]);
}
for (const a of attachments.values()) if (a.url.startsWith('/wp-content/uploads/')) referenced.add(a.url);

/* --------------------------------------------------------------- write data */

fs.mkdirSync(DATA, { recursive: true });
const writeJson = (name, v) => fs.writeFileSync(path.join(DATA, name), `${JSON.stringify(v, null, 2)}\n`);
writeJson('redirects.json', Object.fromEntries(Object.entries(redirects).sort()));
writeJson('ids.json', idToPath);
writeJson('taxonomies.json', { categories: [...channelData.categories.values()], tags: [...channelData.tags.values()] });
writeJson('wp-menu.json', menu);
writeJson('media.json', [...attachments.values()]);
fs.writeFileSync(path.join(DATA, 'media-manifest.txt'), `${[...referenced].sort().join('\n')}\n`);
if (!fs.existsSync(path.join(DATA, 'redirects-extra.json'))) writeJson('redirects-extra.json', {});

report.fixes = { strayNewlineArtifactsFixed: fixStats.strayN, pricingPhrasesUpdated: fixStats.pricing };
report.counts = { ...counts, redirects: Object.keys(redirects).length, mediaUrlsReferenced: referenced.size, categories: channelData.categories.size, tags: channelData.tags.size, menuItems: menu.length };
report.notes.push('Rank Math Redirections rules live in their own database table and are not part of a WXR export. Export them from Rank Math > Redirections and add them to data/redirects-extra.json as {"/old-path/": "/new-path/"}.');
writeJson('import-report.json', report);

console.log(JSON.stringify(report.counts, null, 2));
console.log(`Flagged items: ${report.flagged.length} | Pages with old pricing text: ${report.stalePricing.length}`);
