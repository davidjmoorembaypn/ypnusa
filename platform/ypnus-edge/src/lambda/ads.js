import { timingSafeEqual } from "node:crypto";
import { loadConfig } from "../config.js";
import { decideAds } from "../ads/service.js";
import { SegmentStore, dynamoKv, memoryKv } from "../segments/store.js";
import { verifyToken } from "./sign.js";

// API Gateway HTTP API (payload v2) handler for:
//   POST /api/ads        -> ad decision (<=150ms DSP window)
//   POST /api/ads/event  -> impression beacon: fires signed win/billing notices once

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

const respond = (statusCode, body, extra = {}) => ({
  statusCode,
  headers: { ...JSON_HEADERS, ...(extra.headers ?? {}) },
  ...(extra.cookies ? { cookies: extra.cookies } : {}),
  body: body === undefined ? "" : JSON.stringify(body),
});

function parseCookies(header = "") {
  const out = {};
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Build the handler with injectable dependencies (tests inject fakes, Lambda uses defaults). */
export function createHandler(deps) {
  const { config, segments, dedupe, fetchImpl = fetch, log = (entry) => console.log(JSON.stringify(entry)) } = deps;

  return async function handler(event) {
    try {
      const headers = Object.fromEntries(Object.entries(event.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
      if (config.originVerify && !safeEqual(headers["x-origin-verify"] ?? "", config.originVerify)) return respond(403, { error: "forbidden" });

      const method = event.requestContext?.http?.method;
      const path = event.rawPath ?? event.requestContext?.http?.path ?? "";
      if (method !== "POST") return respond(405, { error: "method_not_allowed" });

      const raw = event.isBase64Encoded ? Buffer.from(event.body ?? "", "base64").toString("utf8") : (event.body ?? "");
      if (raw.length > 16_384) return respond(413, { error: "too_large" });

      if (path === "/api/ads/event") return await handleEvent({ raw, config, dedupe, fetchImpl, log });
      if (path !== "/api/ads") return respond(404, { error: "not_found" });

      let input;
      try {
        input = JSON.parse(raw);
      } catch {
        return respond(400, { error: "invalid_json" });
      }
      const ip = (headers["cloudfront-viewer-address"] ?? "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "") || event.requestContext?.http?.sourceIp;
      const result = await decideAds({
        input,
        headers,
        ip,
        cookies: parseCookies(Array.isArray(event.cookies) ? event.cookies.join(";") : headers.cookie),
        deps: { config, segments, fetchImpl },
      });
      log({ msg: "ads_decision", status: result.status, ...result.metrics });
      return respond(result.status, result.body, { cookies: result.setCookie ? [result.setCookie] : undefined });
    } catch (err) {
      // Never surface internals and never answer the page with a 5xx: browsers log every failed
      // request to the console. A 200 with no slots makes the loader show the house ad instead.
      log({ msg: "ads_error", error: String(err?.message ?? err).slice(0, 120) });
      return respond(200, { v: 1, reason: "error", slots: {} });
    }
  };
}

async function handleEvent({ raw, config, dedupe, fetchImpl, log }) {
  const payload = verifyToken(config.hmacSecret, raw.trim());
  if (!payload) return respond(400, { error: "invalid_token" });
  if (!(await dedupe.claim(`EVT#${payload.j}`, config.tokenTtlSeconds))) return respond(204);
  const urls = [payload.n, payload.b].filter(Boolean);
  await Promise.allSettled(
    urls.map((url) => fetchImpl(url, { method: "GET", redirect: "error", signal: AbortSignal.timeout(config.noticeTimeoutMs) })),
  );
  log({ msg: "ads_notice", dsp: payload.d, price: payload.p, notices: urls.length });
  return respond(204);
}

// --- Lambda entrypoint: wire real dependencies lazily on cold start ----------------------
let cached;
async function defaults() {
  if (cached) return cached;
  const config = loadConfig();
  if (config.stateTable) {
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    const { DynamoDBDocumentClient, GetCommand, PutCommand } = await import("@aws-sdk/lib-dynamodb");
    const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ requestHandler: undefined, maxAttempts: 1 }));
    cached = {
      config,
      segments: new SegmentStore({ kv: dynamoKv({ doc, GetCommand, table: config.stateTable }) }),
      dedupe: {
        async claim(key, ttlSeconds) {
          try {
            await doc.send(new PutCommand({ TableName: config.stateTable, Item: { pk: key, ttl: Math.floor(Date.now() / 1000) + ttlSeconds }, ConditionExpression: "attribute_not_exists(pk)" }));
            return true;
          } catch (err) {
            if (err?.name === "ConditionalCheckFailedException") return false;
            throw err;
          }
        },
      },
    };
  } else {
    const seen = new Set();
    cached = { config, segments: new SegmentStore({ kv: memoryKv() }), dedupe: { claim: async (k) => !seen.has(k) && !!seen.add(k) } };
  }
  return cached;
}

export const handler = async (event) => createHandler(await defaults())(event);
