import crypto from "node:crypto";

/**
 * Field-level encryption for borrower personal data at rest (AES-256-GCM).
 *
 * Key: PII_ENCRYPTION_KEY, 32 random bytes as base64 (generate with
 * `openssl rand -base64 32`). It lives only in the server's settings file, never in
 * the repo. Without a key the app keeps working exactly as before (values stay
 * plain text); with one, every write of the data file encrypts the listed fields.
 *
 * Format: `enc:v1:<iv b64>:<tag b64>:<ciphertext b64>`. The plaintext is the
 * JSON of the original value, so strings, numbers, objects and arrays all round
 * trip with their type intact.
 *
 * Fail-safe rules:
 * - A value that cannot be decrypted (no key, wrong key, tampered) is left as
 *   ciphertext rather than thrown away, so a misconfigured server never loses
 *   or overwrites data; the next write keeps it encrypted as-is.
 * - Values already encrypted are never encrypted twice.
 */

export const PII_PREFIX = "enc:v1:";
const KEY_ENV = "PII_ENCRYPTION_KEY";
const IV_BYTES = 12;

type KeyState = { status: "on"; key: Buffer } | { status: "off" } | { status: "invalid" };

let cachedRaw: string | undefined | null = null;
let cachedState: KeyState = { status: "off" };

/** Reads PII_ENCRYPTION_KEY (re-read when the env value changes, so tests can switch it). */
function keyState(): KeyState {
  const raw = process.env[KEY_ENV]?.trim() || undefined;
  if (raw === cachedRaw) return cachedState;
  cachedRaw = raw;
  if (!raw) {
    cachedState = { status: "off" };
  } else {
    const key = Buffer.from(raw, "base64");
    cachedState = key.length === 32 ? { status: "on", key } : { status: "invalid" };
    if (cachedState.status === "invalid") {
      // Never print the value itself.
      console.error(`[pii] ${KEY_ENV} is set but is not 32 bytes of base64; encryption stays OFF.`);
    }
  }
  return cachedState;
}

/** "on" when a valid key is configured, "invalid" when one is set but malformed, else "off". */
export function piiEncryptionStatus(): KeyState["status"] {
  return keyState().status;
}

export function isEncryptedValue(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PII_PREFIX);
}

/** Encrypts any JSON value. Returns the value unchanged when no valid key is set or it is already encrypted. */
export function encryptValue<T>(value: T): T | string {
  if (value === undefined || value === null || isEncryptedValue(value)) return value;
  const state = keyState();
  if (state.status !== "on") return value;
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", state.key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PII_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export type DecryptResult<T> = { ok: true; value: T } | { ok: false; value: string };

/** Decrypts a value written by encryptValue. Plain values pass through as ok. */
export function decryptValue<T = unknown>(value: unknown): DecryptResult<T> {
  if (!isEncryptedValue(value)) return { ok: true, value: value as T };
  const state = keyState();
  if (state.status !== "on") return { ok: false, value };
  const parts = value.slice(PII_PREFIX.length).split(":");
  if (parts.length !== 3) return { ok: false, value };
  try {
    const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, "base64"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", state.key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return { ok: true, value: JSON.parse(plain) as T };
  } catch {
    return { ok: false, value };
  }
}
