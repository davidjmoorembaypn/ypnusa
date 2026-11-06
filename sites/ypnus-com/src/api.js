'use strict';
/**
 * Replacements for the WordPress REST endpoints the migrated pages call:
 *   GET  /wp-json/ypnus/v1/zip-check/:zip        (also /api/zip-check/:zip)
 *   POST /wp-json/ypnusa-homepage/v1/lead        (also /api/lead)
 *
 * ZIP checks: if ZIP_CHECK_UPSTREAM is set, the request is proxied there
 * (e.g. https://app.ypnus.com/api/zip-check/). Otherwise data/zip-ledger.json is used.
 *
 * Leads: appended to data/leads/leads.jsonl (outside the public folder) and, if
 * LEAD_WEBHOOK_URL is set, POSTed there as JSON (Zapier, Make, app.ypnus.com, a CRM...).
 */
const fs = require('fs');
const path = require('path');
const express = require('express');

const DATA = path.resolve(__dirname, '..', 'data');
const LEAD_DIR = process.env.LEAD_DIR || path.join(DATA, 'leads');
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const k = req.ip || 'unknown';
    const n = (hits.get(k) || 0) + 1;
    hits.set(k, n);
    if (n > max) return res.status(429).json({ success: false, message: 'Too many requests. Please try again in a few minutes.' });
    return next();
  };
}

function ledger() {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, 'zip-ledger.json'), 'utf8')); } catch { return { claimed: {} }; }
}

const clean = (v, n = 200) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

function router() {
  const r = express.Router();
  const json = express.json({ limit: '16kb' });
  const form = express.urlencoded({ extended: false, limit: '16kb' });

  async function zipCheck(req, res) {
    const zip = String(req.params.zip || req.query.zip || '').trim();
    res.set('Cache-Control', 'no-store');
    if (!/^\d{5}$/.test(zip)) return res.status(400).json({ success: false, available: false, message: 'Enter a 5-digit ZIP code.' });
    const upstream = process.env.ZIP_CHECK_UPSTREAM;
    if (upstream) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const up = await fetch(`${upstream.replace(/\/$/, '')}/${zip}`, { signal: ctrl.signal, headers: { accept: 'application/json' } });
        clearTimeout(t);
        const data = await up.json();
        return res.status(up.ok ? 200 : 502).json(data);
      } catch (e) {
        console.error('[zip-check] upstream failed:', e.message);
        return res.status(502).json({ success: false, available: false, message: "Couldn't reach the territory checker. Please try again." });
      }
    }
    const held = ledger().claimed || {};
    return res.json({ success: true, zip, available: !held[zip] });
  }

  r.get(['/wp-json/ypnus/v1/zip-check/:zip', '/wp-json/ypnus/v1/zip-check/', '/api/zip-check/:zip', '/api/zip-check'], rateLimiter({ windowMs: 60000, max: 30 }), zipCheck);

  async function lead(req, res) {
    const b = req.body || {};
    res.set('Cache-Control', 'no-store');
    if (clean(b.website)) return res.json({ success: true, message: 'Thanks! Check your inbox.' }); // honeypot
    const rec = {
      receivedAt: new Date().toISOString(),
      name: clean(b.name, 120), email: clean(b.email, 254).toLowerCase(), phone: clean(b.phone, 40),
      zip: clean(b.zip, 5), plan: clean(b.plan, 40), role: clean(b.role, 60), message: clean(b.message, 2000),
      source: clean(b.source || req.get('referer') || '', 300),
      consent: ['1', 'true', 'on', 'yes', true].includes(b.consent), smsConsent: ['1', 'true', 'on', 'yes', true].includes(b.sms_consent),
      utm: Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].filter((k) => b[k]).map((k) => [k, clean(b[k], 120)])),
      ip: req.ip, userAgent: clean(req.get('user-agent'), 300),
    };
    if (!rec.name || !EMAIL_RE.test(rec.email)) return res.status(400).json({ success: false, message: 'Enter your first name and a valid email.' });
    if (!rec.consent) return res.status(400).json({ success: false, message: 'Please confirm email permission.' });
    if (rec.zip && !/^\d{5}$/.test(rec.zip)) return res.status(400).json({ success: false, message: 'Enter a complete 5-digit ZIP or leave it blank.' });
    try {
      fs.mkdirSync(LEAD_DIR, { recursive: true });
      fs.appendFileSync(path.join(LEAD_DIR, 'leads.jsonl'), `${JSON.stringify(rec)}\n`, { mode: 0o600 });
    } catch (e) {
      console.error('[lead] could not store lead:', e.message);
      return res.status(500).json({ success: false, message: 'Please try again in a moment.' });
    }
    if (process.env.LEAD_WEBHOOK_URL) {
      fetch(process.env.LEAD_WEBHOOK_URL, {
        method: 'POST', headers: { 'content-type': 'application/json', ...(process.env.LEAD_WEBHOOK_SECRET ? { 'x-ypnus-secret': process.env.LEAD_WEBHOOK_SECRET } : {}) },
        body: JSON.stringify(rec),
      }).catch((e) => console.error('[lead] webhook failed:', e.message));
    }
    const wantsHtml = req.is('application/x-www-form-urlencoded') && !req.xhr && (req.get('accept') || '').includes('text/html');
    if (wantsHtml) return res.redirect(303, '/thank-you/');
    return res.json({ success: true, message: rec.zip ? `Thanks, ${rec.name}. Your ZIP ${rec.zip} plan is on the way. Check your inbox.` : `Thanks, ${rec.name}. Check your inbox.` });
  }

  r.post(['/wp-json/ypnusa-homepage/v1/lead', '/api/lead'], rateLimiter({ windowMs: 10 * 60000, max: 10 }), json, form, lead);
  r.get('/healthz', (req, res) => res.set('Cache-Control', 'no-store').json({ ok: true }));
  return r;
}

module.exports = { router };
