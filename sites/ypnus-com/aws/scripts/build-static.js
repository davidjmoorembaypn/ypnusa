#!/usr/bin/env node
/**
 * Pre-renders the whole ypnus.com Express app into plain files for S3 + CloudFront.
 *
 *   node aws/scripts/build-static.js            -> aws/dist/site/   (HTML, XML, assets)
 *                                                  aws/dist/kvs.json (redirects for the edge KeyValueStore)
 *
 * Nothing in server.js changes: the app is booted in-process and every route is requested
 * exactly as a browser would. Output paths:
 *   /foo/          -> foo/index.html
 *   /pricing.html  -> pricing.html
 *   /feed/         -> feed.xml          (the edge function maps /feed/, /rss/ ... to it)
 *   unknown URL    -> 404.html          (CloudFront serves it with status 404)
 * Redirects (WordPress IDs, old slugs, extras, legacy routes) are written to kvs.json as
 *   "r:/old-path/" -> "301 /new-path/"   and   "p:123" -> "301 /permalink/"
 */
'use strict';
process.env.NODE_ENV = 'production';
delete process.env.NOINDEX;

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.env.OUT_DIR || path.join(ROOT, 'aws', 'dist'));
const SITE_OUT = path.join(OUT, 'site');
process.env.LEAD_DIR = path.join(require('os').tmpdir(), `ypnus-build-${process.pid}`);

const { app } = require(path.join(ROOT, 'server.js'));
const { load, readJson } = require(path.join(ROOT, 'src', 'content.js'));

const PER_PAGE = 24; // must match server.js
const site = readJson('site.json', {});
const APP_URL = (site.appUrl || 'https://app.ypnus.com').replace(/\/$/, '');

function outFile(urlPath) {
  if (urlPath === '/') return 'index.html';
  const clean = decodeURIComponent(urlPath).replace(/^\/+/, '');
  if (urlPath.endsWith('/')) return `${clean}index.html`;
  return clean;
}

function copyDir(src, dst, skip = () => false) {
  if (!fs.existsSync(src)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name); const d = path.join(dst, e.name);
    if (skip(s)) continue;
    if (e.isDirectory()) n += copyDir(s, d, skip);
    else { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d); n++; }
  }
  return n;
}

const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const problems = [];
  try {
    fs.rmSync(OUT, { recursive: true, force: true });
    fs.mkdirSync(SITE_OUT, { recursive: true });
    const content = load();

    /* ---------------- 1. every route the Express app serves */
    const urls = new Set(['/', '/pricing.html', '/check-zip.html', '/robots.txt', '/sitemap_index.xml']);
    for (const d of [...content.pages, ...content.posts]) urls.add(d.permalink);
    const pagesOf = (n) => Math.max(1, Math.ceil(n / PER_PAGE));
    urls.add('/blog/');
    for (let i = 2; i <= pagesOf(content.posts.length); i++) urls.add(`/blog/page/${i}/`);
    for (const [kind, map] of [['category', content.categories], ['tag', content.tags]]) {
      for (const t of map.values()) {
        if (!t.posts.length) continue;
        urls.add(`/${kind}/${t.slug}/`);
        for (let i = 2; i <= pagesOf(t.posts.length); i++) urls.add(`/${kind}/${t.slug}/page/${i}/`);
      }
    }

    /* sitemaps listed in the index */
    const idx = await (await fetch(`${base}/sitemap_index.xml`)).text();
    for (const m of idx.matchAll(/<loc>[^<]*?(\/[a-z_]+-sitemap\.xml)<\/loc>/g)) urls.add(m[1]);

    /* ---------------- 2. render, and follow internal links to catch anything missed */
    const queue = [...urls];
    const seen = new Set();
    let written = 0;
    const files = new Set();
    while (queue.length) {
      const u = queue.shift();
      if (seen.has(u)) continue;
      seen.add(u);
      const r = await fetch(base + u, { redirect: 'manual' });
      if (r.status >= 300 && r.status < 400) continue; // redirects are handled at the edge
      if (r.status !== 200) { if (urls.has(u)) problems.push(`${u} -> ${r.status}`); continue; }
      const type = r.headers.get('content-type') || '';
      const buf = Buffer.from(await r.arrayBuffer());
      const file = path.join(SITE_OUT, outFile(u));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf);
      written++;
      files.add(u);
      if (type.includes('text/html')) {
        for (const m of buf.toString('utf8').matchAll(/href="(\/[^"#?]*)"/g)) {
          const p = m[1];
          if (p.startsWith('/wp-content/') || p.startsWith('/assets/') || p.startsWith('/api/') || p.startsWith('/wp-json/')) continue;
          if (!seen.has(p) && (p.endsWith('/') || p.endsWith('.html'))) queue.push(p);
        }
      }
    }

    /* feed + 404 + staging robots */
    fs.writeFileSync(path.join(SITE_OUT, 'feed.xml'), Buffer.from(await (await fetch(`${base}/feed/`)).arrayBuffer()));
    const nf = await fetch(`${base}/__ypnus-build-404__/`);
    fs.writeFileSync(path.join(SITE_OUT, '404.html'), Buffer.from(await nf.arrayBuffer()));
    fs.writeFileSync(path.join(SITE_OUT, 'robots-staging.txt'), 'User-agent: *\nDisallow: /\n');

    /* ---------------- 3. static files from public/ (media goes to its own S3 prefix, not here) */
    const pub = path.join(ROOT, 'public');
    const copied = copyDir(pub, SITE_OUT, (p) => p.startsWith(path.join(pub, 'wp-content')));

    /* ---------------- 4. redirects for the edge KeyValueStore */
    const kvs = {};
    const put = (from, code, to) => {
      kvs[`r:${from}`] = `${code} ${to}`;
      const enc = encodeURI(decodeURI(from));
      if (enc !== from) kvs[`r:${enc}`] = `${code} ${to}`;
    };
    for (const [from, to] of Object.entries(content.redirects)) put(from, 301, to);
    for (const [id, to] of Object.entries(content.ids)) kvs[`p:${id}`] = `301 ${to}`;
    // Routes server.js answers itself with a redirect
    put('/pricing/', 301, '/pricing.html');
    put('/pricing-plans/', 301, '/pricing.html');
    put('/comments/feed/', 301, '/feed/');
    if (!fs.existsSync(path.join(pub, 'lo-signup.html'))) put('/lo-signup.html', 302, `${APP_URL}/signup`);
    if (!fs.existsSync(path.join(pub, 'onboarding.html'))) put('/onboarding.html', 302, '/onboarding/');
    if (!fs.existsSync(path.join(pub, 'favicon.ico'))) put('/favicon.ico', 302, '/favicon.svg');
    put('/blog/page/1/', 301, '/blog/');
    // Never let a redirect shadow a real page
    for (const u of files) delete kvs[`r:${u}`];

    const tooLong = Object.entries(kvs).filter(([k, v]) => Buffer.byteLength(k) > 512 || Buffer.byteLength(v) > 1024);
    for (const [k] of tooLong) { problems.push(`redirect key too long for KeyValueStore, skipped: ${k.slice(0, 80)}...`); delete kvs[k]; }
    fs.writeFileSync(path.join(OUT, 'kvs.json'), JSON.stringify(kvs, null, 1));

    const report = {
      builtAt: new Date().toISOString(), files: written, publicFilesCopied: copied,
      redirects: Object.keys(kvs).filter((k) => k.startsWith('r:')).length,
      wordpressIds: Object.keys(kvs).filter((k) => k.startsWith('p:')).length,
      kvsBytes: Buffer.byteLength(JSON.stringify(kvs)), problems,
    };
    fs.writeFileSync(path.join(OUT, 'build-report.json'), JSON.stringify(report, null, 2));
    console.log(`[build] ${written} pages/files rendered, ${copied} public files, ${report.redirects} redirects, ${report.wordpressIds} WordPress IDs -> ${path.relative(process.cwd(), OUT) || OUT}`);
    if (problems.length) console.warn(`[build] ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    server.close();
    process.exit(problems.some((p) => / -> 5\d\d$/.test(p)) ? 1 : 0);
  } catch (e) {
    console.error('[build] failed:', e);
    server.close();
    process.exit(1);
  }
});
