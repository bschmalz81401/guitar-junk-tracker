import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; modId: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id, modId } = await params;
  const itemId = Number(id);
  const modPk = Number(modId);
  if (!Number.isInteger(itemId) || !Number.isInteger(modPk)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const owned = await prisma.item.findFirst({
    where: { id: itemId, userId: auth.user.id },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const mod = await prisma.mod.findFirst({ where: { id: modPk, itemId } });
  if (!mod) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.mod.delete({ where: { id: mod.id } });
  return NextResponse.json({ success: true });
}
