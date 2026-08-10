/**
 * Privacy rules for public catalogs and sensitive ownership fields.
 * Run: npx tsx scripts/test-privacy.ts
 */
import assert from "node:assert/strict";
import {
  canRevealPricePaid,
  canRevealSerialNumber,
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
