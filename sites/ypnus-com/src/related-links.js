'use strict';
/** "Keep exploring" internal links for a page, driven by data/internal-links.json. */
const fs = require('fs');
const path = require('path');

let cfg = { max: 7, groups: [] };
try { cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'internal-links.json'), 'utf8')); } catch { /* optional */ }

const label = (d) => String(d.navTitle || d.title || d.permalink).replace(/\s*\|\s*YPN USA\s*$/i, '').trim();

function relatedLinks(doc, content) {
  if (doc.type === 'post' || doc.relatedLinks === false) return [];
  const g = cfg.groups.find((x) => x.exact === doc.permalink)
    || cfg.groups.find((x) => x.prefix && doc.permalink.startsWith(x.prefix) && doc.permalink !== x.prefix);
  if (!g) return [];
  const out = [];
  if (g.siblings && g.prefix) {
    const sib = content.pages.filter((d) => d.permalink.startsWith(g.prefix) && d.permalink !== g.prefix && !d.noindex)
      .sort((a, b) => a.permalink.localeCompare(b.permalink));
    const i = sib.findIndex((d) => d.permalink === doc.permalink);
    for (let n = 1; n <= sib.length && out.length < g.siblings; n++) {
      const d = sib[(i + n) % sib.length];
      if (d.permalink !== doc.permalink) out.push({ url: d.permalink, label: label(d) });
    }
  }
  out.push(...(g.links || []));
  const exists = (u) => /\.html$/.test(u) || content.byPath.has(u);
  const seen = new Set();
  return out.filter((l) => {
    if (l.url === doc.permalink || seen.has(l.url) || !exists(l.url)) return false;
    if (doc.body.includes(`href="${l.url}"`)) return false;
    seen.add(l.url);
    return true;
  }).slice(0, cfg.max || 7);
}

module.exports = { relatedLinks };
