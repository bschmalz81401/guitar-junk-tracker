/**
 * Privacy rules for public catalogs and sensitive ownership fields.
 * Run: npx tsx scripts/test-privacy.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canRevealPricePaid,
  canRevealSerialNumber,
  guestVisibleCategoryCounts,
  isCatalogPubliclyAccessible,
} from "../src/lib/privacy";
import { parseItemBody } from "../src/lib/itemBody";

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

check("private catalog is not publicly accessible", () => {
  assert.equal(isCatalogPubliclyAccessible(false), false);
  assert.equal(isCatalogPubliclyAccessible(undefined), false);
  assert.equal(isCatalogPubliclyAccessible(null), false);
});

check("opt-in catalog is publicly accessible", () => {
  assert.equal(isCatalogPubliclyAccessible(true), true);
});

check("private showcase catalogs do not expose category counts", () => {
  assert.deepEqual(
    guestVisibleCategoryCounts(false, { guitar: 4, amp: 2 }, ["guitar", "amp", "cab"]),
    { guitar: 0, amp: 0, cab: 0 }
  );
});

check("public showcase catalogs may show category counts", () => {
  assert.deepEqual(
    guestVisibleCategoryCounts(true, { guitar: 4 }, ["guitar", "amp"]),
    { guitar: 4, amp: 0 }
  );
});

check("Next.js proxy.ts replaces deprecated middleware.ts", () => {
  const root = join(__dirname, "..", "src");
  assert.equal(existsSync(join(root, "middleware.ts")), false);
  const src = readFileSync(join(root, "proxy.ts"), "utf8");
  assert.match(src, /export function proxy\(/);
  assert.equal(/export function middleware\(/.test(src), false);
});

check("home page uses guestVisibleCategoryCounts for the landing grid", () => {
  const src = readFileSync(
    join(__dirname, "..", "src/app/page.tsx"),
    "utf8"
  );
  assert.match(src, /guestVisibleCategoryCounts\(/);
  assert.match(src, /isPublic && showcase/);
});

check("guest cannot see price when pricePaidPublic is false", () => {
  assert.equal(
    canRevealPricePaid({
      viewerIsOwner: false,
      pricePaid: 1500,
      pricePaidPublic: false,
    }),
    false
  );
});

check("guest can see price when pricePaidPublic is true", () => {
  assert.equal(
    canRevealPricePaid({
      viewerIsOwner: false,
      pricePaid: 1500,
      pricePaidPublic: true,
    }),
    true
  );
});

check("owner can see price when private flag is false", () => {
  assert.equal(
    canRevealPricePaid({
      viewerIsOwner: true,
      pricePaid: 1500,
      pricePaidPublic: false,
    }),
    true
  );
});

check("missing price is never revealed", () => {
  assert.equal(
    canRevealPricePaid({
      viewerIsOwner: true,
      pricePaid: null,
      pricePaidPublic: true,
    }),
    false
  );
  assert.equal(
    canRevealPricePaid({
      viewerIsOwner: false,
      pricePaid: null,
      pricePaidPublic: true,
    }),
    false
  );
});

check("guest cannot see serial when serialNumberPublic is false", () => {
  assert.equal(
    canRevealSerialNumber({
      viewerIsOwner: false,
      serialNumber: "ABC123",
      serialNumberPublic: false,
    }),
    false
  );
});

check("guest can see serial when serialNumberPublic is true", () => {
  assert.equal(
    canRevealSerialNumber({
      viewerIsOwner: false,
      serialNumber: "ABC123",
      serialNumberPublic: true,
    }),
    true
  );
});

check("owner can see serial when private flag is false", () => {
  assert.equal(
    canRevealSerialNumber({
      viewerIsOwner: true,
      serialNumber: "ABC123",
      serialNumberPublic: false,
    }),
    true
  );
});

check("empty serial is never revealed", () => {
  assert.equal(
    canRevealSerialNumber({
      viewerIsOwner: true,
      serialNumber: "",
      serialNumberPublic: true,
    }),
    false
  );
  assert.equal(
    canRevealSerialNumber({
      viewerIsOwner: false,
      serialNumber: null,
      serialNumberPublic: true,
    }),
    false
  );
});

check("parseItemBody defaults privacy flags to false (private by default)", () => {
  const result = parseItemBody({
    category: "guitar",
    name: "Strat",
    brand: "Fender",
    model: "Player",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.pricePaidPublic, false);
  assert.equal(result.data.serialNumberPublic, false);
});

check("parseItemBody accepts explicit public flags", () => {
  const result = parseItemBody({
    category: "guitar",
    name: "Strat",
    brand: "Fender",
    model: "Player",
    pricePaidPublic: true,
    serialNumberPublic: true,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.pricePaidPublic, true);
  assert.equal(result.data.serialNumberPublic, true);
});

if (failed > 0) {
  console.error(`\n${failed} privacy check(s) failed.`);
  process.exit(1);
}
console.log("\nAll privacy checks passed.");
