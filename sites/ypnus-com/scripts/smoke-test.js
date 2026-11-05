#!/usr/bin/env node
/**
 * Boots the app on a random port and checks:
 *  - every sitemap URL returns 200 with exactly one <title>, a canonical and valid JSON-LD
 *  - every redirect returns 301 to a live URL
 *  - internal links in rendered pages point at a live route, a redirect or a static file
 *  - the ZIP-check and lead APIs respond
 * Usage: npm run check   (exit code 1 on hard failures)
 */
'use strict';
process.env.LEAD_DIR = require('path').join(require('os').tmpdir(), `ypnus-smoke-${process.pid}`);
const fs = require('fs');
const path = require('path');
const { app } = require('../server');

const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const fail = []; const warn = []; const broken = new Map();
  const get = (u, opt = {}) => fetch(base + u, { redirect: 'manual', ...opt });

  const idx = await (await get('/sitemap_index.xml')).text();
  const maps = [...idx.matchAll(/<loc>[^<]*?(\/[a-z_]+-sitemap\.xml)<\/loc>/g)].map((m) => m[1]);
  const urls = [];
  for (const m of maps) for (const x of (await (await get(m)).text()).matchAll(/<url><loc>https?:\/\/[^/]+([^<]*)<\/loc>/g)) urls.push(x[1]);

  const live = new Set(urls);
  const redirects = { ...JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'redirects.json'), 'utf8')), ...JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'redirects-extra.json'), 'utf8')) };
  const linkTargets = new Map();
  let h1Issues = 0; let titleLong = 0; let descMissing = 0;

  for (const u of urls) {
    const r = await get(u);
    if (r.status !== 200) { fail.push(`${u} -> ${r.status}`); continue; }
    const html = await r.text();
    const titles = html.match(/<title>([\s\S]*?)<\/title>/g) || [];
    if (titles.length !== 1) fail.push(`${u}: ${titles.length} <title> tags`);
    if (!/<link rel="canonical" href="https:\/\/ypnus\.com/.test(html)) fail.push(`${u}: canonical missing`);
    const t = (titles[0] || '').replace(/<\/?title>/g, '');
    if (t.length > 65) titleLong++;
    if (!/<meta name="description" content="[^"]{30,}/.test(html)) descMissing++;
    const h1 = (html.match(/<h1\b/g) || []).length;
    if (h1 !== 1) { h1Issues++; warn.push(`${u}: ${h1} <h1> elements`); }
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(m[1].replace(/\\u003c/g, '<')); } catch (e) { warn.push(`${u}: invalid JSON-LD (${e.message.slice(0, 60)})`); }
    }
    for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
      const p = m[1];
      if (!linkTargets.has(p)) linkTargets.set(p, new Set());
      linkTargets.get(p).add(u);
    }
  }

  for (const [from, to] of Object.entries(redirects)) {
    const r = await get(from);
    if (r.status !== 301) fail.push(`redirect ${from} -> status ${r.status}`);
    const loc = (r.headers.get('location') || '').replace(base, '');
    if (!to.startsWith('/wp-content/') && !live.has(loc.split('?')[0]) && !/^https?:/.test(loc)) warn.push(`redirect ${from} -> ${loc} (target not in sitemap)`);
  }

  for (const [p, pages] of linkTargets) {
    if (live.has(p) || redirects[p] || p.startsWith('/wp-content/') || p.startsWith('/assets/') || p === '/') continue;
    const r = await get(p);
    if (r.status === 404) broken.set(p, [...pages]);
  }

  const z = await (await get('/wp-json/ypnus/v1/zip-check/93291')).json();
  if (!z.success) fail.push('zip-check API failed');
  const lr = await get('/wp-json/ypnusa-homepage/v1/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Smoke', email: 'smoke@example.com', consent: '1', zip: '93291' }) });
  if (lr.status !== 200) fail.push(`lead API -> ${lr.status}`);
  fs.rmSync(process.env.LEAD_DIR, { recursive: true, force: true });

  const summary = {
    urlsChecked: urls.length, redirectsChecked: Object.keys(redirects).length,
    hardFailures: fail.length, pagesWithoutExactlyOneH1: h1Issues, titlesOver65Chars: titleLong, weakOrMissingDescriptions: descMissing,
    brokenInternalLinkTargets: broken.size,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (fail.length) console.log(`\nFAILURES:\n  ${fail.join('\n  ')}`);
  if (warn.length) console.log(`\nWARNINGS (${warn.length}):\n  ${warn.slice(0, 40).join('\n  ')}${warn.length > 40 ? '\n  …' : ''}`);
  if (broken.size) {
    console.log('\nBROKEN INTERNAL LINKS (target -> linked from):');
    for (const [p, pages] of [...broken].sort((a, b) => b[1].length - a[1].length)) console.log(`  ${p}  <- ${pages.length} page(s), e.g. ${pages.slice(0, 2).join(', ')}`);
  }
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'smoke-report.json'), `${JSON.stringify({ summary, fail, warn, broken: Object.fromEntries(broken) }, null, 2)}\n`);
  server.close();
  process.exit(fail.length ? 1 : 0);
});
