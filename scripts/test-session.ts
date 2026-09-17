/**
 * Session token encoding and password-change revocation.
 * Run: npx tsx scripts/test-session.ts
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  decodeSessionToken,
  encodeSessionToken,
  passwordChangeData,
} from "../src/lib/auth";

const secret = "test-session-secret-not-for-prod";
const now = 1_700_000_000_000;
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

check("new tokens round-trip with a session version", () => {
  const token = encodeSessionToken(
    { userId: 7, expires: now + 60_000, sessionVersion: 3 },
    secret
  );
  const claims = decodeSessionToken(token, secret, now);
  assert.deepEqual(claims, { userId: 7, expires: now + 60_000, sessionVersion: 3 });
});

check("legacy three-part tokens are accepted as version 0", () => {
  const payload = `4.${now + 60_000}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  const token = `${payload}.${sig}`;
  const claims = decodeSessionToken(token, secret, now);
  assert.deepEqual(claims, { userId: 4, expires: now + 60_000, sessionVersion: 0 });
});

check("expired tokens are rejected", () => {
  const token = encodeSessionToken(
    { userId: 1, expires: now - 1, sessionVersion: 0 },
    secret
  );
  assert.equal(decodeSessionToken(token, secret, now), null);
});

check("tampered tokens are rejected", () => {
  const token = encodeSessionToken(
    { userId: 1, expires: now + 60_000, sessionVersion: 1 },
    secret
  );
  const bits = token.split(".");
  bits[0] = "2";
  assert.equal(decodeSessionToken(bits.join("."), secret, now), null);
});

check("wrong secret is rejected", () => {
  const token = encodeSessionToken(
    { userId: 1, expires: now + 60_000, sessionVersion: 1 },
    secret
  );
  assert.equal(decodeSessionToken(token, "other-secret", now), null);
});

check("passwordChangeData increments sessionVersion with the hash", () => {
  assert.deepEqual(passwordChangeData("hash"), {
    passwordHash: "hash",
    sessionVersion: { increment: 1 },
  });
});

function assertUsesPasswordChangeData(relativePath: string) {
  const src = readFileSync(join(__dirname, "..", relativePath), "utf8");
  assert.match(src, /passwordChangeData\(/);
  assert.equal(
    /passwordHash:\s*hashPassword\(/.test(src) && !src.includes("passwordChangeData"),
    false
  );
}

check("profile password change uses passwordChangeData and clears the cookie", () => {
  const src = readFileSync(
    join(__dirname, "..", "src/app/api/profile/route.ts"),
    "utf8"
  );
  assert.match(src, /passwordChangeData\(hashPassword\(newPassword\)\)/);
  assert.match(src, /clearSessionCookie\(response\)/);
});

check("reset-password uses passwordChangeData", () => {
  assertUsesPasswordChangeData("src/app/api/auth/reset-password/route.ts");
});

check("admin password change uses passwordChangeData", () => {
  assertUsesPasswordChangeData("src/app/api/admin/users/[id]/route.ts");
});

check("getSessionUser rejects a mismatched sessionVersion", () => {
  const src = readFileSync(join(__dirname, "..", "src/lib/auth.ts"), "utf8");
  assert.match(src, /user\.sessionVersion !== parsed\.sessionVersion/);
});

check("migration adds sessionVersion with default 0", () => {
  const sql = readFileSync(
    join(
      __dirname,
      "..",
      "prisma/migrations/20260917140000_session_version/migration.sql"
    ),
    "utf8"
  );
  assert.match(sql, /ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0/);
});

if (failed > 0) {
  console.error(`\n${failed} session check(s) failed.`);
  process.exit(1);
}
console.log("\nAll session checks passed.");
