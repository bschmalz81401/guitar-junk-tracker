import type { CategoryDef } from "@/types/categories";
import { parseSpecText } from "@/lib/specParser";
import type { LookupFields } from "@/lib/lookup/types";
import { inferBrandModel } from "@/lib/lookup/brands";
import { PAGE_CHROME_LINE, PAGE_CHROME_CONTAINS } from "@/lib/lookup/paste";

function titleCaseWords(words: string): string {
  return words
    .split(/\s+/)
    .map((w) => {
      // Keep model-ish tokens (JVM410H, AC30) mostly intact when mixed case/digits.
      if (/[A-Z]{2,}\d/i.test(w) || /\d/.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export function isGarbageProductName(name: string): boolean {
  const n = name.trim();
  if (n.length < 4 || n.length > 160) return true;
  if (PAGE_CHROME_LINE.test(n) || PAGE_CHROME_CONTAINS.test(n)) return true;
  if (/skip\s+to/i.test(n)) return true;
  if (/contact\s+us|accessibility|cookie|sign\s+in/i.test(n) && n.length < 80) return true;
  // Glued chrome dump still on one line
  if ((n.match(/skip\s+to/gi) || []).length >= 1 && n.length > 30) return true;
  return false;
}

/**
 * Pull brand/model/name hints out of common retailer URL slugs when the page
 * itself can't be fetched (Sweetwater, Guitar Center, etc.).
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

  const fields: LookupFields = {
    acquisitionSource: parsed.hostname.replace(/^www\./, ""),
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
      if (sku) fields.model = sku;
      else if (inferred.model) fields.model = inferred.model;
      Object.assign(fields, parseSpecText(words, category));
    }
    if (sku && !fields.model) fields.model = sku;
    if (sku && !fields.name) {
      fields.name = fields.brand ? `${fields.brand} ${sku}` : sku;
    }
  } else if (slug.length > 3) {
    // Guitar Center / generic: Brand/Product-Name-Words or product-name-words
    const words = slug.replace(/[-_]+/g, " ").replace(/\d{10,}/g, "").trim();
    if (words.length > 3) {
      const pretty = words.replace(/\b\w/g, (c) => c.toUpperCase());
      // Prefer path segments: /Marshall/JVM410H-100W-...
      const segs = path.split("/").filter(Boolean);
      if (segs.length >= 2) {
        const maybeBrand = segs[segs.length - 2].replace(/[-_]+/g, " ");
        if (/^[A-Za-z][A-Za-z0-9 .&/-]{1,40}$/.test(maybeBrand) && !/^(store|product|p|item|detail)$/i.test(maybeBrand)) {
          fields.brand = maybeBrand.replace(/\b\w/g, (c) => c.toUpperCase());
        }
      }
      fields.name = pretty;
      const inferred = inferBrandModel(pretty, typeof fields.brand === "string" ? fields.brand : undefined);
      if (inferred.brand && !fields.brand) fields.brand = inferred.brand;
      if (inferred.model && !fields.model) fields.model = inferred.model;
      Object.assign(
        fields,
        Object.fromEntries(
          Object.entries(parseSpecText(words, category)).filter(([k]) => fields[k] === undefined)
        )
      );
    }
  }

  return fields;
}
