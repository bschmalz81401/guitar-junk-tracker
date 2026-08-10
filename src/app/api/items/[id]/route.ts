import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { itemCoreData, parseItemBody } from "@/lib/itemBody";
import { itemInclude } from "@/lib/items";
import { deletePhotoFile } from "@/lib/storage";
import { ITEM_STATUSES, type ItemStatus } from "@/types/categories";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const item = await prisma.item.findFirst({
    where: { id: itemId, userId: auth.user.id },
    include: itemInclude,
  });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.item.findFirst({
    where: { id: itemId, userId: auth.user.id },
    select: { category: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const parsed = parseItemBody(body, { existingCategoryKey: existing.category });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { data } = parsed;
  const item = await prisma.item.update({
    where: { id: itemId },
    data: {
      ...itemCoreData(data),
      [data.category.specRelation]: {
        upsert: { create: data.specData, update: data.specData },
      },
    },
    include: itemInclude,
  });

  return NextResponse.json(item);
}

/** Partial update — currently status only (quick wishlist / owned / sold). */
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.item.findFirst({
    where: { id: itemId, userId: auth.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as { status?: string };
  const statusRaw = typeof body.status === "string" ? body.status : "";
  if (!(ITEM_STATUSES as readonly string[]).includes(statusRaw)) {
    return NextResponse.json(
      { error: `Status must be one of: ${ITEM_STATUSES.join(", ")}.` },
      { status: 400 }
    );
  }

  const item = await prisma.item.update({
    where: { id: itemId },
    data: { status: statusRaw as ItemStatus },
    include: itemInclude,
  });

  return NextResponse.json(item);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.item.findFirst({
    where: { id: itemId, userId: auth.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const photos = await prisma.photo.findMany({ where: { itemId } });
  await Promise.all(photos.map((p) => deletePhotoFile(p.filePath)));

  await prisma.item.delete({ where: { id: itemId } });

  return NextResponse.json({ success: true });
}
