/* eslint-disable @typescript-eslint/no-unused-vars -- CloudFront calls handler() by name */
import cf from 'cloudfront';
var kvs = cf.kvs();

async function kvGet(key) {
  try { return await kvs.get(key); } catch (e) { return null; }
}

async function handler(event) {
  var res = await resolveRedirect(event.request, kvGet);
  if (!res) return event.request;
  if (res.status === 410) return { statusCode: 410, statusDescription: 'Gone', headers: { 'cache-control': { value: 'public, max-age=86400' } } };
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: { location: { value: res.location }, 'cache-control': { value: 'public, max-age=3600' } }
  };
}
