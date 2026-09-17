import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { safeFetch } from "@/lib/safeFetch";

export function photosDir(): string {
  return (
    process.env.PHOTOS_DIR ||
    path.join(/* turbopackIgnore: true */ process.cwd(), "data", "photos")
  );
}

/** Absolute directory where uploaded photos live (Docker: `/data/photos`). */
export const PHOTOS_DIR = photosDir();

export function resolveStoredPhotoPath(
  filename: string,
  root: string = photosDir()
): string {
  if (!filename || filename !== path.basename(filename)) {
    throw new Error("Invalid photo filename");
  }
  const base = path.basename(filename);
  if (base === "." || base === "..") {
    throw new Error("Invalid photo filename");
  }
  const resolved = path.resolve(root, base);
  if (path.dirname(resolved) !== path.resolve(root)) {
    throw new Error("Invalid photo filename");
  }
  return resolved;
}

export async function savePhoto(file: File): Promise<string> {
  const root = photosDir();
  await mkdir(root, { recursive: true });
  const ext = path.extname(file.name) || "";
  const filename = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(resolveStoredPhotoPath(filename, root), buffer);
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
  const { headers, finalUrl, body } = await safeFetch(sourceUrl, {
    maxBytes: MAX_DOWNLOAD_BYTES,
    accept: "image/*,*/*;q=0.8",
  });

  const contentType = (headers.get("content-type") || "").split(";")[0].trim();
  if (!contentType.startsWith("image/")) {
    throw new Error("That URL didn't point to an image");
  }

  const root = photosDir();
  await mkdir(root, { recursive: true });
  const ext = CONTENT_TYPE_EXTENSIONS[contentType] || path.extname(finalUrl.pathname) || "";
  const filename = `${randomUUID()}${ext}`;
  await writeFile(resolveStoredPhotoPath(filename, root), body);
  return filename;
}

export async function unlinkStoredPhoto(
  filename: string,
  opts?: {
    root?: string;
    unlinkFn?: (target: string) => Promise<void>;
  }
): Promise<"deleted" | "missing"> {
  const target = resolveStoredPhotoPath(filename, opts?.root ?? photosDir());
  try {
    await (opts?.unlinkFn ?? unlink)(target);
    return "deleted";
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code === "ENOENT") return "missing";
    throw err;
  }
}

export async function deletePhotoFile(filename: string): Promise<void> {
  try {
    await unlinkStoredPhoto(filename);
  } catch {
    // best-effort for single-photo / item delete
  }
}

export function photoFilePath(filename: string): string {
  return resolveStoredPhotoPath(filename);
}
