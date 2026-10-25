import { createHmac, timingSafeEqual } from "node:crypto";

// Signed, expiring tokens for the impression beacon. The browser can only ask us to fire
// notice URLs that we ourselves approved and signed.

const b64 = (buf) => Buffer.from(buf).toString("base64url");

export function signToken(secret, payload, now = Date.now(), ttlSeconds = 600) {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(now / 1000) + ttlSeconds }));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(secret, token, now = Date.now()) {
  if (!secret || typeof token !== "string" || token.length > 4096) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.exp > Math.floor(now / 1000) ? payload : null;
  } catch {
    return null;
  }
}
