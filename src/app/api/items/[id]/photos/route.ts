import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { savePhoto, savePhotoFromUrl } from "@/lib/storage";

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

  const contentType = request.headers.get("content-type") || "";
  let filename: string;
  let caption: string | null = null;

  if (contentType.includes("application/json")) {
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    caption = body.caption || null;

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    try {
      filename = await savePhotoFromUrl(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to download image";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } else {
    const formData = await request.formData();
    const file = formData.get("file");
    caption = (formData.get("caption") as string) || null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    filename = await savePhoto(file);
  }

  const existingCount = await prisma.photo.count({ where: { itemId } });

  const photo = await prisma.photo.create({
    data: {
      itemId,
      filePath: filename,
      caption,
      isPrimary: existingCount === 0,
    },
  });

  return NextResponse.json(photo, { status: 201 });
}
