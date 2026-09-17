import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP, isIPv4, isIPv6 } from "node:net";

const RESTRICTED = "That URL points to a restricted address";

const v4Block = new BlockList();
v4Block.addSubnet("0.0.0.0", 8, "ipv4");
v4Block.addSubnet("10.0.0.0", 8, "ipv4");
v4Block.addSubnet("100.64.0.0", 10, "ipv4");
v4Block.addSubnet("127.0.0.0", 8, "ipv4");
v4Block.addSubnet("169.254.0.0", 16, "ipv4");
v4Block.addSubnet("172.16.0.0", 12, "ipv4");
v4Block.addSubnet("192.168.0.0", 16, "ipv4");
v4Block.addSubnet("224.0.0.0", 4, "ipv4");
v4Block.addSubnet("240.0.0.0", 4, "ipv4");

const v6Block = new BlockList();
v6Block.addAddress("::", "ipv6");
v6Block.addAddress("::1", "ipv6");
v6Block.addSubnet("fe80::", 10, "ipv6");
v6Block.addSubnet("fc00::", 7, "ipv6");
v6Block.addSubnet("ff00::", 8, "ipv6");

export type ResolvedAddress = { address: string; family: 4 | 6 };

export type LookupFn = (hostname: string) => Promise<ResolvedAddress[]>;

function stripZone(address: string): string {
  const cut = address.indexOf("%");
  return cut === -1 ? address : address.slice(0, cut);
}

function hexPairToIPv4(high: string, low: string): string {
  const x = Number.parseInt(high.padStart(4, "0"), 16);
  const y = Number.parseInt(low.padStart(4, "0"), 16);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "";
  return `${(x >> 8) & 255}.${x & 255}.${(y >> 8) & 255}.${y & 255}`;
}

/** IPv4 embedded in IPv4-mapped, NAT64, or 6to4 form. */
export function embeddedIPv4(address: string): string | null {
  const raw = stripZone(address).toLowerCase();
  if (!isIPv6(raw)) return null;

  const dotted = raw.match(/^(?:::ffff:|64:ff9b::|::)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return dotted[1];

  const mappedHex = raw.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) return hexPairToIPv4(mappedHex[1], mappedHex[2]);

  const nat64hex = raw.match(/^64:ff9b::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (nat64hex) return hexPairToIPv4(nat64hex[1], nat64hex[2]);

  const sixToFour = raw.match(/^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4})(?::|$)/);
  if (sixToFour) return hexPairToIPv4(sixToFour[1], sixToFour[2]);

  return null;
}

export function isBlockedIp(address: string): boolean {
  const ip = stripZone(address);
  const v4 = isIPv4(ip) ? ip : embeddedIPv4(ip);
  if (v4) return v4Block.check(v4, "ipv4");
  if (isIPv6(ip)) return v6Block.check(ip, "ipv6");
  return true;
}

export function normalizeHostname(hostname: string): string {
  let host = hostname.replace(/\.+$/, "").toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }
  return host;
}

export function isBlockedHostname(hostname: string): boolean {
  const h = normalizeHostname(hostname);
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "local" || h.endsWith(".local")) return true;
  return false;
}

export function parseHttpUrl(sourceUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error("That doesn't look like a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https URLs are supported");
  }
  if (!parsed.hostname) {
    throw new Error("That doesn't look like a valid URL");
  }
  return parsed;
}

/** Sync check of scheme plus obvious local names / IP literals. */
export function assertSafeUrl(sourceUrl: string): URL {
  const parsed = parseHttpUrl(sourceUrl);
  const host = normalizeHostname(parsed.hostname);
  if (isBlockedHostname(host)) {
    throw new Error(RESTRICTED);
  }
  if (isIP(host) && isBlockedIp(host)) {
    throw new Error(RESTRICTED);
  }
  return parsed;
}

export async function defaultLookup(hostname: string): Promise<ResolvedAddress[]> {
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  return results.map((r) => ({
    address: r.address,
    family: r.family === 6 ? 6 : 4,
  }));
}

/**
 * Resolve hostname and reject the destination if any record is non-public.
 * IP literals are checked without DNS.
 */
export async function resolvePublicAddresses(
  url: URL,
  lookup: LookupFn = defaultLookup
): Promise<ResolvedAddress[]> {
  const host = normalizeHostname(url.hostname);
  if (isBlockedHostname(host)) {
    throw new Error(RESTRICTED);
  }

  if (isIP(host)) {
    if (isBlockedIp(host)) throw new Error(RESTRICTED);
    return [{ address: host, family: isIPv6(host) ? 6 : 4 }];
  }

  let records: ResolvedAddress[];
  try {
    records = await lookup(host);
  } catch {
    throw new Error("Could not reach that URL");
  }
  if (!records.length) {
    throw new Error("Could not reach that URL");
  }
  for (const record of records) {
    if (isBlockedIp(record.address)) {
      throw new Error(RESTRICTED);
    }
  }
  return records;
}
