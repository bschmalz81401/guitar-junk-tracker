import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  type CategoryDef,
  type SpecRelation,
  categoryByKey,
  CATEGORY_LIST,
} from "@/types/categories";

const specInclude = Object.fromEntries(
  CATEGORY_LIST.map((c) => [c.specRelation, true])
) as Record<SpecRelation, true>;

/** Every relation a detail view needs, with photos in display order. */
export const itemInclude = {
  ...specInclude,
  photos: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
  mods: { orderBy: { date: "desc" } },
} satisfies Prisma.ItemInclude;

export type ItemWithRelations = Prisma.ItemGetPayload<{ include: typeof itemInclude }>;

/** Pulls whichever spec relation is populated for this item. */
export function specOf(item: {
  category: string;
  [key: string]: unknown;
}): Record<string, unknown> | null {
  const category = categoryByKey(item.category);
  if (!category) return null;
  const spec = item[category.specRelation];
  return (spec as Record<string, unknown> | null) ?? null;
}

export interface ItemFilters {
  search?: string;
  brand?: string;
  status?: string;
  /** Category-specific filter values, keyed by FilterDef.param */
  specFilters?: Record<string, string>;
}

/**
 * Builds the Prisma where clause for a list view. Always scoped to a user.
 * When a category is given, results are limited to it and its filters apply.
 */
export function buildItemWhere(
  userId: number,
  category: CategoryDef | null,
  filters: ItemFilters
): Prisma.ItemWhereInput {
  const where: Prisma.ItemWhereInput = { userId };
  const and: Prisma.ItemWhereInput[] = [];

  if (category) where.category = category.key;

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { brand: { contains: filters.search } },
      { model: { contains: filters.search } },
    ];
  }
  if (filters.brand) where.brand = { contains: filters.brand };
  if (filters.status) {
    where.status = filters.status as Prisma.ItemWhereInput["status"];
  }

  if (category && filters.specFilters) {
    for (const def of category.filters) {
      const value = filters.specFilters[def.param];
      if (!value) continue;
      and.push({
        [category.specRelation]: {
          is: {
            OR: def.specKeys.map((k) => ({ [k]: { contains: value } })),
          },
        },
      } as Prisma.ItemWhereInput);
    }
  }

  if (and.length > 0) where.AND = and;
  return where;
}

/** Reads category-specific filter values out of a URLSearchParams-like object. */
export function readSpecFilters(
  category: CategoryDef | null,
  get: (key: string) => string | null | undefined
): Record<string, string> {
  if (!category) return {};
  const out: Record<string, string> = {};
  for (const def of category.filters) {
    const value = get(def.param)?.trim();
    if (value) out[def.param] = value;
  }
  return out;
}

/** Counts per category for the current user's collection. */
export async function categoryCounts(userId: number): Promise<Record<string, number>> {
  const rows = await prisma.item.groupBy({
    by: ["category"],
    where: { userId },
    _count: true,
  });
  const counts: Record<string, number> = {};
  for (const c of CATEGORY_LIST) counts[c.key] = 0;
  for (const row of rows) counts[row.category] = row._count;
  return counts;
}

/**
 * One random photo path per category for landing-page cards.
 * Empty categories with no stock coverImage fall back to any photo from the user.
 */
export async function randomCategoryCovers(userId: number): Promise<Record<string, string>> {
  const covers = await Promise.all(
    CATEGORY_LIST.map(async (category) => {
      const count = await prisma.photo.count({
        where: { item: { category: category.key, userId } },
      });
      if (count > 0) {
        const photo = await prisma.photo.findFirst({
          where: { item: { category: category.key, userId } },
          skip: Math.floor(Math.random() * count),
          select: { filePath: true },
        });
        return [category.key, photo?.filePath ?? null] as const;
      }

      if (!category.coverImage) {
        const anyCount = await prisma.photo.count({
          where: { item: { userId } },
        });
        if (anyCount > 0) {
          const photo = await prisma.photo.findFirst({
            where: { item: { userId } },
            skip: Math.floor(Math.random() * anyCount),
            select: { filePath: true },
          });
          return [category.key, photo?.filePath ?? null] as const;
        }
      }

      return [category.key, null] as const;
    })
  );

  const out: Record<string, string> = {};
  for (const [key, path] of covers) {
    if (path) out[key] = path;
  }
  return out;
}

/** Load an item only if it belongs to the user. */
export async function findUserItem(userId: number, itemId: number) {
  return prisma.item.findFirst({
    where: { id: itemId, userId },
    include: itemInclude,
  });
}
