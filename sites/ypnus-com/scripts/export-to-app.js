#!/usr/bin/env node
'use strict';
/**
 * Copies the ypnus.com rebuild's newer content into the app.ypnus.com Next.js app,
 * which is what serves ypnus.com (see ../../README.md and docs/AWS_MIGRATION.md).
 *
 *   cd sites/ypnus-com && npm ci && node scripts/export-to-app.js [--check]
 *
 * Writes (repo root): src/content/wp-import/{pages,posts,redirects,author}.json
 *
 * What it does, in order:
 *  1. Pages the authority plan rewrote or added (comparisons, editorial policy,
 *     methodology, founder pages, CRM wording, pricing fixes) replace or join the
 *     app's copy. Their internal links are rewritten to the app's URLs, and their
 *     FAQ, schema type, author box, review date and "Keep exploring" links travel along.
 *  2. Every other imported page and post keeps the app's HTML (its links already point
 *     at app routes) and only gets the old plan names and prices replaced.
 *  3. Redirects from the rebuild that the app doesn't have yet are added, pointed at
 *     app URLs. Existing app redirects are never changed.
 *  4. Reports any old plan name or price left behind.
 *
 * Safe to re-run: it starts from the app's files each time and is idempotent.
 * --check writes nothing and exits 1 if the app files are out of date.
 */
const fs = require('fs');
const path = require('path');
const { load, readJson } = require('../src/content');
const { relatedLinks } = require('../src/related-links');
const { wantsAuthor } = require('../src/seo');

const ROOT = path.resolve(__dirname, '..');
const APP = path.resolve(ROOT, '..', '..', 'src', 'content', 'wp-import');
const CHECK = process.argv.includes('--check');

const readApp = (name) => JSON.parse(fs.readFileSync(path.join(APP, name), 'utf8'));
const pages = readApp('pages.json');
const posts = readApp('posts.json');
const redirects = readApp('redirects.json');
const site = readJson('site.json', {});
const content = load();
if (content.errors.length) throw new Error(`Content errors:\n${content.errors.join('\n')}`);

// ---------------------------------------------------------------------------
// Where things live in the app
// ---------------------------------------------------------------------------
const SECTIONS = ['markets', 'loan-types', 'vs', 'platform', 'mlo-marketing', 'territory', 'features', 'agents'];
const strip = (p) => p.replace(/^\/+|\/+$/g, '');
/** Rebuild permalink ("/vs/bonzo/") -> [section, slug] in pages.json ("vs", "bonzo"), or top-level. */
function sectionOf(permalink) {
  const parts = strip(permalink).split('/');
  if (parts.length === 2 && SECTIONS.includes(parts[0])) return [parts[0], parts[1]];
  if (parts.length === 1) return ['top', parts[0]];
  return null;
}

const postSlugs = new Set(posts.map((p) => p.slug));
const appPath = new Map(); // "vs/bonzo" -> "/vs/bonzo"
for (const [sec, list] of Object.entries(pages)) {
  for (const p of list) appPath.set(sec === 'top' ? p.slug : `${sec}/${p.slug}`, sec === 'top' ? `/${p.slug}` : `/${sec}/${p.slug}`);
}
const lookupRedirect = (key) => redirects[`/${key}`] || redirects[`/${key}/`];
const rebuildRedirects = content.redirects; // "/old/" -> "/new/"

/** Old ypnus.com path -> the app's path for the same content, or null if unknown. */
function resolvePath(rawPath, depth = 0) {
  const key = strip(rawPath);
  if (key === '') return '/';
  if (appPath.has(key)) return appPath.get(key);
  if (postSlugs.has(key)) return `/blog/${key}`;
  if (key.startsWith('blog/') && postSlugs.has(key.slice(5))) return `/${key}`;
  const viaApp = lookupRedirect(key);
  if (viaApp) return viaApp;
  const viaRebuild = rebuildRedirects[`/${key}/`];
  if (viaRebuild && depth < 3 && !/^https?:/.test(viaRebuild)) return resolvePath(viaRebuild, depth + 1);
  return null;
}

/** Rewrites site-internal hrefs so they hit app routes directly instead of a redirect hop. */
function rewriteLinks(html) {
  return html.replace(/href="(?:https?:\/\/(?:www\.)?ypnus\.com)?(\/[^"#?]*)([?#][^"]*)?"/g, (m, p, tail = '') => {
    if (/^\/(wp-content|wp-json|assets)\//.test(p) || /\.[a-z0-9]{2,5}$/i.test(p)) return `href="https://ypnus.com${p}${tail}"`;
    const target = resolvePath(p) || (p === '/' ? '/' : p.replace(/\/+$/, ''));
    return `href="${target}${tail}"`;
  });
}

// ---------------------------------------------------------------------------
// Old plan names and prices -> Free $0, Pro $99, Growth $199, Exclusive $299
// (old Growth $99.99 = new Pro, old Pro $199.99 = new Growth, old Elite = new Exclusive)
// ---------------------------------------------------------------------------
const PRICE_FIXES = [
  ['Free → Growth $99 → Pro $199 → Elite $299', 'Free → Pro $99 → Growth $199 → Exclusive $299'],
  ['Free &rarr; Growth $99 &rarr; Pro $199 &rarr; Elite $299', 'Free &rarr; Pro $99 &rarr; Growth $199 &rarr; Exclusive $299'],
  ['Growth $99.99/mo, Pro $199.99/mo, and Elite $299.99/mo', 'Pro $99/mo, Growth $199/mo, and Exclusive $299/mo'],
  ['Growth $99.99, Pro $199.99, Elite $299.99', 'Pro $99, Growth $199, Exclusive $299'],
  ['Growth $99/mo, Pro $199/mo, and Elite $299/mo', 'Pro $99/mo, Growth $199/mo, and Exclusive $299/mo'],
  ['Growth $99/mo, Pro $199/mo, Elite $299/mo', 'Pro $99/mo, Growth $199/mo, Exclusive $299/mo'],
  ['Growth $99 · Pro $199 · Elite $299', 'Pro $99 · Growth $199 · Exclusive $299'],
  ['Free · Growth $99 · Pro $199 · Elite $299', 'Free · Pro $99 · Growth $199 · Exclusive $299'],
  ['Growth $99, Pro $199, Elite $299', 'Pro $99, Growth $199, Exclusive $299'],
  ['Growth $99, Pro $199, or Elite $299', 'Pro $99, Growth $199, or Exclusive $299'],
  ['Growth ($99) → Pro ($199) → Elite ($299)', 'Pro ($99) → Growth ($199) → Exclusive ($299)'],
  ['Free, Growth $99/mo, Pro $199/mo, Elite $299/mo', 'Free, Pro $99/mo, Growth $199/mo, Exclusive $299/mo'],
  ['Free, Growth $99, Pro $199, Elite $299', 'Free, Pro $99, Growth $199, Exclusive $299'],
  ['Free, Growth, Pro, and Elite', 'Free, Pro, Growth, and Exclusive'],
  ['Growth, Pro, and Elite', 'Pro, Growth, and Exclusive'],
  ['Growth, Pro and Elite', 'Pro, Growth and Exclusive'],
  ['Growth, Pro, or Elite', 'Pro, Growth, or Exclusive'],
  ['Growth, Pro or Elite', 'Pro, Growth or Exclusive'],
  ['Growth / Pro / Elite', 'Pro / Growth / Exclusive'],
  ['(Growth, Pro, Elite)', '(Pro, Growth, Exclusive)'],
  ['Included (Pro/Elite)', 'Included (Growth/Exclusive)'],
  ['from free to Elite', 'from free to Exclusive'],
  ['See Elite', 'See Exclusive'],
  ['"name": "Elite", "price": "299.99"', '"name": "Exclusive", "price": "299"'],
  ['"name": "Pro", "price": "199.99"', '"name": "Growth", "price": "199"'],
  ['"name": "Growth", "price": "99.99"', '"name": "Pro", "price": "99"'],
];
const LEFTOVER = /\$(?:99|199|299)\.99|\bElite\b(?![- ]scale)|"(?:99|199|299)\.99"/;

function fixPricing(text) {
  let out = text;
  for (const [from, to] of PRICE_FIXES) out = out.split(from).join(to);
  return out;
}

// ---------------------------------------------------------------------------
// 1. Pages taken whole from the rebuild
// ---------------------------------------------------------------------------
const ORIG = path.join(ROOT, 'authority', 'originals');
const changedByAuthority = new Set();
(function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith('.html')) changedByAuthority.add(e.name.replace(/\.html$/, ''));
  }
})(ORIG);

const NATIVE = new Set(['', 'about', 'features', 'blog', 'pricing', 'onboarding', 'claim-territory', 'login', 'vs', 'markets', 'loan-types', 'platform', 'mlo-marketing', 'territory']);
const FROM_REBUILD = content.pages.filter((d) => {
  const loc = sectionOf(d.permalink);
  if (!loc || d.noindex) return false;
  const key = strip(d.permalink);
  if (NATIVE.has(key)) return false; // the app's own page wins at this path
  const appCopy = (pages[loc[0]] || []).find((p) => p.slug === loc[1]);
  if (!appCopy) return true;
  // The app's copy still carries old pricing the phrase list can't fix: the rebuild's copy was fixed by hand.
  const stillOld = LEFTOVER.test(fixPricing(appCopy.html)) && !LEFTOVER.test(d.body);
  return stillOld || changedByAuthority.has(loc[1]) || d.authorBox === true || d.schemaType === 'Article';
});

const relatedFor = (d) => relatedLinks(d, content)
  .map((l) => ({ href: /\.html$/.test(l.url) ? null : resolvePath(l.url), label: l.label }))
  .filter((l) => l.href);

const toIso = (d) => (d instanceof Date && !isNaN(d) ? d.toISOString().slice(0, 10) : '');
const cleanTitle = (t) => String(t || '').replace(/\s*\|\s*YPN USA\s*$/i, '').trim();

const replaced = [];
const added = [];
for (const d of FROM_REBUILD) {
  const [sec, slug] = sectionOf(d.permalink);
  const list = (pages[sec] = pages[sec] || []);
  const i = list.findIndex((p) => p.slug === slug);
  const prev = i >= 0 ? list[i] : null;
  const entry = {
    slug,
    title: cleanTitle(d.seoTitle && d.hideTitle ? d.title : d.title),
    description: d.description || (prev && prev.description) || '',
    html: rewriteLinks(fixPricing(d.body)),
    date: toIso(d.date) || (prev && prev.date) || '',
    modified: toIso(d.modified) || (prev && prev.modified) || '',
    wpId: Number(d.id) || (prev && prev.wpId) || 0,
  };
  if (d.seoTitle) entry.seoTitle = cleanTitle(d.seoTitle);
  if (!d.hideTitle) entry.showTitle = true;
  if (wantsAuthor(d)) entry.authorBox = true;
  if (d.reviewedDate) entry.reviewedDate = String(d.reviewedDate);
  if (d.schemaType) entry.schemaType = d.schemaType;
  if (Array.isArray(d.faq) && d.faq.length) {
    entry.faq = d.faq.map((f) => ({ q: f.q || f.question, a: f.a || f.answer })).filter((f) => f.q && f.a);
  }
  const links = relatedFor(d);
  if (links.length) entry.related = links;
  if (prev) { list[i] = entry; replaced.push(d.permalink); } else { list.push(entry); added.push(d.permalink); }
  appPath.set(sec === 'top' ? slug : `${sec}/${slug}`, sec === 'top' ? `/${slug}` : `/${sec}/${slug}`);
}

// Pages kept from the app still get the rebuild's author box and "Keep exploring" links.
const taken = new Set(FROM_REBUILD.map((d) => d.permalink));
for (const d of content.pages) {
  if (taken.has(d.permalink) || d.noindex) continue;
  const loc = sectionOf(d.permalink);
  if (!loc) continue;
  const p = (pages[loc[0]] || []).find((x) => x.slug === loc[1]);
  if (!p) continue;
  if (wantsAuthor(d)) p.authorBox = true; else delete p.authorBox;
  const links = relatedFor(d).filter((l) => !p.html.includes(`href="${l.href}"`));
  if (links.length) p.related = links; else delete p.related;
}

// ---------------------------------------------------------------------------
// 2. Everything else: keep the app's HTML, fix plan names and prices
// ---------------------------------------------------------------------------
let priceEdits = 0;
const fixItem = (p) => {
  for (const f of ['html', 'title', 'description']) {
    const next = fixPricing(p[f] || '');
    if (next !== p[f]) { p[f] = next; priceEdits++; }
  }
};
for (const list of Object.values(pages)) list.forEach(fixItem);
posts.forEach(fixItem);

// ---------------------------------------------------------------------------
// 3. Redirects the app is missing
// ---------------------------------------------------------------------------
let redirectsAdded = 0;
for (const from of Object.keys(rebuildRedirects)) {
  const key = strip(from);
  if (!key || lookupRedirect(key) || appPath.has(key) || postSlugs.has(key) || NATIVE.has(key)) continue;
  const to = resolvePath(rebuildRedirects[from]);
  if (!to || to === `/${key}`) continue;
  redirects[`/${key}`] = to;
  redirects[`/${key}/`] = to;
  redirectsAdded++;
}
// New pages at old WordPress paths with a trailing slash still resolve via Next's trailing-slash handling.

// ---------------------------------------------------------------------------
// 4. Author facts for the author box and Person schema
// ---------------------------------------------------------------------------
const f = site.founder || {};
const author = {
  name: f.name,
  jobTitle: f.jobTitle,
  url: resolvePath(f.url || '/about-david-moore/') || '/about-david-moore',
  bio: f.bio,
  credentials: f.credentials || [],
  knowsAbout: f.knowsAbout || [],
  sameAs: f.sameAs || [],
  alumniOf: f.alumniOf || null,
  editorialPolicyUrl: resolvePath(site.editorialPolicyUrl || '/editorial-policy/') || '/editorial-policy',
};

// ---------------------------------------------------------------------------
// Leftover check + write
// ---------------------------------------------------------------------------
const leftovers = [];
for (const [sec, list] of Object.entries(pages)) {
  for (const p of list) if (LEFTOVER.test(p.html + p.title + p.description)) leftovers.push(`${sec}/${p.slug}`);
}
for (const p of posts) if (LEFTOVER.test(p.html + p.title + p.description)) leftovers.push(`blog/${p.slug}`);

const out = {
  'pages.json': JSON.stringify(pages, null, 2) + '\n',
  'posts.json': JSON.stringify(posts, null, 2) + '\n',
  'redirects.json': JSON.stringify(redirects, null, 2) + '\n',
  'author.json': JSON.stringify(author, null, 2) + '\n',
};
let stale = false;
for (const [name, body] of Object.entries(out)) {
  const file = path.join(APP, name);
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (cur !== body) { stale = true; if (!CHECK) fs.writeFileSync(file, body); }
}

console.log(JSON.stringify({
  pagesReplaced: replaced.length,
  pagesAdded: added,
  priceEdits,
  redirectsAdded,
  leftoverOldPricing: leftovers,
  wrote: CHECK ? false : stale,
}, null, 2));
if (CHECK && stale) process.exit(1);
