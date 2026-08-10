/**
 * Parse guitar-tracker collection CSV (same columns as export) into create payloads.
 * Import always creates new items — CSV `id` is ignored. Photos are not imported.
 */

import {
  buildSpecData,
  categoryByKey,
  categoryBySlug,
  ITEM_STATUSES,
  type CategoryDef,
  type ItemStatus,
} from "@/types/categories";
import { allSpecColumns } from "@/lib/csvExport";

export const MAX_IMPORT_ROWS = 500;

export type ImportItemPayload = {
  category: CategoryDef;
  name: string;
  brand: string;
  model: string;
  series: string | null;
  finishColor: string | null;
  dateAcquired: Date | null;
  acquisitionSource: string | null;
  pricePaid: number | null;
  pricePaidPublic: boolean;
  serialNumber: string | null;
  serialNumberPublic: boolean;
  status: ItemStatus;
  notes: string | null;
  specData: Record<string, unknown>;
  /** Optional mod lines parsed from export "mods" column (date: description). */
  mods: { date: Date; description: string }[];
};

export type ImportRowError = {
  row: number; // 1-based data row (header is row 0 in file terms; first data row = 1)
  message: string;
};

export type ParseImportResult = {
  items: ImportItemPayload[];
  errors: ImportRowError[];
  totalDataRows: number;
};

/** RFC4180-ish CSV parse (handles quotes, commas, CRLF). Strips UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  let input = text;
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  // last field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // drop trailing empty line rows
  while (
    rows.length > 0 &&
    rows[rows.length - 1].length === 1 &&
    rows[rows.length - 1][0] === ""
  ) {
    rows.pop();
  }

  return rows;
}

function cell(map: Record<string, string>, key: string): string {
  return (map[key] ?? "").trim();
}

function parseBool(raw: string, defaultValue = false): boolean {
  if (!raw) return defaultValue;
  const v = raw.toLowerCase();
  if (["true", "1", "yes", "y"].includes(v)) return true;
  if (["false", "0", "no", "n"].includes(v)) return false;
  return defaultValue;
}

function parseOptionalNumber(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalDate(raw: string): Date | null {
  if (!raw) return null;
  // Accept YYYY-MM-DD or full ISO
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseOptionalString(raw: string): string | null {
  const t = raw.trim();
  return t ? t : null;
}

/** Parse "YYYY-MM-DD: description | …" from export formatMods. */
export function parseModsColumn(raw: string): { date: Date; description: string }[] {
  if (!raw.trim()) return [];
  const parts = raw.split(" | ").map((p) => p.trim()).filter(Boolean);
  const out: { date: Date; description: string }[] = [];
  for (const part of parts) {
    const m = /^(\d{4}-\d{2}-\d{2}):\s*(.+)$/.exec(part);
    if (!m) continue;
    const date = parseOptionalDate(m[1]);
    const description = m[2].trim();
    if (date && description) out.push({ date, description });
  }
  return out;
}

function resolveCategory(raw: string): CategoryDef | null {
  const v = raw.trim();
  if (!v) return null;
  return categoryByKey(v) ?? categoryBySlug(v);
}

/**
 * Convert CSV text into validated create payloads.
 * Partial success: good rows returned; bad rows listed in errors.
 */
export function parseCollectionCsv(text: string): ParseImportResult {
  const table = parseCsv(text);
  if (table.length === 0) {
    return {
      items: [],
      errors: [{ row: 0, message: "CSV is empty." }],
      totalDataRows: 0,
    };
  }

  const headers = table[0].map((h) => h.trim());
  if (!headers.includes("category") || !headers.includes("name") || !headers.includes("brand") || !headers.includes("model")) {
    return {
      items: [],
      errors: [
        {
          row: 0,
          message:
            "CSV header must include at least category, name, brand, and model (export format).",
        },
      ],
      totalDataRows: 0,
    };
  }

  const dataRows = table.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      items: [],
      errors: [
        {
          row: 0,
          message: `Too many rows (${dataRows.length}). Maximum is ${MAX_IMPORT_ROWS} per import.`,
        },
      ],
      totalDataRows: dataRows.length,
    };
  }

  const specCols = new Set(allSpecColumns());
  const items: ImportItemPayload[] = [];
  const errors: ImportRowError[] = [];

  dataRows.forEach((cols, idx) => {
    const rowNum = idx + 1;
    // skip blank lines
    if (cols.every((c) => !c.trim())) return;

    const map: Record<string, string> = {};
    headers.forEach((h, i) => {
      map[h] = cols[i] ?? "";
    });

    const category = resolveCategory(cell(map, "category"));
    if (!category) {
      errors.push({
        row: rowNum,
        message: `Unknown or missing category "${cell(map, "category")}".`,
      });
      return;
    }

    const name = cell(map, "name");
    const brand = cell(map, "brand");
    const model = cell(map, "model");
    if (!name || !brand || !model) {
      errors.push({
        row: rowNum,
        message: "name, brand, and model are required.",
      });
      return;
    }

    const statusRaw = cell(map, "status") || "owned";
    if (!(ITEM_STATUSES as readonly string[]).includes(statusRaw)) {
      errors.push({
        row: rowNum,
        message: `Invalid status "${statusRaw}".`,
      });
      return;
    }

    const priceRaw = cell(map, "pricePaid");
    let pricePaid: number | null = null;
    if (priceRaw) {
      pricePaid = parseOptionalNumber(priceRaw);
      if (pricePaid === null) {
        errors.push({ row: rowNum, message: `Invalid pricePaid "${priceRaw}".` });
        return;
      }
    }

    // Spec fields only for this category
    const body: Record<string, unknown> = {};
    for (const key of headers) {
      if (!specCols.has(key)) continue;
      const val = cell(map, key);
      if (val !== "") body[key] = val;
    }
    // booleans in CSV are "true"/"false" strings — buildSpecData treats non-empty as Boolean(raw)
    // which is wrong for "false". Coerce known boolean fields via buildSpecData after fix:
    const specData = buildSpecDataFromCsv(category, body);

    items.push({
      category,
      name,
      brand,
      model,
      series: parseOptionalString(cell(map, "series")),
      finishColor: parseOptionalString(cell(map, "finishColor")),
      dateAcquired: parseOptionalDate(cell(map, "dateAcquired")),
      acquisitionSource: parseOptionalString(cell(map, "acquisitionSource")),
      pricePaid,
      pricePaidPublic: parseBool(cell(map, "pricePaidPublic"), false),
      serialNumber: parseOptionalString(cell(map, "serialNumber")),
      serialNumberPublic: parseBool(cell(map, "serialNumberPublic"), false),
      status: statusRaw as ItemStatus,
      notes: parseOptionalString(cell(map, "notes")),
      specData,
      mods: parseModsColumn(cell(map, "mods")),
    });
  });

  return { items, errors, totalDataRows: dataRows.filter((r) => !r.every((c) => !c.trim())).length };
}

/**
 * Like buildSpecData but CSV booleans are "true"/"false" strings.
 */
function buildSpecDataFromCsv(
  category: CategoryDef,
  body: Record<string, unknown>
): Record<string, unknown> {
  const coerced: Record<string, unknown> = { ...body };
  for (const section of category.specSections) {
    for (const field of section.fields) {
      if (!(field.key in coerced)) continue;
      const raw = coerced[field.key];
      if (field.type === "boolean" && typeof raw === "string") {
        coerced[field.key] = parseBool(raw, false);
      }
    }
  }
  return buildSpecData(category, coerced);
}
