/**
 * Unit tests for item duplicate helpers.
 * Run: npx tsx scripts/test-item-duplicate.ts
 */
import assert from "node:assert/strict";
import {
  cleanSpecForDuplicate,
  duplicateItemName,
} from "../src/lib/itemDuplicate";

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

check("duplicateItemName appends (copy)", () => {
  assert.equal(duplicateItemName("Strat"), "Strat (copy)");
});

check("duplicateItemName increments numbered copies", () => {
  assert.equal(duplicateItemName("Strat (copy)"), "Strat (copy 2)");
  assert.equal(duplicateItemName("Strat (copy 2)"), "Strat (copy 3)");
});

check("cleanSpecForDuplicate strips id and itemId", () => {
  const cleaned = cleanSpecForDuplicate({
    id: 9,
    itemId: 3,
    bodyWood: "Alder",
    trueBypass: false,
    createdAt: "nope",
  });
  assert.deepEqual(cleaned, { bodyWood: "Alder", trueBypass: false });
});

check("cleanSpecForDuplicate handles null/empty", () => {
  assert.deepEqual(cleanSpecForDuplicate(null), {});
  assert.deepEqual(cleanSpecForDuplicate(undefined), {});
});

if (failed > 0) {
  console.error(`\n${failed} duplicate check(s) failed.`);
  process.exit(1);
}
console.log("\nAll item-duplicate checks passed.");
