/**
 * ypnus.com dynamic endpoints (AWS Lambda, Node.js 22, behind CloudFront -> API Gateway HTTP API).
 * Replaces src/api.js from the Express app, with the same URLs and responses:
 *
 *   GET  /api/health
 *   GET  /api/zip-check/{zip}                  (also /api/zip-check?zip=, /wp-json/ypnus/v1/zip-check/{zip})
 *   POST /api/lead                             (also /wp-json/ypnusa-homepage/v1/lead)   JSON or form-encoded
 *   ANY  /wp-json/wp/*                         -> 410 Gone (old WordPress REST API)
 *
 * Leads  -> DynamoDB (LEADS_TABLE) + email to NOTIFY_EMAIL (SES) + optional webhook (LEAD_WEBHOOK_URL in the secret)
 * ZIPs   -> DynamoDB (ZIP_TABLE); a ZIP is taken when its item has status "claimed" or "reserved"
 * Uses only the AWS SDK that ships with the Lambda runtime: no npm install, no build step.
 */
import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESv2Client({});
const sm = new SecretsManagerClient({});

const { LEADS_TABLE, ZIP_TABLE, NOTIFY_EMAIL, FROM_EMAIL, SECRET_ARN, ORIGIN_VERIFY } = process.env;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const TAKEN = new Set(['claimed', 'reserved']);

let secretCache = { at: 0, value: {} };
async function secrets() {
  if (!SECRET_ARN) return {};
  if (Date.now() - secretCache.at < 300000) return secretCache.value;
  try {
    const r = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
    secretCache = { at: Date.now(), value: JSON.parse(r.SecretString || '{}') };
  } catch (e) { console.error(JSON.stringify({ msg: 'secret read failed', err: e.message })); }
  return secretCache.value;
}

const clean = (v, n = 200) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const yes = (v) => ['1', 'true', 'on', 'yes', true].includes(v);

function reply(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  if (raw.length > 16384) return null;
  const type = (event.headers?.['content-type'] || '').toLowerCase();
  if (type.includes('application/json')) { try { return JSON.parse(raw); } catch { return null; } }
  return Object.fromEntries(new URLSearchParams(raw));
}

async function zipCheck(zip) {
  if (!/^\d{5}$/.test(zip)) return reply(400, { success: false, available: false, message: 'Enter a 5-digit ZIP code.' });
  try {
    const r = await ddb.send(new GetCommand({ TableName: ZIP_TABLE, Key: { zip } }));
    return reply(200, { success: true, zip, available: !(r.Item && TAKEN.has(r.Item.status)) });
  } catch (e) {
    console.error(JSON.stringify({ msg: 'zip lookup failed', zip, err: e.message }));
    return reply(502, { success: false, available: false, message: "Couldn't reach the territory checker. Please try again." });
  }
}

async function notify(rec) {
  if (!NOTIFY_EMAIL || !FROM_EMAIL) return;
  const lines = [
    `New lead from ${rec.source || 'ypnus.com'}`, '',
    `Name: ${rec.name}`, `Email: ${rec.email}`, `Phone: ${rec.phone || '-'}`, `ZIP: ${rec.zip || '-'}`,
    `Plan: ${rec.plan || '-'}`, `Role: ${rec.role || '-'}`, `Email consent: ${rec.consent ? 'yes' : 'no'}`,
    `Call/text consent: ${rec.smsConsent ? 'yes' : 'no'}`, '', rec.message || '', '', `Lead ID: ${rec.id}`,
  ];
  await ses.send(new SendEmailCommand({
    FromEmailAddress: FROM_EMAIL,
    Destination: { ToAddresses: [NOTIFY_EMAIL] },
    ReplyToAddresses: [rec.email],
    Content: { Simple: { Subject: { Data: `New ypnus.com lead: ${rec.name}${rec.zip ? ` (${rec.zip})` : ''}` }, Body: { Text: { Data: lines.join('\n') } } } },
  }));
}

async function forward(rec) {
  const s = await secrets();
  if (!s.LEAD_WEBHOOK_URL) return;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(s.LEAD_WEBHOOK_URL, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', ...(s.LEAD_WEBHOOK_SECRET ? { 'x-ypnus-secret': s.LEAD_WEBHOOK_SECRET } : {}) },
      body: JSON.stringify(rec),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } finally { clearTimeout(t); }
}

async function lead(event) {
  const b = parseBody(event);
  if (!b) return reply(400, { success: false, message: 'Please try again.' });
  if (clean(b.website)) return reply(200, { success: true, message: 'Thanks! Check your inbox.' }); // honeypot
  const h = event.headers || {};
  const rec = {
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
    name: clean(b.name, 120), email: clean(b.email, 254).toLowerCase(), phone: clean(b.phone, 40),
    zip: clean(b.zip, 5), plan: clean(b.plan, 40), role: clean(b.role, 60), message: clean(b.message, 2000),
    source: clean(b.source || h.referer || '', 300),
    consent: yes(b.consent), smsConsent: yes(b.sms_consent),
    utm: Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].filter((k) => b[k]).map((k) => [k, clean(b[k], 120)])),
    ip: clean((h['x-forwarded-for'] || '').split(',')[0], 64), userAgent: clean(h['user-agent'], 300),
  };
  if (!rec.name || !EMAIL_RE.test(rec.email)) return reply(400, { success: false, message: 'Enter your first name and a valid email.' });
  if (!rec.consent) return reply(400, { success: false, message: 'Please confirm email permission.' });
  if (rec.zip && !/^\d{5}$/.test(rec.zip)) return reply(400, { success: false, message: 'Enter a complete 5-digit ZIP or leave it blank.' });

  try {
    await ddb.send(new PutCommand({ TableName: LEADS_TABLE, Item: rec }));
  } catch (e) {
    console.error(JSON.stringify({ msg: 'lead store failed', err: e.message }));
    return reply(500, { success: false, message: 'Please try again in a moment.' });
  }
  const side = await Promise.allSettled([notify(rec), forward(rec)]);
  side.forEach((s, i) => { if (s.status === 'rejected') console.error(JSON.stringify({ msg: i ? 'lead webhook failed' : 'lead email failed', id: rec.id, err: s.reason?.message })); });
  console.log(JSON.stringify({ msg: 'lead stored', id: rec.id, zip: rec.zip || null, source: rec.source }));

  const type = (h['content-type'] || '').toLowerCase();
  const wantsHtml = type.includes('application/x-www-form-urlencoded') && !h['x-requested-with'] && (h.accept || '').includes('text/html');
  if (wantsHtml) return { statusCode: 303, headers: { location: '/thank-you/', 'cache-control': 'no-store' }, body: '' };
  return reply(200, { success: true, message: rec.zip ? `Thanks, ${rec.name}. Your ZIP ${rec.zip} plan is on the way. Check your inbox.` : `Thanks, ${rec.name}. Check your inbox.` });
}

export async function handler(event) {
  const h = event.headers || {};
  if (ORIGIN_VERIFY && h['x-origin-verify'] !== ORIGIN_VERIFY) return reply(403, { success: false, message: 'Forbidden' });
  const method = event.requestContext?.http?.method || 'GET';
  const p = (event.rawPath || '/').replace(/\/{2,}/g, '/');
  const q = event.queryStringParameters || {};

  if (p === '/api/health' || p === '/api/health/') return reply(200, { ok: true });

  const zipRoute = p.match(/^\/(?:api\/zip-check|wp-json\/ypnus\/v1\/zip-check)(?:\/(\d*))?\/?$/);
  if (zipRoute && (method === 'GET' || method === 'HEAD')) return zipCheck(String(zipRoute[1] || q.zip || '').trim());

  if (/^\/(?:api\/lead|wp-json\/ypnusa-homepage\/v1\/lead)\/?$/.test(p)) {
    if (method === 'OPTIONS') return { statusCode: 204, headers: { allow: 'POST, OPTIONS' }, body: '' };
    if (method !== 'POST') return reply(405, { success: false, message: 'Method not allowed' }, { allow: 'POST' });
    return lead(event);
  }

  if (p.startsWith('/wp-json/')) return { statusCode: 410, headers: { 'content-type': 'text/plain', 'cache-control': 'public, max-age=86400' }, body: 'Gone' };
  return reply(404, { success: false, message: 'Not found' });
}
