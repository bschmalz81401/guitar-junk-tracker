/**
 * Smoke tests for parseSpecText fixtures + product lookup extraction.
 * Run: npx tsx scripts/test-parser.ts
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { parseSpecText } from "../src/lib/specParser";
import { categoryByKey, type CategoryKey } from "../src/types/categories";
import {
  extractProductFields,
  inferFieldsFromProductUrl,
} from "../src/lib/productLookup";

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
  {
    // Amazon product-info table shape (tabs) — also used via full-page extract below.
    file: "amazon-mustang-paste.txt",
    category: "amp",
    fields: {
      brand: "Fender",
      model: "Mustang LT25",
      wattage: 25,
      weightLbs: 15,
      finishColor: "Black",
      formFactor: "Combo",
      ampType: "Solid state",
    },
  },
];

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    failed++;
  } else {
    console.log(`OK   ${msg}`);
  }
}

for (const c of CASES) {
  const cat = categoryByKey(c.category);
  if (!cat) {
    console.error(`FAIL ${c.file}: unknown category ${c.category}`);
    failed++;
    continue;
  }
  const text = readFileSync(join(FIXTURES, c.file), "utf8");
  const result = parseSpecText(text, cat);
  let caseFailed = 0;
  for (const [key, expected] of Object.entries(c.fields)) {
    const actual = result[key];
    if (actual !== expected) {
      console.error(
        `FAIL ${c.file} ${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
      );
      failed++;
      caseFailed++;
    }
  }
  // Dimensions must NOT be misread as a 2x12 speaker config.
  if (c.file === "amazon-mustang-paste.txt") {
    if (result.speakerCount === 2 && result.speakerSize === '12"') {
      console.error(
        `FAIL ${c.file}: product dimensions were misread as 2x12 speakers`
      );
      failed++;
      caseFailed++;
    }
  }
  if (caseFailed === 0) {
    console.log(`OK   ${c.file} (${Object.keys(result).length} fields)`);
  }
}

// URL slug hints — Sweetwater
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

// Amazon URL must not treat ASIN / "dp" as brand/model/name
const amazonUrl =
  "https://www.amazon.com/Fender-Mustang-LT25-Guitar-Amplifier/dp/B08HHRJ2R9";
const amazonHints = inferFieldsFromProductUrl(amazonUrl, amp);
assert(
  amazonHints.brand !== "Dp" && amazonHints.model !== "B08HHRJ2R9" && amazonHints.name !== "B08HHRJ2R9",
  "amazon URL does not use ASIN/dp as identity"
);
assert(
  typeof amazonHints.brand === "string" && /fender/i.test(amazonHints.brand),
  `amazon URL brand from slug (got ${JSON.stringify(amazonHints.brand)})`
);
assert(
  typeof amazonHints.name === "string" && /mustang/i.test(String(amazonHints.name)),
  `amazon URL name from slug (got ${JSON.stringify(amazonHints.name)})`
);

// Full browser-capture extract for Amazon paste
const amazonPaste = readFileSync(join(FIXTURES, "amazon-mustang-paste.txt"), "utf8");
const extracted = extractProductFields({
  category: amp,
  url: amazonUrl,
  text: amazonPaste,
});
const f = extracted.fields;
assert(
  typeof f.name === "string" &&
    /fender/i.test(String(f.name)) &&
    /mustang/i.test(String(f.name)) &&
    !/\$/.test(String(f.name)),
  `amazon extract name is clean (got ${JSON.stringify(f.name)})`
);
assert(f.brand === "Fender", `amazon extract brand Fender (got ${JSON.stringify(f.brand)})`);
assert(
  typeof f.model === "string" && /mustang/i.test(String(f.model)) && !/^B0/i.test(String(f.model)),
  `amazon extract model not ASIN (got ${JSON.stringify(f.model)})`
);
assert(f.wattage === 25, `amazon extract wattage 25 (got ${JSON.stringify(f.wattage)})`);
assert(f.weightLbs === 15, `amazon extract weight 15 (got ${JSON.stringify(f.weightLbs)})`);
assert(f.formFactor === "Combo", `amazon extract combo (got ${JSON.stringify(f.formFactor)})`);
assert(
  !(f.speakerCount === 2 && f.speakerSize === '12"'),
  "amazon extract does not treat dimensions as 2x12"
);
assert(
  typeof f.finishColor === "string" && /^black$/i.test(String(f.finishColor)),
  `amazon extract color Black (got ${JSON.stringify(f.finishColor)})`
);

// Price glued onto a short title line should be stripped
const priced = extractProductFields({
  category: amp,
  url: amazonUrl,
  text: "Marshall JVM410H 100W Tube Head $1,499.00\nVisit the Marshall Store\nPower Output: 100W\nForm Factor: Head\n",
});
assert(
  typeof priced.fields.name === "string" &&
    !/\$/.test(String(priced.fields.name)) &&
    /marshall/i.test(String(priced.fields.name)),
  `price stripped from title (got ${JSON.stringify(priced.fields.name)})`
);
assert(
  priced.fields.brand === "Marshall" || /marshall/i.test(String(priced.fields.brand)),
  `priced paste brand (got ${JSON.stringify(priced.fields.brand)})`
);

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
