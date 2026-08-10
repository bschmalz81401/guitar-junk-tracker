import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { photoFilePath } from "@/lib/storage";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
};

type Params = { params: Promise<{ filename: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { filename: rawFilename } = await params;
  const filename = path.basename(rawFilename);

  const user = await getSessionUser();

  // Owner always; guests only when the collection is public.
  // (Do not grant access by admin role — that leaked private admin photos.)
  const photo = await prisma.photo.findFirst({
    where: {
      filePath: filename,
      item: user
        ? {
            OR: [{ userId: user.id }, { user: { catalogPublic: true } }],
          }
        : { user: { catalogPublic: true } },
    },
    select: { id: true, item: { select: { user: { select: { catalogPublic: true } } } } },
  });

  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const buffer = await readFile(photoFilePath(filename));
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const isPublic = photo.item.user.catalogPublic;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": isPublic
          ? "public, max-age=3600"
          : "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
