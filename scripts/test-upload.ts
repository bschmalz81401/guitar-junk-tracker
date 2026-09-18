/**
 * Photo upload policy: magic-byte allowlist, size, and per-item count.
 * Run: npx tsx scripts/test-upload.ts
 */
import assert from "node:assert/strict";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import {
  MAX_PHOTO_BYTES,
  MAX_UPLOAD_REQUEST_BYTES,
  assertPhotoBytes,
  assertPhotoCount,
  assertUploadRequestSize,
  detectImageKind,
} from "../src/lib/uploadPolicy";
import { savePhoto } from "../src/lib/storage";

let failed = 0;

async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`OK   ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(err);
  }
}

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const JPEG_1X1 = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wAAAAD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9sAAwAD/9k=",
  "base64"
);
const GIF_1X1 = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
const WEBP_1X1 = Buffer.from(
  "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=",
  "base64"
);

async function withPhotosDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "gjt-upload-"));
  const prev = process.env.PHOTOS_DIR;
  process.env.PHOTOS_DIR = dir;
  try {
    return await fn(dir);
  } finally {
    if (prev === undefined) delete process.env.PHOTOS_DIR;
    else process.env.PHOTOS_DIR = prev;
  }
}

async function main() {
  await check("detects JPEG, PNG, GIF, and WebP from magic bytes", () => {
    assert.equal(detectImageKind(JPEG_1X1), "jpeg");
    assert.equal(detectImageKind(PNG_1X1), "png");
    assert.equal(detectImageKind(GIF_1X1), "gif");
    assert.equal(detectImageKind(WEBP_1X1), "webp");
  });

  await check("rejects empty, spoofed, and oversized payloads", () => {
    assert.throws(() => assertPhotoBytes(Buffer.alloc(0)), /empty/);
    assert.throws(() => assertPhotoBytes(Buffer.from("<html>")), /JPEG, PNG, WebP, and GIF/);
    const huge = Buffer.alloc(MAX_PHOTO_BYTES + 1, 0xff);
    huge[0] = 0xff;
    huge[1] = 0xd8;
    huge[2] = 0xff;
    assert.throws(() => assertPhotoBytes(huge), /10 MB/);
  });

  await check("enforces 20 photos per item and request size", () => {
    assert.doesNotThrow(() => assertPhotoCount(19));
    assert.throws(() => assertPhotoCount(20), /20 photos/);
    assert.throws(() => assertPhotoCount(21), /20 photos/);
    assert.doesNotThrow(() => assertUploadRequestSize(String(MAX_PHOTO_BYTES)));
    assert.throws(
      () => assertUploadRequestSize(String(MAX_UPLOAD_REQUEST_BYTES + 1)),
      /10 MB/
    );
  });

  await check("saves a PNG using the detected extension, ignoring the filename", async () => {
    await withPhotosDir(async (dir) => {
      const file = new File([PNG_1X1], "not-an-image.exe", {
        type: "application/octet-stream",
      });
      const filename = await savePhoto(file);
      assert.match(filename, /\.png$/);
      const names = await readdir(dir);
      assert.deepEqual(names, [filename]);
    });
  });

  await check("rejected uploads leave no file behind", async () => {
    await withPhotosDir(async (dir) => {
      const file = new File([Buffer.from("MZ-not-an-image")], "photo.jpg", {
        type: "image/jpeg",
      });
      await assert.rejects(() => savePhoto(file), /JPEG, PNG, WebP, and GIF/);
      assert.deepEqual(await readdir(dir), []);
    });
  });

  await check("photos route checks count and request size before writing", () => {
    const src = readFileSync(
      join(__dirname, "..", "src/app/api/items/[id]/photos/route.ts"),
      "utf8"
    );
    const countIdx = src.indexOf("assertPhotoCount(existingCount)");
    const saveIdx = src.indexOf("filename = await savePhoto(file)");
    const urlIdx = src.indexOf("filename = await savePhotoFromUrl");
    assert.ok(countIdx >= 0 && saveIdx > countIdx && urlIdx > countIdx);
    assert.match(src, /assertUploadRequestSize/);
    assert.match(src, /unlinkStoredPhoto\(filename\)/);
  });

  if (failed > 0) {
    console.error(`\n${failed} upload check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll upload checks passed.");
}

void main();
