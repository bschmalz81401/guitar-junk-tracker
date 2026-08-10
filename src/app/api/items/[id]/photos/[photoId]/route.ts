import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deletePhotoFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string; photoId: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id, photoId } = await params;
  const itemId = Number(id);
  const photoPk = Number(photoId);
  if (!Number.isInteger(itemId) || !Number.isInteger(photoPk)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const owned = await prisma.item.findFirst({
    where: { id: itemId, userId: auth.user.id },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const photo = await prisma.photo.findFirst({
    where: { id: photoPk, itemId },
  });
  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deletePhotoFile(photo.filePath);
  await prisma.photo.delete({ where: { id: photo.id } });

  if (photo.isPrimary) {
    const next = await prisma.photo.findFirst({
      where: { itemId: photo.itemId },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.photo.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id, photoId } = await params;
  const itemId = Number(id);
  const photoPk = Number(photoId);
  if (!Number.isInteger(itemId) || !Number.isInteger(photoPk)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const owned = await prisma.item.findFirst({
    where: { id: itemId, userId: auth.user.id },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.photo.findFirst({
    where: { id: photoPk, itemId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();

  if (body.isPrimary) {
    await prisma.photo.updateMany({
      where: { itemId },
      data: { isPrimary: false },
    });
  }

  const photo = await prisma.photo.update({
    where: { id: existing.id },
    data: {
      caption: body.caption !== undefined ? body.caption : undefined,
      isPrimary: body.isPrimary !== undefined ? body.isPrimary : undefined,
    },
  });

  return NextResponse.json(photo);
}
