'use strict';
/**
 * Loads every page/post from content/ into memory at startup.
 * Files are HTML (or Markdown) bodies with JSON-valued YAML front matter.
 * To add a page: drop content/pages/my-page.html (or .md) with at least
 *   ---
 *   title: "My Page"
 *   permalink: "/my-page/"
 *   description: "Meta description"
 *   ---
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const DATA = path.join(ROOT, 'data');

const readJson = (name, fallback) => {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8')); } catch { return fallback; }
};

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.(html|md)$/i.test(e.name) ? [full] : [];
  });
}

function stripTags(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function load() {
  const byPath = new Map();
  const byId = new Map();
  const posts = [];
  const pages = [];
  const errors = [];

  for (const kind of ['pages', 'posts']) {
    for (const file of walk(path.join(CONTENT, kind))) {
      let parsed;
      try { parsed = matter(fs.readFileSync(file, 'utf8')); } catch (e) { errors.push(`${file}: ${e.message}`); continue; }
      const d = parsed.data || {};
      const rel = path.relative(path.join(CONTENT, kind), file).replace(/\\/g, '/').replace(/\.(html|md)$/i, '');
      let permalink = d.permalink;
      if (!permalink) permalink = kind === 'posts' ? `/${path.basename(rel)}/` : (rel === 'index' ? '/' : `/${rel}/`);
      if (!permalink.startsWith('/')) permalink = `/${permalink}`;
      if (!permalink.endsWith('/')) permalink += '/';
      if (d.status && d.status !== 'publish') continue;
      const body = /\.md$/i.test(file) ? marked.parse(parsed.content) : parsed.content;
      const doc = {
        ...d,
        type: d.type || (kind === 'posts' ? 'post' : 'page'),
        permalink,
        body,
        file: path.relative(ROOT, file),
        date: d.date ? new Date(d.date) : null,
        modified: d.modified ? new Date(d.modified) : (d.date ? new Date(d.date) : null),
        categories: d.categories || [],
        tags: d.tags || [],
        faq: d.faq || [],
        contentSchemaTypes: d.contentSchemaTypes || [],
        noindex: /noindex/i.test(d.robots || ''),
      };
      doc.plainText = stripTags(body);
      if (byPath.has(permalink)) { errors.push(`Duplicate permalink ${permalink}: ${doc.file} and ${byPath.get(permalink).file}`); continue; }
      byPath.set(permalink, doc);
      if (d.id) byId.set(String(d.id), doc);
      (doc.type === 'post' ? posts : pages).push(doc);
    }
  }
  posts.sort((a, b) => (b.date || 0) - (a.date || 0));

  // Related posts: shared categories/tags, newest first
  for (const p of posts) {
    const keys = new Set([...p.categories.map((c) => `c:${c}`), ...p.tags.map((t) => `t:${t}`)]);
    p.related = posts.filter((o) => o !== p)
      .map((o) => ({ o, score: [...o.categories.map((c) => `c:${c}`), ...o.tags.map((t) => `t:${t}`)].filter((k) => keys.has(k)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (b.o.date || 0) - (a.o.date || 0))
      .slice(0, 3).map((x) => x.o);
  }

  const tax = readJson('taxonomies.json', { categories: [], tags: [] });
  const categories = new Map(tax.categories.map((c) => [c.slug, { ...c, posts: [] }]));
  const tags = new Map(tax.tags.map((t) => [t.slug, { ...t, posts: [] }]));
  for (const p of posts) {
    for (const c of p.categories) { if (!categories.has(c)) categories.set(c, { slug: c, name: c, posts: [] }); categories.get(c).posts.push(p); }
    for (const t of p.tags) { if (!tags.has(t)) tags.set(t, { slug: t, name: t, posts: [] }); tags.get(t).posts.push(p); }
  }

  const redirects = { ...readJson('redirects.json', {}), ...readJson('redirects-extra.json', {}) };
  for (const p of byPath.keys()) delete redirects[p];

  return { byPath, byId, posts, pages, categories, tags, redirects, ids: readJson('ids.json', {}), errors };
}

module.exports = { load, stripTags, readJson };
