#!/usr/bin/env node
/**
 * Rebuilds the comparison pages (content/pages/vs/*.html, content/pages/ypnus-vs-*.html)
 * from data/comparisons.json. Keeps each page's id, permalink, dates and images; replaces
 * title, SEO fields, FAQ and body.
 *   npm run build:comparisons            write files
 *   npm run build:comparisons -- --dry   print what would change
 * Competitor facts live only in data/comparisons.json, each with its source URL and check date.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'comparisons.json'), 'utf8'));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const DRY = process.argv.includes('--dry');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');
const checkedHuman = new Date(`${data.checked}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

// Comparison groups decide which sibling comparisons each page links to.
const GROUPS = {
  crm: { members: ['bonzo', 'bntouch', 'loanofficer-ai', 'total-expert', 'velocify'], feature: { url: '/features/ai-lead-follow-up/', label: 'AI lead follow-up in YPN USA' } },
  source: { members: ['lendingtree', 'zillow-flex', 'real-geeks'], feature: { url: '/features/hyper-local-seo-pages/', label: 'Hyper-local SEO pages for loan officers' } },
  retention: { members: ['homebot', 'mortgage-coach'], feature: { url: '/features/realtor-partnership-tools/', label: 'Realtor partnership tools' } },
};
const groupOf = (key) => Object.values(GROUPS).find((g) => g.members.includes(key));
const permalinkOf = (c) => {
  const fm = readFrontMatter(path.join(ROOT, 'content', 'pages', c.file));
  return JSON.parse(fm.fields.permalink);
};

function readFrontMatter(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error(`No front matter in ${file}`);
  const order = []; const fields = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    const k = line.slice(0, i).trim(); const v = line.slice(i + 1).trim();
    order.push(k); fields[k] = v;
  }
  return { order, fields, body: raw.slice(m[0].length) };
}

function writeFrontMatter(fm) {
  return `---\n${fm.order.map((k) => `${k}: ${fm.fields[k]}`).join('\n')}\n---\n`;
}

function set(fm, key, value) {
  if (!fm.order.includes(key)) fm.order.push(key);
  fm.fields[key] = JSON.stringify(value);
}

function list(items) { return `<ul>\n${items.map((x) => `<li>${esc(x)}</li>`).join('\n')}\n</ul>`; }

function render(c, all) {
  const y = data.ypn;
  const g = groupOf(c.key);
  const siblings = [...g.members.filter((k) => k !== c.key), ...all.map((x) => x.key).filter((k) => !g.members.includes(k))]
    .slice(0, 3).map((k) => all.find((x) => x.key === k));
  const stage = (k, arr) => (arr.includes(k) ? 'Yes' : 'No');

  return `<p class="ypx-lead">${esc(c.name)} and YPN USA both serve mortgage professionals, but they do different jobs. This page compares them on features, published pricing and where each fits in a loan officer&rsquo;s workflow, using each company&rsquo;s own public information.</p>
<p class="ypx-meta">Reviewed ${esc(checkedHuman)} by <a href="${attr(site.founder.url)}">${esc(site.founder.name)}</a>, NMLS #${esc(site.licenses.nmls)}. ${esc(c.name)} facts come from ${esc(c.name)}&rsquo;s own website (sources below). YPN Inc. publishes this page and sells YPN USA. <a href="/research-methodology/">How we compare tools</a>.</p>

<h2>Quick answer</h2>
<p>${esc(c.verdict)}</p>

<h2>At a glance</h2>
<table>
<thead><tr><th scope="col"></th><th scope="col">YPN USA</th><th scope="col">${esc(c.name)}</th></tr></thead>
<tbody>
<tr><th scope="row">Category</th><td>Local growth platform for loan officers</td><td>${esc(c.category)}</td></tr>
<tr><th scope="row">Best for</th><td>${esc(c.fitsYpn)}</td><td>${esc(c.fitsThem)}</td></tr>
<tr><th scope="row">Published pricing</th><td>${esc(y.pricing)}</td><td>${esc(c.pricing)}</td></tr>
</tbody>
</table>

<h2>What is ${esc(c.name)}?</h2>
<p>${esc(c.whatItIs)}</p>

<h2>What is YPN USA?</h2>
<p>YPN USA is a mortgage growth platform for licensed loan officers. It combines <a href="/platform/ai-tools/">Cerebro, an AI growth assistant</a>; <a href="/features/hyper-local-seo-pages/">local pages</a>, borrower funnels and Google Business Profile support under your own brand; automated follow-up; <a href="/realtor-co-marketing/">Realtor co-marketing tools</a>; and a ZIP that is not assigned to another loan officer on the platform while your paid plan is active.</p>
<p>${esc(y.isNot)}</p>

<h2>Feature comparison</h2>
<table>
<thead><tr><th scope="col">Feature</th><th scope="col">YPN USA</th><th scope="col">${esc(c.name)}</th></tr></thead>
<tbody>
${c.features.map((f) => `<tr><th scope="row">${esc(f.label)}</th><td>${esc(f.ypn)}</td><td>${esc(f.them)}</td></tr>`).join('\n')}
</tbody>
</table>

<h2>Pricing compared</h2>
<p><strong>${esc(c.name)}:</strong> ${esc(c.pricing)} Source: <a href="${attr(c.pricingSource)}" rel="nofollow noopener" target="_blank">${esc(c.name)} pricing information</a>, checked ${esc(checkedHuman)}.</p>
<p><strong>YPN USA:</strong> ${esc(y.pricing)} See <a href="/pricing.html">YPN USA pricing</a>.</p>
<p>Prices change. Confirm current pricing on each company&rsquo;s site before you buy.</p>

<h2>Pros and cons</h2>
<h3>${esc(c.name)}</h3>
<p><strong>Pros</strong></p>
${list(c.prosThem)}
<p><strong>Cons</strong></p>
${list(c.consThem)}
<h3>YPN USA</h3>
<p><strong>Pros</strong></p>
${list(c.prosYpn)}
<p><strong>Cons</strong></p>
${list(c.consYpn)}

<h2>Where each fits in a mortgage workflow</h2>
<table>
<thead><tr><th scope="col">Stage</th><th scope="col">YPN USA</th><th scope="col">${esc(c.name)}</th></tr></thead>
<tbody>
${data.workflowStages.map((s) => `<tr><th scope="row">${esc(s.name)}<br><span class="ypx-meta">${esc(s.desc)}</span></th><td>${stage(s.key, c.workflow.ypn)}</td><td>${stage(s.key, c.workflow.them)}</td></tr>`).join('\n')}
</tbody>
</table>
<p>${esc(c.workflowNote)}</p>

<h2>Who should choose which</h2>
<ul>
<li><strong>Choose ${esc(c.name)} if:</strong> ${esc(c.fitsThem)}</li>
<li><strong>Choose YPN USA if:</strong> ${esc(c.fitsYpn)}</li>
</ul>

<h2>Verdict</h2>
<p>${esc(c.verdict)}</p>
<p><a class="ypx-btn" href="/check-zip.html">Check your ZIP</a> <a class="ypx-btn ypx-btn-ghost" href="/pricing.html">See YPN USA pricing</a></p>

<h2>Frequently asked questions</h2>
${c.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n')}

<h2>Sources</h2>
<ul>
${c.sources.map((s) => `<li><a href="${attr(s.url)}" rel="nofollow noopener" target="_blank">${esc(s.label)}</a>, checked ${esc(checkedHuman)}</li>`).join('\n')}
<li><a href="/pricing.html">YPN USA pricing</a> and <a href="/about/">About YPN USA</a></li>
</ul>
<p class="ypx-meta">${esc(c.name)} is a trademark of its owner, used here only to identify the product. We are not affiliated with ${esc(c.name)}. Competitor information comes from its public website as of ${esc(checkedHuman)} and may have changed. Spotted an error? Email <a href="mailto:${attr(site.email)}">${esc(site.email)}</a> and we will correct it. Read our <a href="/editorial-policy/">editorial policy</a>.</p>

<nav class="ypx-related-links" aria-label="More comparisons">
<h2>More comparisons</h2>
<ul>
${siblings.map((s) => `<li><a href="${attr(permalinkOf(s))}">YPN USA vs ${esc(s.name)}</a></li>`).join('\n')}
<li><a href="${attr(g.feature.url)}">${esc(g.feature.label)}</a></li>
<li><a href="/compare/">All YPN USA comparisons</a></li>
<li><a href="/loan-types/">Mortgage leads by loan type</a></li>
</ul>
</nav>
`;
}

let changed = 0;
for (const c of data.competitors) {
  const file = path.join(ROOT, 'content', 'pages', c.file);
  const fm = readFrontMatter(file);
  set(fm, 'title', c.title);
  set(fm, 'seoTitle', c.seoTitle);
  set(fm, 'description', c.description);
  set(fm, 'focusKeyword', `YPN USA vs ${c.name}`);
  set(fm, 'modified', `${data.checked}T12:00:00Z`);
  set(fm, 'hideTitle', false);
  set(fm, 'faq', c.faq);
  set(fm, 'contentSchemaTypes', []);
  set(fm, 'schemaType', 'Article');
  set(fm, 'authorBox', true);
  set(fm, 'reviewedDate', data.checked);
  const out = writeFrontMatter(fm) + render(c, data.competitors);
  if (DRY) { console.log(`${c.file}: ${out.length} bytes`); continue; }
  fs.writeFileSync(file, out);
  changed++;
}
console.log(DRY ? 'Dry run, nothing written.' : `Rebuilt ${changed} comparison pages from data/comparisons.json.`);
