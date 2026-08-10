/**
 * Category registry consistency smoke tests.
 * Run: npx tsx scripts/test-categories.ts
 */
import assert from "node:assert/strict";
import {
  CATEGORY_LIST,
  CATEGORIES_BY_KEY,
  CATEGORIES_BY_SLUG,
  categoryByKey,
  categoryBySlug,
  specFieldKeys,
  type CategoryKey,
  type SpecRelation,
} from "../src/types/categories";
import { isReservedPathSegment, validateUsername } from "../src/lib/username";

const EXPECTED_KEYS: CategoryKey[] = [
  "guitar",
  "amp",
  "cab",
  "pedal",
  "multifx",
  "other",
];

const EXPECTED_RELATIONS: SpecRelation[] = [
  "guitarSpec",
  "ampSpec",
  "cabSpec",
  "pedalSpec",
  "multiFxSpec",
  "otherSpec",
];

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

check("registry has exactly the six product categories", () => {
  assert.equal(CATEGORY_LIST.length, 6);
  assert.deepEqual(
    CATEGORY_LIST.map((c) => c.key).sort(),
    [...EXPECTED_KEYS].sort()
  );
});

check("each category has unique key and slug", () => {
  const keys = CATEGORY_LIST.map((c) => c.key);
  const slugs = CATEGORY_LIST.map((c) => c.slug);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(new Set(slugs).size, slugs.length);
});

check("lookup maps cover every registry entry", () => {
  for (const cat of CATEGORY_LIST) {
    assert.equal(categoryByKey(cat.key)?.key, cat.key);
    assert.equal(categoryBySlug(cat.slug)?.slug, cat.slug);
    assert.equal(CATEGORIES_BY_KEY[cat.key].key, cat.key);
    assert.equal(CATEGORIES_BY_SLUG[cat.slug].slug, cat.slug);
  }
});

check("unknown key/slug lookups return null", () => {
  assert.equal(categoryByKey("nope"), null);
  assert.equal(categoryBySlug("not-a-category"), null);
});

check("each category has a distinct Prisma spec relation", () => {
  const relations = CATEGORY_LIST.map((c) => c.specRelation);
  assert.equal(new Set(relations).size, relations.length);
  for (const rel of EXPECTED_RELATIONS) {
    assert.ok(relations.includes(rel), `missing relation ${rel}`);
  }
});

check("each category has label, plural, finishLabel, and at least one spec field", () => {
  for (const cat of CATEGORY_LIST) {
    assert.ok(cat.label.trim().length > 0, `${cat.key} label`);
    assert.ok(cat.plural.trim().length > 0, `${cat.key} plural`);
    assert.ok(cat.finishLabel.trim().length > 0, `${cat.key} finishLabel`);
    assert.ok(cat.slug.trim().length > 0, `${cat.key} slug`);
    const fields = specFieldKeys(cat);
    assert.ok(fields.length > 0, `${cat.key} must declare spec fields`);
    assert.equal(new Set(fields).size, fields.length, `${cat.key} duplicate fields`);
  }
});

check("filter defs reference existing or shared-style keys (non-empty)", () => {
  for (const cat of CATEGORY_LIST) {
    for (const filter of cat.filters) {
      assert.ok(filter.param.trim().length > 0, `${cat.key} filter.param`);
      assert.ok(filter.label.trim().length > 0, `${cat.key} filter.label`);
      assert.ok(filter.specKeys.length > 0, `${cat.key} filter.specKeys`);
    }
  }
});

check("category slugs and keys are reserved usernames / path segments", () => {
  for (const cat of CATEGORY_LIST) {
    assert.equal(isReservedPathSegment(cat.slug), true, `slug ${cat.slug}`);
    assert.equal(isReservedPathSegment(cat.key), true, `key ${cat.key}`);
    assert.ok(validateUsername(cat.slug) !== null, `username reserved: ${cat.slug}`);
    assert.ok(validateUsername(cat.key) !== null, `username reserved: ${cat.key}`);
  }
});

check("slugs are URL-safe lowercase segments", () => {
  for (const cat of CATEGORY_LIST) {
    assert.match(cat.slug, /^[a-z0-9-]+$/);
  }
});

if (failed > 0) {
  console.error(`\n${failed} category check(s) failed.`);
  process.exit(1);
}
console.log("\nAll category registry checks passed.");
