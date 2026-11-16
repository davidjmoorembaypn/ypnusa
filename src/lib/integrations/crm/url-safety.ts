import dns from "node:dns/promises";
import net from "node:net";

/**
 * Where a loan officer may point their CRM link. The address comes from an officer, so it
 * must never let the server reach itself, the AWS metadata service or a private network:
 * https only, no user:password, standard port, and every address the host resolves to
 * must be public. Checked when the link is saved and again before each send.
 */

const MAX_URL_LENGTH = 2048;

export type UrlCheck = { ok: true; url: URL } | { ok: false; error: string };

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inV4Range(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const PRIVATE_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
];

/** True for loopback, private, link-local, carrier-grade NAT, test, multicast and reserved addresses. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "");
  if (net.isIPv4(ip)) return PRIVATE_V4.some(([base, bits]) => inV4Range(ip, base, bits));
  if (!net.isIPv6(ip)) return true;
  const lower = ip.toLowerCase();
  // IPv4-mapped addresses, dotted (::ffff:10.0.0.1) or hex as URL parsing writes them (::ffff:a00:1).
  const mapped = lower.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    return isPrivateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  if (lower === "::" || lower === "::1") return true;
  const first = parseInt(lower.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (lower.startsWith("64:ff9b:")) return true; // NAT64 can reach private IPv4
  if (lower.startsWith("2001:db8:")) return true; // documentation
  return false;
}

/** The checks that need no network: shape, scheme, credentials, port and literal addresses. */
export function checkOutboundUrl(raw: unknown): UrlCheck {
  if (typeof raw !== "string") return { ok: false, error: "Paste the full https address from your CRM or Zapier." };
  const value = raw.trim();
  if (!value || value.length > MAX_URL_LENGTH) {
    return { ok: false, error: "Paste the full https address from your CRM or Zapier." };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "That isn't a valid web address." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "The address must start with https://." };
  if (url.username || url.password) return { ok: false, error: "The address can't include a user name or password." };
  if (url.port && url.port !== "443") return { ok: false, error: "The address must use the standard https port." };
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, error: "The address must be a public website." };
  }
  if (net.isIP(host) && isPrivateAddress(host)) return { ok: false, error: "The address must be a public website." };
  if (!net.isIP(host) && !host.includes(".")) return { ok: false, error: "The address must be a public website." };
  return { ok: true, url };
}

type Lookup = (hostname: string) => Promise<Array<{ address: string }>>;

const defaultLookup: Lookup = (hostname) => dns.lookup(hostname, { all: true, verbatim: true });
let lookup: Lookup = defaultLookup;

/** Test hook: replace DNS resolution. */
export function setDnsLookupForTests(next: Lookup | null): void {
  lookup = next ?? defaultLookup;
}

/** Full check before a send: the shape checks, then every resolved address must be public. */
export async function checkOutboundUrlResolves(raw: unknown): Promise<UrlCheck> {
  const shape = checkOutboundUrl(raw);
  if (!shape.ok) return shape;
  const host = shape.url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) return shape;
  try {
    const addresses = await lookup(host);
    if (addresses.length === 0) return { ok: false, error: "That address doesn't resolve." };
    if (addresses.some((entry) => isPrivateAddress(entry.address))) {
      return { ok: false, error: "The address must be a public website." };
    }
    return shape;
  } catch {
    return { ok: false, error: "That address doesn't resolve." };
  }
}
