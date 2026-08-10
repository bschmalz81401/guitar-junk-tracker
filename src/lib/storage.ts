import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { safeFetch } from "@/lib/safeFetch";

/** Absolute directory where uploaded photos live (Docker: `/data/photos`). */
export const PHOTOS_DIR =
  process.env.PHOTOS_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "photos");

export async function savePhoto(file: File): Promise<string> {
  await mkdir(PHOTOS_DIR, { recursive: true });
  const ext = path.extname(file.name) || "";
  const filename = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(PHOTOS_DIR, filename), buffer);
  return filename;
}

const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
};

export async function savePhotoFromUrl(sourceUrl: string): Promise<string> {
  const { response, finalUrl, body } = await safeFetch(sourceUrl, {
    maxBytes: MAX_DOWNLOAD_BYTES,
    accept: "image/*,*/*;q=0.8",
  });

  const contentType = (response.headers.get("content-type") || "").split(";")[0].trim();
  if (!contentType.startsWith("image/")) {
    throw new Error("That URL didn't point to an image");
  }

  await mkdir(PHOTOS_DIR, { recursive: true });
  const ext = CONTENT_TYPE_EXTENSIONS[contentType] || path.extname(finalUrl.pathname) || "";
  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(PHOTOS_DIR, filename), body);
  return filename;
}

export async function deletePhotoFile(filename: string): Promise<void> {
  try {
    await unlink(path.join(PHOTOS_DIR, filename));
  } catch {
    // file already gone; ignore
  }
}

export function photoFilePath(filename: string): string {
  return path.join(PHOTOS_DIR, filename);
}
