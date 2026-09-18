import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { safeFetch } from "@/lib/safeFetch";
import {
  IMAGE_EXTENSIONS,
  MAX_PHOTO_BYTES,
  assertPhotoBytes,
} from "@/lib/uploadPolicy";

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

async function persistImageBytes(bytes: Uint8Array): Promise<string> {
  const kind = assertPhotoBytes(bytes);
  const root = photosDir();
  await mkdir(root, { recursive: true });
  const filename = `${randomUUID()}${IMAGE_EXTENSIONS[kind]}`;
  const target = resolveStoredPhotoPath(filename, root);
  await writeFile(target, bytes);
  return filename;
}

export async function savePhoto(file: File): Promise<string> {
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("That image is larger than 10 MB.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return persistImageBytes(buffer);
}

export async function savePhotoFromUrl(sourceUrl: string): Promise<string> {
  const { body } = await safeFetch(sourceUrl, {
    maxBytes: MAX_PHOTO_BYTES,
    accept: "image/*,*/*;q=0.8",
  });
  return persistImageBytes(body);
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
