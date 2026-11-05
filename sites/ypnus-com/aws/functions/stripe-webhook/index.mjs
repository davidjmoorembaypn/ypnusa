/**
 * Stripe webhook receiver for ypnus.com (AWS Lambda, Node.js 22).
 * Endpoint: POST https://ypnus.com/api/stripe/webhook   (before cutover: https://<cloudfront-domain>/api/stripe/webhook)
 *
 * 1. Verifies the Stripe-Signature header with STRIPE_WEBHOOK_SECRET (from the stack's secret). No Stripe SDK needed.
 * 2. Ignores events it has already processed (idempotent: Stripe retries).
 * 3. Keeps the ZIP territory ledger (ZIP_TABLE) in step with Exclusive subscriptions:
 *      checkout.session.completed   + Exclusive plan + a ZIP in metadata -> ZIP "claimed" (one owner per ZIP)
 *      customer.subscription.deleted                                    -> ZIP "released"
 *    If the ZIP already belongs to someone else, nothing is overwritten and NOTIFY_EMAIL gets a CONFLICT email.
 * 4. Forwards the verified event to PROVISION_WEBHOOK_URL (e.g. app.ypnus.com) so the app can create the
 *    login/account. Header x-ypnus-signature = hex HMAC-SHA256(PROVISION_WEBHOOK_SECRET, body).
 *    If that call fails the function returns 500 and Stripe retries later.
 *
 * Metadata names it understands (on the Checkout Session or Subscription): zip | zip_code | territory_zip,
 * and plan | tier | plan_name. A plan counts as Exclusive when it contains "exclusive" or its price ID is listed in
 * EXCLUSIVE_PRICE_IDS (comma-separated, in the secret; only seen when the event includes line items).
 * Simplest: put plan=exclusive and zip=NNNNN in the Checkout Session metadata. Check against your real Stripe setup before cutover.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESv2Client({});
const sm = new SecretsManagerClient({});
const { BILLING_TABLE, ZIP_TABLE, NOTIFY_EMAIL, FROM_EMAIL, SECRET_ARN, ORIGIN_VERIFY } = process.env;
const TOLERANCE_SECONDS = 300;

let cache = { at: 0, value: {} };
async function secrets() {
  if (Date.now() - cache.at < 300000) return cache.value;
  const r = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
  cache = { at: Date.now(), value: JSON.parse(r.SecretString || '{}') };
  return cache.value;
}

const res = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
const log = (o) => console.log(JSON.stringify(o));

export function verifyStripeSignature(rawBody, header, secret, now = Math.floor(Date.now() / 1000)) {
  if (!header || !secret) return false;
  const pairs = header.split(',').map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()]; });
  const t = Number((pairs.find(([k]) => k === 't') || [])[1]);
  const sigs = pairs.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(now - t) > TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex'));
  return sigs.some((s) => { const b = Buffer.from(s); return b.length === expected.length && timingSafeEqual(b, expected); });
}

const pick = (o, keys) => { for (const k of keys) if (o && o[k]) return String(o[k]).trim(); return ''; };

async function email(subject, text) {
  if (!NOTIFY_EMAIL || !FROM_EMAIL) return;
  try {
    await ses.send(new SendEmailCommand({ FromEmailAddress: FROM_EMAIL, Destination: { ToAddresses: [NOTIFY_EMAIL] }, Content: { Simple: { Subject: { Data: subject }, Body: { Text: { Data: text } } } } }));
  } catch (e) { log({ msg: 'notify email failed', err: e.message }); }
}

async function claimZip({ zip, subscriptionId, customerId, customerEmail, plan }) {
  try {
    await ddb.send(new PutCommand({
      TableName: ZIP_TABLE,
      Item: { zip, status: 'claimed', subscriptionId, customerId, email: customerEmail, plan, claimedAt: new Date().toISOString() },
      ConditionExpression: 'attribute_not_exists(zip) OR #s = :released OR subscriptionId = :sub',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':released': 'released', ':sub': subscriptionId },
    }));
    log({ msg: 'zip claimed', zip, subscriptionId });
    return true;
  } catch (e) {
    if (e.name !== 'ConditionalCheckFailedException') throw e;
    const cur = await ddb.send(new GetCommand({ TableName: ZIP_TABLE, Key: { zip } }));
    log({ msg: 'zip conflict', zip, subscriptionId, heldBy: cur.Item?.subscriptionId });
    await email(`CONFLICT: ZIP ${zip} already claimed`, `Stripe subscription ${subscriptionId} (${customerEmail || customerId}) paid for Exclusive ZIP ${zip}, but the ZIP is held by subscription ${cur.Item?.subscriptionId || '?'}.\nNothing was overwritten. Decide whether to refund or move this customer.`);
    return false;
  }
}

async function releaseZipFor(subscriptionId) {
  const sub = await ddb.send(new GetCommand({ TableName: BILLING_TABLE, Key: { pk: `sub#${subscriptionId}` } }));
  const zip = sub.Item?.zip;
  if (!zip) return null;
  try {
    await ddb.send(new UpdateCommand({
      TableName: ZIP_TABLE, Key: { zip },
      UpdateExpression: 'SET #s = :released, releasedAt = :now',
      ConditionExpression: 'subscriptionId = :sub',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':released': 'released', ':now': new Date().toISOString(), ':sub': subscriptionId },
    }));
    log({ msg: 'zip released', zip, subscriptionId });
    return zip;
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') return null;
    throw e;
  }
}

async function handle(evt, s) {
  const obj = evt.data?.object || {};
  if (evt.type === 'checkout.session.completed') {
    const md = { ...(obj.subscription_details?.metadata || {}), ...(obj.metadata || {}) };
    const zip = pick(md, ['zip', 'zip_code', 'territory_zip']);
    const plan = pick(md, ['plan', 'tier', 'plan_name']).toLowerCase();
    const exclusivePrices = String(s.EXCLUSIVE_PRICE_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
    const priceIds = (obj.line_items?.data || []).map((li) => li.price?.id).filter(Boolean);
    const exclusive = plan.includes('exclusive') || priceIds.some((p) => exclusivePrices.includes(p));
    const subscriptionId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id || '';
    const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id || '';
    const customerEmail = obj.customer_details?.email || obj.customer_email || '';
    if (subscriptionId) {
      await ddb.send(new PutCommand({ TableName: BILLING_TABLE, Item: { pk: `sub#${subscriptionId}`, customerId, email: customerEmail, plan, zip: /^\d{5}$/.test(zip) ? zip : '', status: 'active', createdAt: new Date().toISOString() } }));
    }
    let zipNote = '';
    if (exclusive && /^\d{5}$/.test(zip) && subscriptionId) zipNote = (await claimZip({ zip, subscriptionId, customerId, customerEmail, plan })) ? ` ZIP ${zip} claimed.` : ` ZIP ${zip} CONFLICT.`;
    else if (exclusive) zipNote = ' Exclusive plan but no valid ZIP in metadata: check this checkout.';
    await email(`New ypnus.com subscription: ${plan || 'plan?'} ${customerEmail}`, `Checkout ${obj.id} completed.\nCustomer: ${customerEmail || customerId}\nPlan: ${plan || '(no plan metadata)'}\nSubscription: ${subscriptionId || '-'}\n${zipNote}`);
  } else if (evt.type === 'customer.subscription.deleted') {
    const zip = await releaseZipFor(obj.id);
    await ddb.send(new UpdateCommand({ TableName: BILLING_TABLE, Key: { pk: `sub#${obj.id}` }, UpdateExpression: 'SET #s = :c, endedAt = :now', ExpressionAttributeNames: { '#s': 'status' }, ExpressionAttributeValues: { ':c': 'canceled', ':now': new Date().toISOString() } }));
    await email(`ypnus.com subscription ended${zip ? `: ZIP ${zip} released` : ''}`, `Subscription ${obj.id} was canceled.${zip ? ` ZIP ${zip} is open again.` : ''}`);
  }
}

async function provision(rawBody, s) {
  if (!s.PROVISION_WEBHOOK_URL) return;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const sig = s.PROVISION_WEBHOOK_SECRET ? createHmac('sha256', s.PROVISION_WEBHOOK_SECRET).update(rawBody).digest('hex') : '';
    const r = await fetch(s.PROVISION_WEBHOOK_URL, { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', ...(sig ? { 'x-ypnus-signature': sig } : {}) }, body: rawBody });
    if (!r.ok) throw new Error(`provisioning endpoint answered HTTP ${r.status}`);
  } finally { clearTimeout(t); }
}

export async function handler(event) {
  const h = event.headers || {};
  if (ORIGIN_VERIFY && h['x-origin-verify'] !== ORIGIN_VERIFY) return res(403, { error: 'forbidden' });
  if (event.requestContext?.http?.method !== 'POST') return res(405, { error: 'method not allowed' });
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  const s = await secrets();
  if (!verifyStripeSignature(raw, h['stripe-signature'], s.STRIPE_WEBHOOK_SECRET)) {
    log({ msg: 'bad stripe signature' });
    return res(400, { error: 'invalid signature' });
  }
  const evt = JSON.parse(raw);
  const key = { pk: `evt#${evt.id}` };
  const seen = await ddb.send(new GetCommand({ TableName: BILLING_TABLE, Key: key }));
  if (seen.Item) return res(200, { received: true, duplicate: true });

  await handle(evt, s);
  await provision(raw, s); // throws -> 500 -> Stripe retries (ledger writes above are idempotent)
  await ddb.send(new PutCommand({ TableName: BILLING_TABLE, Item: { ...key, type: evt.type, at: new Date().toISOString(), ttl: Math.floor(Date.now() / 1000) + 90 * 86400 } }));
  log({ msg: 'stripe event processed', id: evt.id, type: evt.type });
  return res(200, { received: true });
}
