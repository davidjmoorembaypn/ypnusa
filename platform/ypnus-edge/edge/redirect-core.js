/* eslint-disable @typescript-eslint/no-unused-vars -- deployed as a CloudFront Function; resolveRedirect is called by the entry file */
// WordPress -> new site redirect rules. Runs as a CloudFront Function (viewer-request,
// cloudfront-js-2.0). Plain script, no imports, <10KB after build. Exact one-off mappings live
// in a CloudFront KeyValueStore so they can change without a redeploy.
var HOST = 'ypnus.com';
var WP_PARAMS = {p:1,page_id:1,cat:1,tag:1,s:1,paged:1,replytocom:1,preview:1,amp:1,feed:1,m:1,author:1,attachment_id:1};
var GONE = /^\/(xmlrpc\.php|wp-login\.php|wp-cron\.php|wp-admin(\/|$)|wp-includes\/|wp-content\/(plugins|themes)\/)/;

function keepQuery(q) {
  var out = [], k, i, vals;
  for (k in q) {
    if (WP_PARAMS[k]) continue;
    vals = q[k].multiValue ? q[k].multiValue.map(function (m) { return m.value; }) : [q[k].value];
    for (i = 0; i < vals.length; i++) out.push(encodeURIComponent(k) + (vals[i] === '' ? '' : '=' + encodeURIComponent(vals[i])));
  }
  return out.length ? '?' + out.join('&') : '';
}

async function resolveRedirect(req, kvGet) {
  var uri = req.uri || '/';
  var lower = uri.toLowerCase();
  var q = req.querystring || {};
  var host = ((req.headers.host && req.headers.host.value) || '').toLowerCase();
  var tail = keepQuery(q);
  function go(path) { return { status: 301, location: 'https://' + HOST + path + tail }; }
  var m, v, key;

  if (GONE.test(lower)) return { status: 410 };

  m = /^\/wp-content\/uploads\/(.+)$/.exec(uri);
  if (m) return go('/media/' + m[1]);

  if ((lower === '/' || lower === '/index.php') && (q.p || q.page_id)) {
    v = q.p ? await kvGet('p:' + q.p.value) : await kvGet('page_id:' + q.page_id.value);
    return go(v || (q.p ? '/blog' : '/'));
  }

  if (/^\/(comments\/)?feed\/?$/.test(lower)) return go('/blog');

  key = lower.replace(/\/(amp|feed|embed|trackback|comment-page-\d+)\/?$/, '').replace(/\/+$/, '') || '/';

  v = await kvGet(key);
  if (v) return go(v);

  if (/^\/(category|tag|author)\/./.test(key) || /^(\/blog)?\/page\/\d+$/.test(key) || /^\/\d{4}(\/\d{2}){0,2}$/.test(key)) return go('/blog');

  m = /^\/\d{4}\/\d{2}(?:\/\d{2})?\/([^\/]+)$/.exec(key);
  if (m && !/^\d{1,2}$/.test(m[1])) {
    v = await kvGet('slug:' + m[1]);
    return go(v || '/blog/' + m[1]);
  }

  m = /^\/([a-z0-9-]+)\.html$/.exec(key);
  if (m) return go('/' + m[1]);

  if (uri.length > 1 && uri.charAt(uri.length - 1) === '/' && uri.indexOf('.') < 0) return go(uri.replace(/\/+$/, ''));
  if (host === 'www.' + HOST) return go(uri);
  return null;
}
