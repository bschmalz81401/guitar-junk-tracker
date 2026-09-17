/**
 * Outbound fetch policy: resolved addresses, not hostname spelling.
 * Run: npx tsx scripts/test-safe-fetch.ts
 */
import assert from "node:assert/strict";
import {
  assertSafeUrl,
  embeddedIPv4,
  isBlockedHostname,
  isBlockedIp,
  resolvePublicAddresses,
} from "../src/lib/safeDestination";
import {
  safeFetch,
  type HopResponse,
  type TransportRequest,
} from "../src/lib/safeFetch";

let failed = 0;

async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`OK   ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(err);
  }
}

const blockedV4 = [
  "0.0.0.0",
  "0.1.2.3",
  "10.0.0.1",
  "10.255.255.255",
  "100.64.0.1",
  "100.127.255.255",
  "127.0.0.1",
  "127.255.255.255",
  "169.254.169.254",
  "172.16.0.1",
  "172.31.255.255",
  "192.168.0.1",
  "192.168.255.255",
  "224.0.0.1",
  "240.0.0.1",
  "255.255.255.255",
];

const allowedV4 = [
  "1.1.1.1",
  "8.8.8.8",
  "9.0.0.1",
  "11.0.0.1",
  "100.63.255.255",
  "100.128.0.1",
  "172.15.255.255",
  "172.32.0.1",
  "192.167.1.1",
  "192.169.1.1",
  "223.255.255.255",
];

const blockedV6 = [
  "::",
  "::1",
  "fe80::1",
  "fe80::1%eth0",
  "fc00::1",
  "fd12:3456:789a::1",
  "ff02::1",
  "::ffff:127.0.0.1",
  "::ffff:10.0.0.1",
  "::ffff:7f00:1",
  "64:ff9b::10.0.0.1",
  "64:ff9b::7f00:1",
  "2002:7f00:1::",
];

const allowedV6 = ["2001:4860:4860::8888", "2606:4700:4700::1111", "2002:808:808::"];

async function main() {
await check("blocks IPv4 loopback, private, link-local, CGNAT, multicast, reserved", () => {
  for (const ip of blockedV4) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
});

await check("allows ordinary public IPv4 addresses", () => {
  for (const ip of allowedV4) {
    assert.equal(isBlockedIp(ip), false, ip);
  }
});

await check("blocks IPv6 local, ULA, multicast, and IPv4-mapped equivalents", () => {
  for (const ip of blockedV6) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
});

await check("allows ordinary public IPv6 addresses", () => {
  for (const ip of allowedV6) {
    assert.equal(isBlockedIp(ip), false, ip);
  }
});

await check("extracts IPv4 from mapped, NAT64, and 6to4 forms", () => {
  assert.equal(embeddedIPv4("::ffff:127.0.0.1"), "127.0.0.1");
  assert.equal(embeddedIPv4("::ffff:7f00:1"), "127.0.0.1");
  assert.equal(embeddedIPv4("64:ff9b::10.0.0.1"), "10.0.0.1");
  assert.equal(embeddedIPv4("2002:7f00:1::"), "127.0.0.1");
  assert.equal(embeddedIPv4("2002:808:808::"), "8.8.8.8");
  assert.equal(embeddedIPv4("2001:4860:4860::8888"), null);
});

await check("blocks localhost and .local names without DNS", () => {
  assert.equal(isBlockedHostname("localhost"), true);
  assert.equal(isBlockedHostname("Foo.Localhost"), true);
  assert.equal(isBlockedHostname("printer.local"), true);
  assert.equal(isBlockedHostname("example.com"), false);
});

await check("assertSafeUrl rejects local IP literals and schemes", () => {
  assert.throws(() => assertSafeUrl("http://127.0.0.1/"), /restricted address/);
  assert.throws(() => assertSafeUrl("http://[::1]/"), /restricted address/);
  assert.throws(() => assertSafeUrl("http://[::ffff:127.0.0.1]/"), /restricted address/);
  assert.throws(() => assertSafeUrl("http://169.254.169.254/latest"), /restricted address/);
  assert.throws(() => assertSafeUrl("http://localhost/"), /restricted address/);
  assert.throws(() => assertSafeUrl("ftp://example.com/"), /http\/https/);
  assert.equal(assertSafeUrl("https://example.com/a").hostname, "example.com");
});

await check("rejects a hostname that resolves only to a private address", async () => {
  await assert.rejects(
    () =>
      resolvePublicAddresses(new URL("http://internal.example/"), async () => [
        { address: "192.168.1.10", family: 4 },
      ]),
    /restricted address/
  );
});

await check("rejects mixed public and private DNS records", async () => {
  await assert.rejects(
    () =>
      resolvePublicAddresses(new URL("http://dual.example/"), async () => [
        { address: "8.8.8.8", family: 4 },
        { address: "10.0.0.1", family: 4 },
      ]),
    /restricted address/
  );
});

await check("accepts a hostname whose records are all public", async () => {
  const records = await resolvePublicAddresses(
    new URL("http://cdn.example/"),
    async () => [{ address: "1.1.1.1", family: 4 }]
  );
  assert.deepEqual(records, [{ address: "1.1.1.1", family: 4 }]);
});

await check("does not connect when DNS resolves to loopback", async () => {
  let connected = false;
  await assert.rejects(
    () =>
      safeFetch("http://evil.example/secret", {
        maxBytes: 1024,
        lookup: async () => [{ address: "127.0.0.1", family: 4 }],
        transport: async () => {
          connected = true;
          throw new Error("should not connect");
        },
      }),
    /restricted address/
  );
  assert.equal(connected, false);
});

await check("does not connect when DNS resolves to link-local metadata", async () => {
  let connected = false;
  await assert.rejects(
    () =>
      safeFetch("http://metadata.example/", {
        maxBytes: 1024,
        lookup: async () => [{ address: "169.254.169.254", family: 4 }],
        transport: async () => {
          connected = true;
          throw new Error("should not connect");
        },
      }),
    /restricted address/
  );
  assert.equal(connected, false);
});

function publicLookup(map: Record<string, string>) {
  return async (hostname: string) => {
    const address = map[hostname];
    if (!address) throw new Error(`unexpected lookup ${hostname}`);
    return [{ address, family: (address.includes(":") ? 6 : 4) as 4 | 6 }];
  };
}

function scriptedTransport(
  seen: { url: string; ip: string }[],
  script: (url: URL) => HopResponse
) {
  return async (req: TransportRequest): Promise<HopResponse> => {
    seen.push({ url: req.url.toString(), ip: req.addresses[0]?.address ?? "" });
    return script(req.url);
  };
}

await check("follows a public redirect and pins each hop to its resolved IP", async () => {
  const seen: { url: string; ip: string }[] = [];
  const result = await safeFetch("https://shop.example/item", {
    maxBytes: 1024,
    lookup: publicLookup({
      "shop.example": "203.0.113.10",
      "cdn.example": "203.0.113.20",
    }),
    transport: scriptedTransport(seen, (url) => {
      if (url.hostname === "shop.example") {
        return {
          status: 302,
          headers: new Headers({ location: "https://cdn.example/img.jpg" }),
          body: Buffer.alloc(0),
        };
      }
      return {
        status: 200,
        headers: new Headers({ "content-type": "image/jpeg" }),
        body: Buffer.from("jpeg"),
      };
    }),
  });
  assert.equal(result.status, 200);
  assert.equal(result.finalUrl.hostname, "cdn.example");
  assert.equal(result.body.toString(), "jpeg");
  assert.deepEqual(seen, [
    { url: "https://shop.example/item", ip: "203.0.113.10" },
    { url: "https://cdn.example/img.jpg", ip: "203.0.113.20" },
  ]);
});

await check("rejects a redirect to a private IP without connecting", async () => {
  const seen: { url: string; ip: string }[] = [];
  await assert.rejects(
    () =>
      safeFetch("https://shop.example/item", {
        maxBytes: 1024,
        lookup: publicLookup({ "shop.example": "203.0.113.10" }),
        transport: scriptedTransport(seen, () => ({
          status: 302,
          headers: new Headers({ location: "http://169.254.169.254/latest" }),
          body: Buffer.alloc(0),
        })),
      }),
    /restricted address/
  );
  assert.deepEqual(
    seen.map((s) => s.url),
    ["https://shop.example/item"]
  );
});

await check("rejects a redirect to a name that resolves privately", async () => {
  const seen: { url: string; ip: string }[] = [];
  await assert.rejects(
    () =>
      safeFetch("https://shop.example/item", {
        maxBytes: 1024,
        lookup: async (hostname) => {
          if (hostname === "shop.example") return [{ address: "203.0.113.10", family: 4 }];
          if (hostname === "internal.example") return [{ address: "10.1.2.3", family: 4 }];
          throw new Error(`unexpected lookup ${hostname}`);
        },
        transport: scriptedTransport(seen, () => ({
          status: 301,
          headers: new Headers({ location: "https://internal.example/secret" }),
          body: Buffer.alloc(0),
        })),
      }),
    /restricted address/
  );
  assert.equal(seen.length, 1);
});

await check("rejects a redirect chain that exceeds the hop limit", async () => {
  await assert.rejects(
    () =>
      safeFetch("https://shop.example/a", {
        maxBytes: 1024,
        lookup: publicLookup({ "shop.example": "203.0.113.10" }),
        transport: async () => ({
          status: 302,
          headers: new Headers({ location: "https://shop.example/b" }),
          body: Buffer.alloc(0),
        }),
      }),
    /Too many redirects/
  );
});

await check("rejects file and javascript redirect targets", async () => {
  await assert.rejects(
    () =>
      safeFetch("https://shop.example/a", {
        maxBytes: 1024,
        lookup: publicLookup({ "shop.example": "203.0.113.10" }),
        transport: async () => ({
          status: 302,
          headers: new Headers({ location: "file:///etc/passwd" }),
          body: Buffer.alloc(0),
        }),
      }),
    /http\/https/
  );
});

if (failed > 0) {
  console.error(`\n${failed} safe-fetch check(s) failed.`);
  process.exit(1);
}
console.log("\nAll safe-fetch checks passed.");
}

void main();
