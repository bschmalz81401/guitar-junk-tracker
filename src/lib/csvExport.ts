import type { ItemWithRelations } from "@/lib/items";
import { categoryByKey, CATEGORY_LIST, specFieldKeys } from "@/types/categories";

const ITEM_COLUMNS = [
  "id",
  "category",
  "name",
  "brand",
  "model",
  "series",
  "finishColor",
  "dateAcquired",
  "acquisitionSource",
  "pricePaid",
  "pricePaidPublic",
  "serialNumber",
  "serialNumberPublic",
  "status",
  "notes",
  "createdAt",
  "updatedAt",
  "photoCount",
  "mods",
] as const;

/** All unique spec keys across every category (stable order: category list order). */
export function allSpecColumns(): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const cat of CATEGORY_LIST) {
    for (const key of specFieldKeys(cat)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (value instanceof Date) {
    s = value.toISOString();
  } else if (typeof value === "boolean") {
    s = value ? "true" : "false";
  } else {
    s = String(value);
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function formatMods(
  mods: { date: Date; description: string }[]
): string {
  if (!mods.length) return "";
  return mods
    .map((m) => `${formatDate(m.date)}: ${m.description}`)
    .join(" | ");
}

/**
 * Build a CSV string of the user's collection: shared item fields + all
 * category spec columns (blank when not applicable).
 */
export function itemsToCsv(items: ItemWithRelations[]): string {
  const specCols = allSpecColumns();
  const headers = [...ITEM_COLUMNS, ...specCols];
  const lines = [headers.join(",")];

  for (const item of items) {
    const category = categoryByKey(item.category);
    const spec = category
      ? ((item as Record<string, unknown>)[category.specRelation] as
          | Record<string, unknown>
          | null
          | undefined)
      : null;

    const row: unknown[] = [
      item.id,
      item.category,
      item.name,
      item.brand,
      item.model,
      item.series ?? "",
      item.finishColor ?? "",
      formatDate(item.dateAcquired),
      item.acquisitionSource ?? "",
      item.pricePaid ?? "",
      item.pricePaidPublic,
      item.serialNumber ?? "",
      item.serialNumberPublic,
      item.status,
      item.notes ?? "",
      item.createdAt.toISOString(),
      item.updatedAt.toISOString(),
      item.photos?.length ?? 0,
      formatMods(item.mods ?? []),
    ];

    for (const key of specCols) {
      if (!spec || !(key in spec) || key === "id" || key === "itemId") {
        row.push("");
        continue;
      }
      const v = spec[key];
      row.push(v === null || v === undefined ? "" : v);
    }

    lines.push(row.map(csvEscape).join(","));
  }

  // UTF-8 BOM helps Excel open the file with correct encoding
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
