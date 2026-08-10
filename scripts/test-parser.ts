/**
 * Smoke tests for parseSpecText fixtures.
 * Run: npx tsx scripts/test-parser.ts
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { parseSpecText } from "../src/lib/specParser";
import { categoryByKey, type CategoryKey } from "../src/types/categories";
import { inferFieldsFromProductUrl } from "../src/lib/productLookup";

const FIXTURES = join(__dirname, "../src/lib/parser/fixtures");

type Expect = {
  file: string;
  category: CategoryKey;
  fields: Record<string, string | number | boolean>;
};

const CASES: Expect[] = [
  {
    file: "amp-marshall.txt",
    category: "amp",
    fields: {
      formFactor: "Head",
      wattage: 100,
      channels: 4,
      effectsLoop: true,
      masterVolume: true,
      midi: true,
    },
  },
  {
    file: "pedal-tube-screamer.txt",
    category: "pedal",
    fields: {
      effectType: "Overdrive",
      circuitType: "Analog",
      trueBypass: false,
      currentDraw: 8,
      batteryOption: true,
    },
  },
  {
    file: "multifx-helix.txt",
    category: "multifx",
    fields: {
      ampModels: "87",
      effectModels: "231",
      snapshots: "8 per preset",
      midi: "MIDI In/Out/Thru",
    },
  },
];

let failed = 0;

for (const c of CASES) {
  const cat = categoryByKey(c.category);
  if (!cat) {
    console.error(`FAIL ${c.file}: unknown category ${c.category}`);
    failed++;
    continue;
  }
  const text = readFileSync(join(FIXTURES, c.file), "utf8");
  const result = parseSpecText(text, cat);
  for (const [key, expected] of Object.entries(c.fields)) {
    const actual = result[key];
    if (actual !== expected) {
      console.error(
        `FAIL ${c.file} ${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
      );
      failed++;
    }
  }
  if (failed === 0 || Object.keys(c.fields).every((k) => result[k] === c.fields[k])) {
    console.log(`OK   ${c.file} (${Object.keys(result).length} fields)`);
  }
}

// URL slug hints
const amp = categoryByKey("amp")!;
const urlFields = inferFieldsFromProductUrl(
  "https://www.sweetwater.com/store/detail/JVM410H--marshall-jvm410h-100-watt-tube-guitar-amp-head",
  amp
);
if (urlFields.brand !== "Marshall" && !String(urlFields.name || "").includes("Marshall")) {
  console.error("FAIL urlHints: expected Marshall brand/name from Sweetwater slug", urlFields);
  failed++;
} else {
  console.log("OK   sweetwater URL slug hints");
}

// Ensure fixtures dir only has known files (no orphans accidentally ignored)
const files = readdirSync(FIXTURES).filter((f) => f.endsWith(".txt"));
const expectedFiles = new Set(CASES.map((c) => c.file));
for (const f of files) {
  if (!expectedFiles.has(f)) {
    console.warn(`WARN fixture not covered by CASES: ${f}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll parser fixture checks passed.");
