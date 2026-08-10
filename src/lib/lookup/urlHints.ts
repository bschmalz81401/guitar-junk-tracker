import type { CategoryDef } from "@/types/categories";
import { parseSpecText } from "@/lib/specParser";
import type { LookupFields } from "@/lib/lookup/types";
import { inferBrandModel } from "@/lib/lookup/brands";
import { PAGE_CHROME_LINE, PAGE_CHROME_CONTAINS } from "@/lib/lookup/paste";

function titleCaseWords(words: string): string {
  return words
    .split(/\s+/)
    .map((w) => {
      // Keep model-ish tokens (JVM410H, AC30, LT25) mostly intact when mixed case/digits.
      if (/[A-Z]{2,}\d/i.test(w) || /\d/.test(w)) {
        // Prefer preserving common model casing: LT25, JVM410H
        if (/^[a-z]+\d/i.test(w) && w.length <= 12) {
          return w.replace(/^([a-z]+)/i, (m) => m.toUpperCase());
        }
        return w.toUpperCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/** Amazon / marketplace ASIN (e.g. B08HHRJ2R9). */
const ASIN_RE = /^B0[A-Z0-9]{8}$/i;

/** Path segments that are never brand/product names. */
const PATH_NOISE =
  /^(store|product|products|p|item|items|detail|details|dp|gp|d|asin|sku|ref|sspa|b|s|hz|gpproduct)$/i;

export function isGarbageProductName(name: string): boolean {
  const n = name.trim();
  if (n.length < 4 || n.length > 160) return true;
  if (ASIN_RE.test(n)) return true;
  if (/^\$[\d,.]+/.test(n)) return true;
  if (PAGE_CHROME_LINE.test(n) || PAGE_CHROME_CONTAINS.test(n)) return true;
  if (/skip\s+to/i.test(n)) return true;
  if (/contact\s+us|accessibility|cookie|sign\s+in/i.test(n) && n.length < 80) return true;
  // Glued chrome dump still on one line
  if ((n.match(/skip\s+to/gi) || []).length >= 1 && n.length > 30) return true;
  // Bare path noise
  if (PATH_NOISE.test(n)) return true;
  // Price-heavy marketing noise
  if ((n.match(/\$\s*[\d,.]+/g) || []).length >= 1 && n.length < 40) return true;
  return false;
}

/** True when a brand/model hint from a URL slug is unusable. */
export function isGarbageBrandOrModel(value: string): boolean {
  const v = value.trim();
  if (v.length < 2 || v.length > 80) return true;
  if (ASIN_RE.test(v)) return true;
  if (PATH_NOISE.test(v)) return true;
  if (/^\$/.test(v)) return true;
  if (/^(dp|gp|asin|ref|new|used|renewed)$/i.test(v)) return true;
  return false;
}

function slugToWords(slug: string): string {
  return slug
    .replace(/\.html?$/i, "")
    .replace(/\.gc$/i, "")
    .replace(/\.htm$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Amazon product URLs:
 *   /Brand-Product-Name-Words/dp/ASIN
 *   /dp/ASIN
 *   /gp/product/ASIN
 *   /gp/aw/d/ASIN
 * Never treat the ASIN or the "dp" segment as brand/model/name.
 */
function amazonUrlHints(parsed: URL, category: CategoryDef): LookupFields {
  const fields: LookupFields = {
    acquisitionSource: parsed.hostname.replace(/^www\./, ""),
  };

  const segs = parsed.pathname.split("/").filter(Boolean);
  let asin: string | null = null;
  let nameSlug: string | null = null;

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (/^(dp|product)$/i.test(seg) && segs[i + 1] && ASIN_RE.test(segs[i + 1])) {
      asin = segs[i + 1];
      // Prefer the path segment immediately before /dp/
      if (i > 0 && !PATH_NOISE.test(segs[i - 1]) && !ASIN_RE.test(segs[i - 1])) {
        nameSlug = segs[i - 1];
      }
      break;
    }
    if (/^aw$/i.test(seg) && segs[i + 1] && /^d$/i.test(segs[i + 1]) && segs[i + 2] && ASIN_RE.test(segs[i + 2])) {
      asin = segs[i + 2];
      break;
    }
  }

  // Query-string ASIN fallback
  if (!asin) {
    const q = parsed.searchParams.get("asin") || parsed.searchParams.get("ASIN");
    if (q && ASIN_RE.test(q)) asin = q;
  }

  if (nameSlug) {
    // Drop trailing marketplace noise tokens that Amazon appends to slugs.
    const words = slugToWords(nameSlug)
      .replace(
        /\b(with|and|for|the|a|an|by|pack|set|bundle|renewed|refurbished|open\s+box)\b/gi,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();
    // Keep enough of the product title for brand/model inference.
    const pretty = titleCaseWords(slugToWords(nameSlug));
    if (pretty.length >= 6 && !isGarbageProductName(pretty)) {
      fields.name = pretty;
      const inferred = inferBrandModel(pretty);
      if (inferred.brand && !isGarbageBrandOrModel(inferred.brand)) {
        fields.brand = inferred.brand;
      }
      // Model: brand-stripped remainder, capped so we don't dump the whole marketing title.
      if (inferred.model && !isGarbageBrandOrModel(inferred.model)) {
        const modelWords = inferred.model.split(/\s+/).slice(0, 6).join(" ");
        // Prefer compact model codes (Mustang LT25) over long Amazon SEO titles.
        if (modelWords.length <= 48) fields.model = modelWords;
        else {
          // Take first token group that looks like a model code + short name
          const short = inferred.model.match(
            /^([A-Za-z0-9]+(?:\s+[A-Za-z0-9./-]{1,12}){0,3})/
          );
          if (short) fields.model = short[1].trim();
        }
      }
      // Specs from the slug words only (wattage etc.) — not from ASIN.
      if (words.length > 3) {
        Object.assign(
          fields,
          Object.fromEntries(
            Object.entries(parseSpecText(words, category)).filter(
              ([k, v]) =>
                fields[k] === undefined &&
                k !== "notes" &&
                !(typeof v === "string" && isGarbageProductName(v))
            )
          )
        );
      }
    }
  }

  // Never set name/model/brand to the ASIN.
  void asin;
  return fields;
}

/**
 * Pull brand/model/name hints out of common retailer URL slugs when the page
 * itself can't be fetched (Sweetwater, Guitar Center, Amazon, etc.).
 */
export function inferFieldsFromProductUrl(
  sourceUrl: string,
  category: CategoryDef
): LookupFields {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return {};
  }

  const host = parsed.hostname.replace(/^www\./, "");

  if (/(^|\.)amazon\./i.test(host) || /^amzn\.(to|com)$/i.test(host)) {
    return amazonUrlHints(parsed, category);
  }

  const fields: LookupFields = {
    acquisitionSource: host,
  };

  const path = decodeURIComponent(parsed.pathname);
  const last = path.split("/").filter(Boolean).pop() || "";
  const slug = last
    .replace(/\.html?$/i, "")
    .replace(/\.gc$/i, "")
    .replace(/\.htm$/i, "");

  // Sweetwater: SKU--slug-words  e.g. JVM410H--marshall-jvm410h-100-watt-...
  if (/sweetwater\.com$/i.test(parsed.hostname) || slug.includes("--")) {
    const [sku, ...rest] = slug.split("--");
    const words = rest.join("--").replace(/[-_]+/g, " ").trim();
    if (words) {
      const pretty = titleCaseWords(words);
      fields.name = pretty;
      const inferred = inferBrandModel(pretty);
      if (inferred.brand) fields.brand = inferred.brand;
      // Prefer the SKU casing for model when present (JVM410H not Jvm410h).
      if (sku && !ASIN_RE.test(sku)) fields.model = sku;
      else if (inferred.model) fields.model = inferred.model;
      Object.assign(
        fields,
        Object.fromEntries(
          Object.entries(parseSpecText(words, category)).filter(
            ([k]) => fields[k] === undefined && k !== "notes"
          )
        )
      );
    }
    if (sku && !ASIN_RE.test(sku) && !fields.model) fields.model = sku;
    if (sku && !fields.name && !ASIN_RE.test(sku)) {
      fields.name = fields.brand ? `${fields.brand} ${sku}` : sku;
    }
  } else if (slug.length > 3 && !ASIN_RE.test(slug) && !PATH_NOISE.test(slug)) {
    // Guitar Center / generic: Brand/Product-Name-Words or product-name-words
    const words = slug.replace(/[-_]+/g, " ").replace(/\b\d{10,}\b/g, "").trim();
    if (words.length > 3) {
      const pretty = titleCaseWords(words);
      // Prefer path segments: /Marshall/JVM410H-100W-...
      const segs = path.split("/").filter(Boolean);
      if (segs.length >= 2) {
        const maybeBrand = segs[segs.length - 2].replace(/[-_]+/g, " ");
        if (
          /^[A-Za-z][A-Za-z0-9 .&/-]{1,40}$/.test(maybeBrand) &&
          !PATH_NOISE.test(maybeBrand) &&
          !isGarbageBrandOrModel(maybeBrand)
        ) {
          fields.brand = titleCaseWords(maybeBrand);
        }
      }
      if (!isGarbageProductName(pretty)) {
        fields.name = pretty;
        const inferred = inferBrandModel(
          pretty,
          typeof fields.brand === "string" ? fields.brand : undefined
        );
        if (inferred.brand && !fields.brand) fields.brand = inferred.brand;
        if (inferred.model && !fields.model) fields.model = inferred.model;
        Object.assign(
          fields,
          Object.fromEntries(
            Object.entries(parseSpecText(words, category)).filter(
              ([k]) => fields[k] === undefined && k !== "notes"
            )
          )
        );
      }
    }
  }

  // Final scrub: never leave ASIN/path-noise as identity fields.
  for (const key of ["name", "brand", "model"] as const) {
    const v = fields[key];
    if (typeof v === "string" && (isGarbageProductName(v) || isGarbageBrandOrModel(v))) {
      delete fields[key];
    }
  }

  return fields;
}
