import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const item = await prisma.item.findFirst({
    where: { id: itemId, userId: auth.user.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const dateRaw = typeof body.date === "string" ? body.date : "";
  if (!description || !dateRaw) {
    return NextResponse.json(
      { error: "Date and description are required." },
      { status: 400 }
    );
  }

  const date = new Date(dateRaw);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const mod = await prisma.mod.create({
    data: {
      itemId,
      date,
      description,
    },
  });

  return NextResponse.json(mod, { status: 201 });
}
