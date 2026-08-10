import type { LookupFields } from "@/lib/lookup/types";

export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function metaContent(html: string, ...names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      "i"
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
      "i"
    );
    const m = html.match(re) || html.match(re2);
    if (m?.[1]) return decodeEntities(m[1]).trim();
  }
  return null;
}

export function firstMatch(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1] ? stripTags(m[1]) : null;
}

/** Walk JSON-LD looking for Product (or ProductGroup) nodes. */
function findProducts(
  node: unknown,
  out: Record<string, unknown>[] = [],
  seen: Set<unknown> = new Set()
): Record<string, unknown>[] {
  if (!node || typeof node !== "object" || seen.has(node)) return out;
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) findProducts(item, out, seen);
    return out;
  }

  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  const types = Array.isArray(type) ? type.map(String) : type ? [String(type)] : [];
  if (types.some((t) => /product/i.test(t))) out.push(obj);

  // Prefer graph roots / mainEntity; also scan shallow children for nested Product.
  if (obj["@graph"]) findProducts(obj["@graph"], out, seen);
  if (obj.mainEntity) findProducts(obj.mainEntity, out, seen);
  if (obj.itemListElement) findProducts(obj.itemListElement, out, seen);
  return out;
}

function brandFromJsonLd(brand: unknown): string | null {
  if (!brand) return null;
  if (typeof brand === "string") return brand.trim() || null;
  if (typeof brand === "object" && brand !== null) {
    const b = brand as Record<string, unknown>;
    if (typeof b.name === "string") return b.name.trim() || null;
  }
  return null;
}

export function fieldsFromJsonLd(html: string): LookupFields {
  const fields: LookupFields = {};
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const match of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(match[1].trim());
    } catch {
      continue;
    }

    for (const product of findProducts(data)) {
      if (typeof product.name === "string" && !fields.name) {
        fields.name = product.name.trim();
      }
      const brand = brandFromJsonLd(product.brand);
      if (brand && !fields.brand) fields.brand = brand;
      if (typeof product.model === "string" && !fields.model) {
        fields.model = product.model.trim();
      }
      if (typeof product.color === "string" && !fields.finishColor) {
        fields.finishColor = product.color.trim();
      }
      if (typeof product.sku === "string" && !fields.serialNumber) {
        // SKU isn't a serial, but useful as a notes hint — skip; don't misuse serialNumber
      }
      // Schema.org additionalProperty / additionalProperty as PropertyValue
      const props = product.additionalProperty;
      if (Array.isArray(props)) {
        const lines: string[] = [];
        for (const p of props) {
          if (!p || typeof p !== "object") continue;
          const pv = p as Record<string, unknown>;
          const n = typeof pv.name === "string" ? pv.name : null;
          const v =
            typeof pv.value === "string" || typeof pv.value === "number"
              ? String(pv.value)
              : null;
          if (n && v) lines.push(`${n}: ${v}`);
        }
        if (lines.length) {
          fields.__jsonLdSpecs = lines.join("\n");
        }
      }
      if (typeof product.description === "string" && !fields.__description) {
        fields.__description = product.description.replace(/<[^>]+>/g, " ").trim();
      }
    }
  }

  return fields;
}

/**
 * Convert HTML into line-oriented text that parseSpecText understands:
 * tables → tab rows, definition lists → Label: value, lists → lines.
 */
export function htmlToSpecText(html: string): string {
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const lines: string[] = [];

  // Definition lists: <dt>Label</dt><dd>Value</dd>
  h = h.replace(
    /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi,
    (_m, dt, dd) => {
      const label = stripTags(dt);
      const value = stripTags(dd);
      if (label && value) lines.push(`${label}: ${value}`);
      return " ";
    }
  );

  // Table rows
  h = h.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (_m, row) => {
    const cells = [...String(row).matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) =>
      stripTags(c[1])
    );
    if (cells.length >= 2 && cells[0] && cells[1]) {
      // Two-column spec table: Label | Value
      if (cells.length === 2) lines.push(`${cells[0]}\t${cells[1]}`);
      else lines.push(cells.join("\t"));
    } else if (cells.length === 1 && cells[0]) {
      lines.push(cells[0]);
    }
    return " ";
  });

  // List items
  h = h.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, li) => {
    const text = stripTags(li);
    if (text) lines.push(text);
    return " ";
  });

  // Block elements → newlines so free-form phrases stay line-separated
  h = h
    .replace(/<\/(p|div|section|article|h[1-6]|br)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");

  const bodyText = stripTags(
    h
      .replace(/\n+/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n")
  );

  // Prefer structured extractions first; append body text for free-form mining.
  // Cap body to keep parseSpecText snappy on huge retailer pages.
  const bodyLines = bodyText
    .split(/\n|(?<=\.)\s+(?=[A-Z0-9])/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && l.length < 200)
    .slice(0, 400);

  const combined = [...lines, ...bodyLines].join("\n");
  // De-dupe consecutive identical lines
  return combined
    .split("\n")
    .filter((line, i, arr) => line && line !== arr[i - 1])
    .join("\n");
}
