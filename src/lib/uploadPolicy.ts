/**
 * Selected photo upload policy (Phase 5).
 *
 * - Formats: JPEG, PNG, WebP, GIF (detected from file bytes, not the name or
 *   declared Content-Type). HEIC is not accepted.
 * - Max file size: 10 MiB (direct upload and URL import).
 * - Max photos per item: 20.
 * - Max request: 10 MiB plus 256 KiB of multipart overhead.
 */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS_PER_ITEM = 20;
export const MAX_UPLOAD_REQUEST_BYTES = MAX_PHOTO_BYTES + 256 * 1024;

export type AllowedImageKind = "jpeg" | "png" | "webp" | "gif";

export const IMAGE_EXTENSIONS: Record<AllowedImageKind, string> = {
  jpeg: ".jpg",
  png: ".png",
  webp: ".webp",
  gif: ".gif",
};

function hasPrefix(bytes: Uint8Array, prefix: number[] | string, offset = 0): boolean {
  if (typeof prefix === "string") {
    if (bytes.length < offset + prefix.length) return false;
    for (let i = 0; i < prefix.length; i++) {
      if (bytes[offset + i] !== prefix.charCodeAt(i)) return false;
    }
    return true;
  }
  if (bytes.length < offset + prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[offset + i] !== prefix[i]) return false;
  }
  return true;
}

export function detectImageKind(bytes: Uint8Array): AllowedImageKind | null {
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (hasPrefix(bytes, "GIF87a") || hasPrefix(bytes, "GIF89a")) return "gif";
  if (hasPrefix(bytes, "RIFF") && hasPrefix(bytes, "WEBP", 8)) return "webp";
  return null;
}

export function assertPhotoBytes(bytes: Uint8Array): AllowedImageKind {
  if (bytes.length === 0) {
    throw new Error("That file is empty.");
  }
  if (bytes.length > MAX_PHOTO_BYTES) {
    throw new Error("That image is larger than 10 MB.");
  }
  const kind = detectImageKind(bytes);
  if (!kind) {
    throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed.");
  }
  return kind;
}

export function assertPhotoCount(existing: number): void {
  if (existing >= MAX_PHOTOS_PER_ITEM) {
    throw new Error(`This item already has ${MAX_PHOTOS_PER_ITEM} photos.`);
  }
}

export function assertUploadRequestSize(contentLengthHeader: string | null): void {
  if (!contentLengthHeader || !contentLengthHeader.trim()) {
    throw new Error("That upload is larger than 10 MB.");
  }
  const length = Number(contentLengthHeader);
  if (!Number.isFinite(length) || length < 0 || length > MAX_UPLOAD_REQUEST_BYTES) {
    throw new Error("That upload is larger than 10 MB.");
  }
}
