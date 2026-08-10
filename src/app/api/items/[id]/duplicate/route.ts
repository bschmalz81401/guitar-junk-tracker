import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { cleanSpecForDuplicate, duplicateItemName } from "@/lib/itemDuplicate";
import { itemInclude, specOf } from "@/lib/items";
import { prisma } from "@/lib/prisma";
import { categoryByKey } from "@/types/categories";

type Params = { params: Promise<{ id: string }> };

/**
 * Clone an item the user owns: core fields + category specs.
 * Photos and mod history are not copied (user re-uploads intentionally).
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.item.findFirst({
    where: { id: itemId, userId: auth.user.id },
    include: itemInclude,
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const category = categoryByKey(existing.category);
  if (!category) {
    return NextResponse.json({ error: "Unknown category" }, { status: 500 });
  }

  const spec = cleanSpecForDuplicate(
    specOf(existing) as Record<string, unknown> | null
  );

  const item = await prisma.item.create({
    data: {
      userId: auth.user.id,
      category: existing.category,
      name: duplicateItemName(existing.name),
      brand: existing.brand,
      model: existing.model,
      series: existing.series,
      finishColor: existing.finishColor,
      dateAcquired: existing.dateAcquired,
      acquisitionSource: existing.acquisitionSource,
      // New copy: keep price private; clear serial so two items don't share one.
      pricePaid: existing.pricePaid,
      pricePaidPublic: false,
      serialNumber: null,
      serialNumberPublic: false,
      status: existing.status,
      notes: existing.notes,
      [category.specRelation]: { create: spec },
    },
    include: itemInclude,
  });

  return NextResponse.json(item, { status: 201 });
}
