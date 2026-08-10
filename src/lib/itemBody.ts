import {
  buildSpecData,
  categoryByKey,
  categoryBySlug,
  ITEM_STATUSES,
  type CategoryDef,
  type ItemStatus,
} from "@/types/categories";

export type ParsedItemBody = {
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
};

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * Shared create/update body parsing for /api/items.
 * When `existingCategoryKey` is set (update), category comes from the DB row.
 */
export function parseItemBody(
  body: Record<string, unknown>,
  options?: { existingCategoryKey?: string; requireCategory?: boolean }
): { ok: true; data: ParsedItemBody } | { ok: false; error: string; status: number } {
  let category: CategoryDef | null = null;

  if (options?.existingCategoryKey) {
    category = categoryByKey(options.existingCategoryKey);
    if (!category) {
      return { ok: false, error: "Item has an unknown category", status: 500 };
    }
  } else {
    const raw = String(body.category ?? "");
    category = categoryBySlug(raw) ?? categoryByKey(raw);
    if (!category) {
      const keys = "guitar, amp, cab, pedal, multifx, or other";
      return {
        ok: false,
        error: `A valid category is required (${keys}).`,
        status: 400,
      };
    }
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const brand = typeof body.brand === "string" ? body.brand.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!name || !brand || !model) {
    return { ok: false, error: "Name, brand, and model are required.", status: 400 };
  }

  const statusRaw = typeof body.status === "string" ? body.status : "owned";
  if (!(ITEM_STATUSES as readonly string[]).includes(statusRaw)) {
    return {
      ok: false,
      error: `Status must be one of: ${ITEM_STATUSES.join(", ")}.`,
      status: 400,
    };
  }

  const priceRaw = body.pricePaid;
  let pricePaid: number | null = null;
  if (priceRaw != null && priceRaw !== "") {
    const n = Number(priceRaw);
    pricePaid = Number.isFinite(n) ? n : null;
  }

  return {
    ok: true,
    data: {
      category,
      name,
      brand,
      model,
      series: optionalString(body.series),
      finishColor: optionalString(body.finishColor),
      dateAcquired: body.dateAcquired ? new Date(String(body.dateAcquired)) : null,
      acquisitionSource: optionalString(body.acquisitionSource),
      pricePaid,
      pricePaidPublic: Boolean(body.pricePaidPublic),
      serialNumber: optionalString(body.serialNumber),
      serialNumberPublic: Boolean(body.serialNumberPublic),
      status: statusRaw as ItemStatus,
      notes: optionalString(body.notes),
      specData: buildSpecData(category, body),
    },
  };
}

/** Prisma data fields shared by create and update (excluding category / userId / relation). */
export function itemCoreData(data: ParsedItemBody) {
  return {
    name: data.name,
    brand: data.brand,
    model: data.model,
    series: data.series,
    finishColor: data.finishColor,
    dateAcquired: data.dateAcquired,
    acquisitionSource: data.acquisitionSource,
    pricePaid: data.pricePaid,
    pricePaidPublic: data.pricePaidPublic,
    serialNumber: data.serialNumber,
    serialNumberPublic: data.serialNumberPublic,
    status: data.status,
    notes: data.notes,
  };
}
