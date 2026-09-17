/**
 * Password-reset origin must come from APP_PUBLIC_ORIGIN, never from the request.
 * Run: npx tsx scripts/test-password-reset.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import {
  passwordResetMailContent,
  publicAppOrigin,
  resetPasswordUrl,
  sendPasswordResetForUser,
} from "../src/lib/passwordReset";

const root = join(__dirname, "..");
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

function env(origin?: string): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = { ...process.env };
  if (origin === undefined) {
    delete next.APP_PUBLIC_ORIGIN;
  } else {
    next.APP_PUBLIC_ORIGIN = origin;
  }
  return next;
}

check("uses APP_PUBLIC_ORIGIN as the reset origin", () => {
  assert.equal(
    publicAppOrigin(env("https://gear.example.com")),
    "https://gear.example.com"
  );
});

check("strips a trailing slash from the configured origin", () => {
  assert.equal(
    publicAppOrigin(env("https://gear.example.com/")),
    "https://gear.example.com"
  );
});

check("keeps an explicit port", () => {
  assert.equal(
    publicAppOrigin(env("http://192.168.1.10:3131")),
    "http://192.168.1.10:3131"
  );
});

check("trims surrounding whitespace", () => {
  assert.equal(
    publicAppOrigin(env("  http://localhost:3000  ")),
    "http://localhost:3000"
  );
});

check("rejects a missing APP_PUBLIC_ORIGIN", () => {
  assert.throws(() => publicAppOrigin(env()), /APP_PUBLIC_ORIGIN/);
});

check("rejects an empty APP_PUBLIC_ORIGIN", () => {
  assert.throws(() => publicAppOrigin(env("   ")), /APP_PUBLIC_ORIGIN/);
});

check("rejects a non-URL value", () => {
  assert.throws(() => publicAppOrigin(env("not a url")), /origin like/);
});

check("rejects a non-http scheme", () => {
  assert.throws(() => publicAppOrigin(env("ftp://gear.example.com")), /origin like/);
});

check("rejects credentials in the origin", () => {
  assert.throws(
    () => publicAppOrigin(env("https://user:pass@gear.example.com")),
    /origin like/
  );
});

check("rejects a path on the origin", () => {
  assert.throws(
    () => publicAppOrigin(env("https://gear.example.com/reset-password")),
    /origin like/
  );
});

check("rejects a query string on the origin", () => {
  assert.throws(
    () => publicAppOrigin(env("https://gear.example.com?next=/")),
    /origin like/
  );
});

check("rejects a fragment on the origin", () => {
  assert.throws(
    () => publicAppOrigin(env("https://gear.example.com#x")),
    /origin like/
  );
});

check("reset URL is built from APP_PUBLIC_ORIGIN and the token", () => {
  assert.equal(
    resetPasswordUrl("abc123", env("https://gear.example.com")),
    "https://gear.example.com/reset-password?token=abc123"
  );
});

check("sendPasswordResetForUser does not accept a request-derived origin", () => {
  assert.equal(sendPasswordResetForUser.length, 1);
});

check("reset mail uses APP_PUBLIC_ORIGIN even when a request carries a forwarded host", () => {
  const configured = env("https://gear.example.com");
  const request = new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
      origin: "https://evil.example",
    },
  });
  const mail = passwordResetMailContent("deadbeef", configured);
  assert.equal(
    mail.resetUrl,
    "https://gear.example.com/reset-password?token=deadbeef"
  );
  assert.equal(mail.text.includes("https://gear.example.com/reset-password?token=deadbeef"), true);
  assert.equal(mail.html.includes("https://gear.example.com/reset-password?token=deadbeef"), true);
  assert.equal(mail.resetUrl.includes("evil.example"), false);
  assert.equal(mail.text.includes("evil.example"), false);
  assert.equal(mail.html.includes("evil.example"), false);
  assert.notEqual(mail.resetUrl, `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}/reset-password?token=deadbeef`);
  assert.notEqual(mail.resetUrl.startsWith(new URL(request.url).origin), true);
});

function assertRouteIgnoresForwardedHeaders(relativePath: string) {
  const src = readFileSync(join(root, relativePath), "utf8");
  assert.equal(
    src.includes("requestOrigin"),
    false,
    `${relativePath} still references requestOrigin`
  );
  assert.equal(
    /x-forwarded-host/i.test(src),
    false,
    `${relativePath} still reads X-Forwarded-Host`
  );
  assert.equal(
    /x-forwarded-proto/i.test(src),
    false,
    `${relativePath} still reads X-Forwarded-Proto`
  );
}

check("forgot-password route does not read forwarded host headers", () => {
  assertRouteIgnoresForwardedHeaders("src/app/api/auth/forgot-password/route.ts");
});

check("admin reset route does not read forwarded host headers", () => {
  assertRouteIgnoresForwardedHeaders("src/app/api/admin/users/[id]/route.ts");
});

check("passwordReset helper no longer derives origin from the request", () => {
  const src = readFileSync(join(root, "src/lib/passwordReset.ts"), "utf8");
  assert.equal(src.includes("x-forwarded-host"), false);
  assert.equal(src.includes("x-forwarded-proto"), false);
  assert.equal(src.includes("requestOrigin"), false);
  assert.match(src, /passwordResetMailContent\(rawToken\)/);
});

check("forgot-password calls sendPasswordResetForUser with only the user", () => {
  const src = readFileSync(
    join(root, "src/app/api/auth/forgot-password/route.ts"),
    "utf8"
  );
  assert.match(src, /sendPasswordResetForUser\(\s*user\s*\)/);
  assert.equal(/sendPasswordResetForUser\s*\([^;]*request/.test(src), false);
});

check("admin reset calls sendPasswordResetForUser with only the user", () => {
  const src = readFileSync(
    join(root, "src/app/api/admin/users/[id]/route.ts"),
    "utf8"
  );
  assert.match(src, /sendPasswordResetForUser\(\s*\{/);
  assert.equal(/sendPasswordResetForUser\s*\([^;]*request/.test(src), false);
});

if (failed > 0) {
  console.error(`\n${failed} password-reset check(s) failed.`);
  process.exit(1);
}
console.log("\nAll password-reset checks passed.");
