'use strict';
/**
 * ypnus.com — Node.js/Express marketing site (migrated from WordPress).
 * Start: npm start   (listens on process.env.PORT, default 3000)
 */
const path = require('path');
const fs = require('fs');

// Optional .env (kept OUTSIDE the web root on Hostinger; see README)
const envFile = process.env.ENV_FILE || path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const ejs = require('ejs');
const { load, readJson } = require('./src/content');
const { buildHead, abs } = require('./src/seo');
const { relatedLinks } = require('./src/related-links');
const api = require('./src/api');

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const site = readJson('site.json', {});
if (process.env.SITE_URL) site.url = process.env.SITE_URL.replace(/\/$/, '');
const PER_PAGE = 24;
const ASSET_VERSION = String(Math.floor(Date.now() / 1000));

let content = load();
if (content.errors.length) console.warn(`[content] ${content.errors.length} problem(s):\n  ${content.errors.join('\n  ')}`);
console.log(`[content] ${content.pages.length} pages, ${content.posts.length} posts, ${Object.keys(content.redirects).length} redirects`);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({
  contentSecurityPolicy: false, // migrated pages carry inline scripts/styles; add a CSP once those are moved to files
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true, preload: false } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(compression());
// Staging: NOINDEX=1 keeps a preview subdomain out of search results
if (process.env.NOINDEX === '1') app.use((req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow'); next(); });

/* ----------------------------------------------------------- render cache */
const cache = new Map();
const htmlCache = (res, maxAge = 300) => res.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=86400`);

function renderView(view, locals) {
  return new Promise((resolve, reject) => {
    app.render(view, { site, assetVersion: ASSET_VERSION, ...locals }, (err, html) => (err ? reject(err) : resolve(html)));
  });
}

async function sendCached(req, res, key, build, status = 200) {
  let html = IS_PROD ? cache.get(key) : undefined;
  if (!html) { html = await build(); if (IS_PROD) cache.set(key, html); }
  htmlCache(res);
  res.status(status).type('html').send(html);
}

/* ----------------------------------------------------------- markers */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function expandMarkers(doc) {
  let body = doc.body;
  const jobs = [];
  body = body.replace(/<!--ypx:([a-z-]+)([^>]*)-->/g, (m, name, attrs) => {
    const token = `@@YPX${jobs.length}@@`;
    const opts = Object.fromEntries([...attrs.matchAll(/([a-z]+)=([^\s]+)/g)].map((x) => [x[1], x[2]]));
    const related = doc.related && doc.related.length ? doc.related : content.posts.slice(0, 3);
    const views = {
      'related-posts': ['partials/related', { posts: related }],
      'local-business': ['partials/local-business', {}],
      'author-bio': ['partials/author-bio', {}],
      cerebro: ['partials/cerebro', {}],
      'lead-form': ['partials/lead-form', { source: opts.source || doc.permalink, withZip: !!opts.zip, withPhone: !!opts.phone, formId: `lf${jobs.length}` }],
    };
    if (!views[name]) return '';
    jobs.push(renderView(...views[name]));
    return token;
  });
  const parts = await Promise.all(jobs);
  return body.replace(/@@YPX(\d+)@@/g, (m, i) => parts[Number(i)]);
}

/* ----------------------------------------------------------- static */
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), { maxAge: '365d', immutable: true }));
app.use('/wp-content', express.static(path.join(__dirname, 'public', 'wp-content'), { maxAge: '30d', fallthrough: true }));
app.use('/wp-content', (req, res, next) => {
  // Media not copied yet? Fall back to MEDIA_FALLBACK_ORIGIN (e.g. the old server, S3 or CloudFront).
  const origin = process.env.MEDIA_FALLBACK_ORIGIN;
  if (origin) return res.redirect(302, `${origin.replace(/\/$/, '')}/wp-content${req.path}`);
  return next();
});
// Any other files dropped in public/ (favicon.ico, lo-signup.html, onboarding.html, Google verification files, ...)
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d', index: false, redirect: false }));

app.get('/favicon.ico', (req, res) => res.redirect(302, '/favicon.svg')); // replaced automatically if you copy favicon.ico into public/

/* ----------------------------------------------------------- API (replaces WordPress REST endpoints) */
app.use(api.router({ site }));

/* ----------------------------------------------------------- WordPress legacy URLs */
app.get(['/wp-login.php', '/wp-admin', '/wp-admin/*', '/login', '/login/'], (req, res) => res.redirect(301, `${site.appUrl}/login`));
app.all(['/xmlrpc.php', '/wp-cron.php', '/wp-json/wp/*', '/wp-includes/*'], (req, res) => res.status(410).type('text').send('Gone'));
app.get(['/sitemap_index.xml', '/sitemap.xml', '/wp-sitemap.xml'], (req, res) => sitemapIndex(res));
app.get(['/page-sitemap.xml', '/post-sitemap.xml', '/category-sitemap.xml', '/post_tag-sitemap.xml', '/profile-sitemap.xml'], (req, res) => sitemapFile(req.path.slice(1).replace('-sitemap.xml', ''), res));
app.get('/robots.txt', (req, res) => {
  if (process.env.NOINDEX === '1') return res.type('text').send('User-agent: *\nDisallow: /\n');
  return res.type('text').set('Cache-Control', 'public, max-age=3600').send([
    'User-agent: *',
    'Disallow: /api/',
    'Disallow: /wp-admin/',
    'Allow: /wp-admin/admin-ajax.php',
    'Disallow: /*?s=',
    '',
    `Sitemap: ${site.url}/sitemap_index.xml`,
    '',
  ].join('\n'));
});
app.get(['/feed', '/feed/', '/rss', '/rss/', '/feed/rss2/', '/blog/feed/'], (req, res) => rssFeed(res));
app.get('/comments/feed/', (req, res) => res.redirect(301, '/feed/'));

/* ----------------------------------------------------------- query-string IDs + redirects + slashes */
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const q = req.query;
  if (req.path === '/' && (q.p || q.page_id || q.attachment_id)) {
    const target = content.ids[String(q.p || q.page_id || q.attachment_id)];
    return target ? res.redirect(301, target) : next();
  }
  if (req.path === '/' && q.s !== undefined) return res.redirect(302, '/blog/');
  const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  const target = content.redirects[req.path] || content.redirects[`${req.path}/`] || content.redirects[decodeURIComponent(req.path)];
  if (target) return res.redirect(301, target + (target.includes('?') ? '' : qs));
  // WordPress uses trailing slashes; normalise /foo -> /foo/ for every HTML route
  if (!req.path.endsWith('/') && !path.extname(req.path)) return res.redirect(301, `${req.path}/${qs}`);
  // Collapse duplicate slashes and uppercase paths that map to a known page
  const lower = req.path.toLowerCase().replace(/\/{2,}/g, '/');
  if (lower !== req.path && content.byPath.has(lower)) return res.redirect(301, lower + qs);
  return next();
});

/* ----------------------------------------------------------- native pages */
app.get('/pricing.html', (req, res, next) => sendCached(req, res, 'pricing', () => renderVirtual('pricing', {
  permalink: '/pricing.html', title: 'Pricing for Mortgage Loan Officers',
  seoTitle: 'Pricing: Free, Pro $99, Growth $199, Exclusive $299 | YPN USA',
  description: 'YPN USA pricing for mortgage loan officers: Free $0, Pro $99/mo, Growth $199/mo and Exclusive $299/mo with ZIP code lockout exclusivity. 15-day trial on paid plans.',
}, { offers: offerCatalog() })).catch(next));
app.get(['/pricing/', '/pricing-plans/'], (req, res) => res.redirect(301, '/pricing.html'));

app.get('/check-zip.html', (req, res, next) => sendCached(req, res, 'check-zip', () => renderVirtual('check-zip', {
  permalink: '/check-zip.html', title: 'Check ZIP Territory Availability',
  seoTitle: 'Check ZIP Territory Availability for Loan Officers | YPN USA',
  description: 'Check whether your ZIP code is open on YPN USA. One loan officer per ZIP. Checking is free and does not reserve the ZIP.',
})).catch(next));

// Static HTML files that lived beside WordPress. Copy them into public/ to serve the originals; until then, send people somewhere useful.
app.get('/lo-signup.html', (req, res) => res.redirect(302, `${site.appUrl}/signup${req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''}`));
app.get('/onboarding.html', (req, res) => res.redirect(302, '/onboarding/'));

/* ----------------------------------------------------------- archives */
function paged(list, n) {
  const total = Math.max(1, Math.ceil(list.length / PER_PAGE));
  return { items: list.slice((n - 1) * PER_PAGE, n * PER_PAGE), page: n, total };
}

app.get(['/blog/page/:n/', '/blog/'], (req, res, next) => {
  const n = Number(req.params.n || 1);
  const pg = paged(content.posts, n);
  if (n < 1 || n > pg.total || (req.params.n === '1')) return req.params.n === '1' ? res.redirect(301, '/blog/') : next();
  const page = content.byPath.get('/blog/');
  return sendCached(req, res, `blog:${n}`, async () => renderVirtual('archive', {
    ...(n === 1 && page ? page : {}),
    permalink: n === 1 ? '/blog/' : `/blog/page/${n}/`, title: n === 1 ? (page && page.title) || 'Blog' : `Blog – Page ${n}`,
    seoTitle: n === 1 ? (page && page.seoTitle) : `Mortgage Marketing Blog for Loan Officers – Page ${n} | YPN USA`,
    description: (page && page.description) || 'Mortgage marketing, lead generation and local SEO guides for loan officers.',
    body: n === 1 && page ? await expandMarkers(page) : '',
  }, { pg, base: '/blog/', collection: true })).catch(next);
});

function taxRoute(kind) {
  const map = () => (kind === 'category' ? content.categories : content.tags);
  return (req, res, next) => {
    const term = map().get(req.params.slug);
    if (!term || !term.posts.length) return next();
    const n = Number(req.params.n || 1);
    const pg = paged(term.posts, n);
    if (n > pg.total) return next();
    const base = `/${kind}/${term.slug}/`;
    return sendCached(req, res, `${kind}:${term.slug}:${n}`, () => renderVirtual('archive', {
      permalink: n === 1 ? base : `${base}page/${n}/`, title: term.name,
      seoTitle: `${term.name}${n > 1 ? ` – Page ${n}` : ''} | Mortgage Marketing for Loan Officers | YPN USA`,
      description: term.description || `${term.name}: guides and strategies for mortgage loan officers from YPN USA.`,
      noindex: kind === 'tag' && term.posts.length < 2,
    }, { pg, base, collection: true, crumbs: [{ name: 'Home', url: '/' }, { name: 'Blog', url: '/blog/' }, { name: term.name, url: base }] })).catch(next);
  };
}
app.get(['/category/:slug/', '/category/:slug/page/:n/'], taxRoute('category'));
app.get(['/tag/:slug/', '/tag/:slug/page/:n/'], taxRoute('tag'));
app.get(['/author/:name/', '/author/:name/page/:n/'], (req, res) => res.redirect(301, site.founder.url));

/* ----------------------------------------------------------- pages + posts */
app.get('*', (req, res, next) => {
  const doc = content.byPath.get(req.path) || content.byPath.get(decodeURIComponent(req.path));
  if (!doc) return next();
  return sendCached(req, res, `doc:${doc.permalink}`, async () => {
    const body = await expandMarkers(doc);
    const cat = doc.categories[0] && content.categories.get(doc.categories[0]);
    const head = buildHead(site, doc, content, { categoryName: cat && cat.name });
    return renderView(doc.type === 'post' ? 'post' : 'page', { doc, body, head, cat, content, relatedLinks: relatedLinks(doc, content) });
  }).catch(next);
});

/* ----------------------------------------------------------- 404 / errors */
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(404).json({ success: false, message: 'Not found' });
  return sendCached(req, res, '404', () => renderVirtual('404', { permalink: req.path, title: 'Page not found', noindex: true, description: 'Page not found.' }), 404).catch(next);
});
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).type('text').send('Something went wrong. Please try again.');
});

/* ----------------------------------------------------------- helpers */
async function renderVirtual(view, docLike, extra = {}) {
  const doc = { type: 'page', categories: [], tags: [], faq: [], contentSchemaTypes: [], plainText: '', ...docLike };
  const head = buildHead(site, doc, content, extra);
  return renderView(view, { doc, head, content, ...extra });
}

function offerCatalog() {
  return {
    '@type': 'OfferCatalog', '@id': `${site.url}/pricing.html#offers`, name: 'YPN USA plans for mortgage loan officers',
    itemListElement: site.pricing.tiers.map((t) => ({
      '@type': 'Offer', name: t.name, price: String(t.price), priceCurrency: 'USD', description: t.summary,
      url: `${site.url}/pricing.html#${t.key}`,
      priceSpecification: t.price ? { '@type': 'UnitPriceSpecification', price: String(t.price), priceCurrency: 'USD', unitCode: 'MON', billingDuration: 'P1M' } : undefined,
      seller: { '@id': `${site.url}/#organization` },
    })),
  };
}

const xmlEsc = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const indexable = (d) => !d.noindex;

function sitemapEntries(kind) {
  const lastmod = (list) => list.reduce((m, d) => (d.modified && d.modified > m ? d.modified : m), new Date(0));
  if (kind === 'page') {
    const list = content.pages.filter((d) => indexable(d) && d.type !== 'profile');
    return [...list.map((d) => ({ loc: abs(site, d.permalink), lastmod: d.modified, image: d.featuredImage })),
      { loc: `${site.url}/pricing.html` }, { loc: `${site.url}/check-zip.html` }];
  }
  if (kind === 'profile') return content.pages.filter((d) => indexable(d) && d.type === 'profile').map((d) => ({ loc: abs(site, d.permalink), lastmod: d.modified }));
  if (kind === 'post') return content.posts.filter(indexable).map((d) => ({ loc: abs(site, d.permalink), lastmod: d.modified, image: d.featuredImage }));
  if (kind === 'category') return [...content.categories.values()].filter((c) => c.posts.length).map((c) => ({ loc: `${site.url}/category/${c.slug}/`, lastmod: lastmod(c.posts) }));
  if (kind === 'post_tag') return [...content.tags.values()].filter((t) => t.posts.length >= 2).map((t) => ({ loc: `${site.url}/tag/${t.slug}/`, lastmod: lastmod(t.posts) }));
  return [];
}

function sitemapFile(kind, res) {
  const entries = sitemapEntries(kind);
  if (!entries.length) return res.status(404).type('text').send('Not found');
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries.map((e) => `<url><loc>${xmlEsc(e.loc)}</loc>${e.lastmod && +e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>` : ''}${e.image ? `<image:image><image:loc>${xmlEsc(abs(site, e.image))}</image:loc></image:image>` : ''}</url>`),
    '</urlset>'].join('\n');
  return res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
}

function sitemapIndex(res) {
  const kinds = ['page', 'post', 'category', 'post_tag', 'profile'].filter((k) => sitemapEntries(k).length);
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...kinds.map((k) => `<sitemap><loc>${site.url}/${k}-sitemap.xml</loc><lastmod>${new Date().toISOString()}</lastmod></sitemap>`), '</sitemapindex>'].join('\n');
  return res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
}

function rssFeed(res) {
  const items = content.posts.filter(indexable).slice(0, 30);
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>',
    `<title>${xmlEsc(site.name)}</title><link>${site.url}/</link><description>${xmlEsc(site.tagline)}</description><language>en-US</language>`,
    `<atom:link href="${site.url}/feed/" rel="self" type="application/rss+xml"/>`,
    ...items.map((p) => `<item><title>${xmlEsc(p.title)}</title><link>${abs(site, p.permalink)}</link><guid isPermaLink="true">${abs(site, p.permalink)}</guid>${p.date ? `<pubDate>${p.date.toUTCString()}</pubDate>` : ''}<description>${xmlEsc(p.description || '')}</description></item>`),
    '</channel></rss>'].join('\n');
  res.type('application/rss+xml').set('Cache-Control', 'public, max-age=1800').send(xml);
}

/* ----------------------------------------------------------- reload + start */
process.on('SIGHUP', () => { content = load(); cache.clear(); console.log('[content] reloaded'); });

if (require.main === module) {
  app.listen(PORT, () => console.log(`[ypnus] listening on :${PORT} (${IS_PROD ? 'production' : 'development'})`));
}
module.exports = { app, esc };
