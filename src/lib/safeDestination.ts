import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP, isIPv4, isIPv6 } from "node:net";

export const RESTRICTED_ADDRESS_MESSAGE = "That URL points to a restricted address";

export function isRestrictedAddressError(err: unknown): boolean {
  return err instanceof Error && err.message === RESTRICTED_ADDRESS_MESSAGE;
}

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
v6Block.addSubnet("fec0::", 10, "ipv6");
v6Block.addSubnet("fc00::", 7, "ipv6");
v6Block.addSubnet("ff00::", 8, "ipv6");

export type ResolvedAddress = { address: string; family: 4 | 6 };

export type LookupFn = (hostname: string) => Promise<ResolvedAddress[]>;

function stripZone(address: string): string {
  const cut = address.indexOf("%");
  return cut === -1 ? address : address.slice(0, cut);
}

function expandDottedQuad(raw: string): string {
  const match = raw.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return raw;
  const octets = [match[2], match[3], match[4], match[5]].map(Number);
  if (octets.some((n) => n > 255)) return raw;
  const high = ((octets[0] << 8) | octets[1]).toString(16);
  const low = ((octets[2] << 8) | octets[3]).toString(16);
  return `${match[1]}${high}:${low}`;
}

function parseHexGroup(group: string): number | null {
  if (!group || group.length > 4 || /[^0-9a-f]/i.test(group)) return null;
  return Number.parseInt(group, 16);
}

function ipv6Groups(address: string): number[] | null {
  const raw = expandDottedQuad(stripZone(address).toLowerCase());
  if (!isIPv6(raw) && !isIPv6(stripZone(address))) return null;
  const sides = raw.split("::");
  if (sides.length > 2) return null;
  const parseSide = (side: string): number[] | null => {
    if (!side) return [];
    const groups = side.split(":");
    const values: number[] = [];
    for (const group of groups) {
      const value = parseHexGroup(group);
      if (value === null) return null;
      values.push(value);
    }
    return values;
  };
  if (sides.length === 1) {
    const groups = parseSide(sides[0]);
    return groups && groups.length === 8 ? groups : null;
  }
  const left = parseSide(sides[0]);
  const right = parseSide(sides[1]);
  if (!left || !right) return null;
  const fill = 8 - left.length - right.length;
  if (fill < 0) return null;
  return [...left, ...Array(fill).fill(0), ...right];
}

function groupsToBytes(groups: number[]): Uint8Array {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    bytes[i * 2] = (groups[i] >> 8) & 255;
    bytes[i * 2 + 1] = groups[i] & 255;
  }
  return bytes;
}

function last32ToIPv4(bytes: Uint8Array): string {
  return `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
}

function prefixZero(bytes: Uint8Array, start: number, end: number): boolean {
  for (let i = start; i < end; i++) {
    if (bytes[i] !== 0) return false;
  }
  return true;
}

/** IPv4 embedded in mapped, SIIT, compatible, NAT64, or 6to4 form. */
export function embeddedIPv4(address: string): string | null {
  const groups = ipv6Groups(address);
  if (!groups) return null;
  const bytes = groupsToBytes(groups);

  // ::ffff:x.x.x.x  /  ::ffff:7f00:1
  if (prefixZero(bytes, 0, 10) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return last32ToIPv4(bytes);
  }
  // ::ffff:0:x.x.x.x  (SIIT IPv4-translated)
  if (
    prefixZero(bytes, 0, 8) &&
    bytes[8] === 0xff &&
    bytes[9] === 0xff &&
    bytes[10] === 0 &&
    bytes[11] === 0
  ) {
    return last32ToIPv4(bytes);
  }
  // ::x.x.x.x  (deprecated IPv4-compatible ::/96)
  if (prefixZero(bytes, 0, 12)) {
    return last32ToIPv4(bytes);
  }
  // 64:ff9b::/96 NAT64 well-known prefix
  if (
    bytes[0] === 0 &&
    bytes[1] === 0x64 &&
    bytes[2] === 0xff &&
    bytes[3] === 0x9b &&
    prefixZero(bytes, 4, 12)
  ) {
    return last32ToIPv4(bytes);
  }
  // 2002::/16 6to4 — IPv4 is the next 32 bits
  if (bytes[0] === 0x20 && bytes[1] === 0x02) {
    return `${bytes[2]}.${bytes[3]}.${bytes[4]}.${bytes[5]}`;
  }
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
    throw new Error(RESTRICTED_ADDRESS_MESSAGE);
  }
  if (isIP(host) && isBlockedIp(host)) {
    throw new Error(RESTRICTED_ADDRESS_MESSAGE);
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
    throw new Error(RESTRICTED_ADDRESS_MESSAGE);
  }

  if (isIP(host)) {
    if (isBlockedIp(host)) throw new Error(RESTRICTED_ADDRESS_MESSAGE);
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
      throw new Error(RESTRICTED_ADDRESS_MESSAGE);
    }
  }
  return records;
}
