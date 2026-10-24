import { createHmac } from "node:crypto";

// First-party segment lookup. The hot path must never wait: every lookup is capped, cached and
// fails open to "no segments". Only allow-listed behavioural segment ids can reach a DSP;
// borrower, lead or payment data is never stored here.

const SEGMENT_ID = /^[a-z0-9_]{2,40}$/;
const MAX_SEGMENTS = 25;

/** Hash the first-party cookie id so DSPs never see the raw cookie. */
export function hashUserId(secret, uid) {
  if (!secret || !uid) return null;
  return createHmac("sha256", secret).update(String(uid)).digest("hex").slice(0, 32);
}

// --- key/value backends (all expose get(key) -> object|null) -----------------------------
export const memoryKv = (data = {}) => ({ get: async (key) => data[key] ?? null });

/** DynamoDB backend. Pass the SDK pieces in so this file has no hard AWS dependency. */
export function dynamoKv({ doc, GetCommand, table }) {
  return {
    async get(key) {
      const out = await doc.send(new GetCommand({ TableName: table, Key: { pk: key }, ConsistentRead: false }));
      return out.Item ?? null;
    },
  };
}

/** Redis / ElastiCache / Valkey backend. `redis.get` returns a JSON string or null. */
export function redisKv({ redis, prefix = "seg:" }) {
  return {
    async get(key) {
      const raw = await redis.get(prefix + key);
      return raw ? JSON.parse(raw) : null;
    },
  };
}

export class SegmentStore {
  constructor({ kv, allowed = null, cacheMs = 30_000, maxCache = 5000, now = () => Date.now() }) {
    this.kv = kv;
    this.allowed = allowed ? new Set(allowed) : null;
    this.cacheMs = cacheMs;
    this.maxCache = maxCache;
    this.now = now;
    this.cache = new Map();
  }

  /** @returns {Promise<{segments:{id:string,name?:string,value?:string}[], source:'cache'|'kv'|'timeout'|'error'|'none'}>} */
  async lookup(userId, timeoutMs) {
    if (!userId) return { segments: [], source: "none" };
    const hit = this.cache.get(userId);
    if (hit && hit.expires > this.now()) return { segments: hit.segments, source: "cache" };

    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("segment_timeout")), timeoutMs);
      });
      const item = await Promise.race([this.kv.get(`SEG#${userId}`), timeout]);
      const segments = this.#clean(item?.segments);
      this.#remember(userId, segments);
      return { segments, source: "kv" };
    } catch (err) {
      return { segments: [], source: err?.message === "segment_timeout" ? "timeout" : "error" };
    } finally {
      clearTimeout(timer);
    }
  }

  #clean(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const s of raw) {
      const id = typeof s === "string" ? s : s?.id;
      if (typeof id !== "string" || !SEGMENT_ID.test(id)) continue;
      if (this.allowed && !this.allowed.has(id)) continue;
      out.push({ id, ...(typeof s?.name === "string" ? { name: s.name.slice(0, 60) } : {}) });
      if (out.length >= MAX_SEGMENTS) break;
    }
    return out;
  }

  #remember(userId, segments) {
    if (this.cache.size >= this.maxCache) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(userId, { segments, expires: this.now() + this.cacheMs });
  }
}
