import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { savePhoto, savePhotoFromUrl, unlinkStoredPhoto } from "@/lib/storage";
import { assertPhotoCount, assertUploadRequestSize } from "@/lib/uploadPolicy";

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

  try {
    assertUploadRequestSize(request.headers.get("content-length"));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload too large" },
      { status: 413 }
    );
  }

  const existingCount = await prisma.photo.count({ where: { itemId } });
  try {
    assertPhotoCount(existingCount);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Photo limit reached" },
      { status: 400 }
    );
  }

  const contentType = request.headers.get("content-type") || "";
  let filename: string;
  let caption: string | null = null;

  try {
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const url = typeof body.url === "string" ? body.url.trim() : "";
      caption = typeof body.caption === "string" ? body.caption : null;
      if (!url) {
        return NextResponse.json({ error: "No URL provided" }, { status: 400 });
      }
      filename = await savePhotoFromUrl(url);
    } else {
      const formData = await request.formData();
      const file = formData.get("file");
      const cap = formData.get("caption");
      caption = typeof cap === "string" ? cap : null;
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      filename = await savePhoto(file);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save image";
    const status = /larger than 10 MB/.test(message) ? 413 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  try {
    const photo = await prisma.photo.create({
      data: {
        itemId,
        filePath: filename,
        caption,
        isPrimary: existingCount === 0,
      },
    });
    return NextResponse.json(photo, { status: 201 });
  } catch (err) {
    await unlinkStoredPhoto(filename).catch(() => undefined);
    const message = err instanceof Error ? err.message : "Failed to save image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
