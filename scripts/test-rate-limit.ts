/**
 * Unit tests for rate limiting and origin checks.
 * Run: npx tsx scripts/test-rate-limit.ts
 */
import assert from "node:assert/strict";
import { createRateLimitStore } from "../src/lib/rateLimit";
import { getClientIp, rejectCrossOrigin } from "../src/lib/requestSecurity";
import { NextRequest } from "next/server";

let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`OK   ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(err);
  }
}

check("rate limit allows under the cap", () => {
  const store = createRateLimitStore();
  const now = 1_000_000;
  for (let i = 0; i < 3; i++) {
    const r = store.check("k", 3, 60_000, now);
    assert.equal(r.ok, true);
  }
});

check("rate limit blocks over the cap", () => {
  const store = createRateLimitStore();
  const now = 2_000_000;
  store.check("k", 2, 60_000, now);
  store.check("k", 2, 60_000, now);
  const blocked = store.check("k", 2, 60_000, now);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.ok(blocked.retryAfterSec >= 1);
  }
});

check("rate limit window resets", () => {
  const store = createRateLimitStore();
  const now = 3_000_000;
  store.check("k", 1, 1000, now);
  const blocked = store.check("k", 1, 1000, now + 100);
  assert.equal(blocked.ok, false);
  const after = store.check("k", 1, 1000, now + 1001);
  assert.equal(after.ok, true);
});

check("getClientIp prefers X-Forwarded-For first hop", () => {
  const req = new NextRequest("http://localhost/api/auth/login", {
    headers: {
      "x-forwarded-for": "203.0.113.9, 10.0.0.1",
      "x-real-ip": "10.0.0.2",
    },
  });
  assert.equal(getClientIp(req), "203.0.113.9");
});

check("rejectCrossOrigin allows matching host", () => {
  const req = new NextRequest("http://app.example.com/api/auth/login", {
    method: "POST",
    headers: {
      host: "app.example.com",
      origin: "http://app.example.com",
    },
  });
  assert.equal(rejectCrossOrigin(req), null);
});

check("rejectCrossOrigin blocks mismatched origin", () => {
  const req = new NextRequest("http://app.example.com/api/auth/login", {
    method: "POST",
    headers: {
      host: "app.example.com",
      origin: "https://evil.example",
    },
  });
  const res = rejectCrossOrigin(req);
  assert.ok(res);
  assert.equal(res?.status, 403);
});

check("rejectCrossOrigin skips when Origin absent", () => {
  const req = new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { host: "localhost:3000" },
  });
  assert.equal(rejectCrossOrigin(req), null);
});

if (failed > 0) {
  console.error(`\n${failed} rate-limit check(s) failed.`);
  process.exit(1);
}
console.log("\nAll rate-limit checks passed.");
