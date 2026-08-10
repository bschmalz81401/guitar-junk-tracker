import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { itemCoreData, parseItemBody } from "@/lib/itemBody";
import { buildItemWhere, itemInclude, readSpecFilters } from "@/lib/items";
import { categoryBySlug, categoryByKey } from "@/types/categories";

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const categoryParam = searchParams.get("category")?.trim();

  const category = categoryParam
    ? (categoryBySlug(categoryParam) ?? categoryByKey(categoryParam))
    : null;

  if (categoryParam && !category) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  const where = buildItemWhere(auth.user.id, category, {
    search: searchParams.get("search")?.trim() || undefined,
    brand: searchParams.get("brand")?.trim() || undefined,
    status: searchParams.get("status")?.trim() || undefined,
    specFilters: readSpecFilters(category, (k) => searchParams.get(k)),
  });

  const items = await prisma.item.findMany({
    where,
    include: itemInclude,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as Record<string, unknown>;
  const parsed = parseItemBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { data } = parsed;
  const item = await prisma.item.create({
    data: {
      userId: auth.user.id,
      category: data.category.key,
      ...itemCoreData(data),
      [data.category.specRelation]: { create: data.specData },
    },
    include: itemInclude,
  });

  return NextResponse.json(item, { status: 201 });
}
