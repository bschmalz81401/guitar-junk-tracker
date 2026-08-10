/**
 * Unit tests for CSV import parsing.
 * Run: npx tsx scripts/test-csv-import.ts
 */
import assert from "node:assert/strict";
import { itemsToCsv } from "../src/lib/csvExport";
import {
  parseCollectionCsv,
  parseCsv,
  parseModsColumn,
  MAX_IMPORT_ROWS,
} from "../src/lib/csvImport";
import type { ItemWithRelations } from "../src/lib/items";

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

check("parseCsv handles quoted commas", () => {
  const rows = parseCsv('a,b\n"hello, world",x\n');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], ["a", "b"]);
  assert.deepEqual(rows[1], ["hello, world", "x"]);
});

check("parseCsv strips BOM", () => {
  const rows = parseCsv("\uFEFFname,brand\nA,B\n");
  assert.equal(rows[0][0], "name");
});

check("parseModsColumn reads export format", () => {
  const mods = parseModsColumn("2020-01-15: New pups | 2021-06-01: Refret");
  assert.equal(mods.length, 2);
  assert.equal(mods[0].description, "New pups");
  assert.equal(mods[1].description, "Refret");
});

check("parseCollectionCsv requires core columns", () => {
  const r = parseCollectionCsv("foo,bar\n1,2\n");
  assert.equal(r.items.length, 0);
  assert.ok(r.errors.some((e) => e.message.includes("category")));
});

check("parseCollectionCsv creates valid guitar row", () => {
  const csv = [
    "category,name,brand,model,status,pricePaid,pricePaidPublic,bodyWood,trueBypass",
    "guitar,Strat,Fender,Player,owned,1200,false,Alder,",
  ].join("\n");
  const r = parseCollectionCsv(csv);
  assert.equal(r.errors.length, 0, JSON.stringify(r.errors));
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].category.key, "guitar");
  assert.equal(r.items[0].name, "Strat");
  assert.equal(r.items[0].pricePaid, 1200);
  assert.equal(r.items[0].pricePaidPublic, false);
  assert.equal(r.items[0].specData.bodyWood, "Alder");
});

check("parseCollectionCsv rejects bad category", () => {
  const csv = "category,name,brand,model\nbogus,A,B,C\n";
  const r = parseCollectionCsv(csv);
  assert.equal(r.items.length, 0);
  assert.equal(r.errors.length, 1);
});

check("parseCollectionCsv boolean false is not treated as true", () => {
  const csv = [
    "category,name,brand,model,trueBypass",
    "pedal,TS9,Ibanez,Tube Screamer,false",
  ].join("\n");
  const r = parseCollectionCsv(csv);
  assert.equal(r.errors.length, 0, JSON.stringify(r.errors));
  assert.equal(r.items[0].specData.trueBypass, false);
});

check("round-trip: export headers parse as importable row", () => {
  const fakeItem = {
    id: 1,
    userId: 1,
    category: "guitar",
    name: "Les Paul",
    brand: "Gibson",
    model: "Standard",
    series: null,
    finishColor: "Sunburst",
    dateAcquired: new Date("2019-05-01T00:00:00.000Z"),
    acquisitionSource: "GC",
    pricePaid: 2499,
    pricePaidPublic: false,
    serialNumber: "ABC",
    serialNumberPublic: false,
    status: "owned",
    notes: "Keep",
    createdAt: new Date(),
    updatedAt: new Date(),
    photos: [{ id: 1 }],
    mods: [{ date: new Date("2020-01-01T00:00:00.000Z"), description: "Setup" }],
    guitarSpec: {
      id: 1,
      itemId: 1,
      bodyWood: "Mahogany",
      neckWood: "Mahogany",
    },
  } as unknown as ItemWithRelations;

  const csv = itemsToCsv([fakeItem]);
  const r = parseCollectionCsv(csv);
  assert.equal(r.errors.length, 0, JSON.stringify(r.errors));
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].name, "Les Paul");
  assert.equal(r.items[0].brand, "Gibson");
  assert.equal(r.items[0].specData.bodyWood, "Mahogany");
  assert.equal(r.items[0].mods.length, 1);
  assert.equal(r.items[0].mods[0].description, "Setup");
  // id from export is not required for create payload
  assert.ok(r.items[0].pricePaidPublic === false);
});

check("MAX_IMPORT_ROWS is enforced", () => {
  assert.ok(MAX_IMPORT_ROWS >= 100);
  const header = "category,name,brand,model\n";
  const lines = Array.from(
    { length: MAX_IMPORT_ROWS + 1 },
    (_, i) => `guitar,N${i},B,M\n`
  ).join("");
  const r = parseCollectionCsv(header + lines);
  assert.equal(r.items.length, 0);
  assert.ok(r.errors[0]?.message.includes("Too many rows"));
});

if (failed > 0) {
  console.error(`\n${failed} csv-import check(s) failed.`);
  process.exit(1);
}
console.log("\nAll csv-import checks passed.");
