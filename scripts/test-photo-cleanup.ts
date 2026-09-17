/**
 * Durable photo cleanup after user delete.
 * Run: npx tsx scripts/test-photo-cleanup.ts
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  runPhotoCleanup,
  type CleanupJob,
  type CleanupStore,
} from "../src/lib/photoCleanup";
import { resolveStoredPhotoPath, unlinkStoredPhoto } from "../src/lib/storage";

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

function memoryStore(
  jobs: CleanupJob[],
  inUse: Set<string> = new Set()
): CleanupStore & { failed: Map<number, string> } {
  const failedMap = new Map<number, string>();
  return {
    failed: failedMap,
    listJobs: async () => jobs.map((j) => ({ ...j })),
    deleteJob: async (id) => {
      const index = jobs.findIndex((j) => j.id === id);
      if (index >= 0) jobs.splice(index, 1);
    },
    markFailed: async (id, error) => {
      failedMap.set(id, error);
    },
    isFilenameInUse: async (filename) => inUse.has(filename),
  };
}

class FsError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function main() {
  await check("rejects path-traversal filenames", () => {
    assert.throws(() => resolveStoredPhotoPath("../secret.jpg", "/data/photos"), /Invalid/);
    assert.throws(() => resolveStoredPhotoPath("a/b.jpg", "/data/photos"), /Invalid/);
    assert.throws(() => resolveStoredPhotoPath("/etc/passwd", "/data/photos"), /Invalid/);
    assert.throws(() => resolveStoredPhotoPath("..", "/data/photos"), /Invalid/);
    const resolved = resolveStoredPhotoPath("abc.jpg", "/data/photos");
    assert.equal(path.basename(resolved), "abc.jpg");
    assert.equal(path.dirname(resolved), path.resolve("/data/photos"));
  });

  await check("unlinking a missing file is idempotent success", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gjt-cleanup-"));
    const outcome = await unlinkStoredPhoto("missing.jpg", { root: dir });
    assert.equal(outcome, "missing");
  });

  await check("deletes a queued file and removes the job", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gjt-cleanup-"));
    const filename = "11111111-1111-4111-8111-111111111111.jpg";
    const abs = path.join(dir, filename);
    await writeFile(abs, "photo");
    const jobs: CleanupJob[] = [{ id: 1, filename }];
    const store = memoryStore(jobs);
    const result = await runPhotoCleanup({ store, photosDir: dir });
    assert.equal(result.removed, 1);
    assert.equal(result.failed, 0);
    assert.equal(jobs.length, 0);
    await assert.rejects(() => readFile(abs));
  });

  await check("repeat cleanup of an already-gone file succeeds and drops the job", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gjt-cleanup-"));
    const filename = "22222222-2222-4222-8222-222222222222.jpg";
    const jobs: CleanupJob[] = [{ id: 1, filename }];
    const store = memoryStore(jobs);
    const first = await runPhotoCleanup({ store, photosDir: dir });
    assert.equal(first.skipped, 1);
    assert.equal(jobs.length, 0);
    const second = await runPhotoCleanup({ store, photosDir: dir });
    assert.deepEqual(second, { removed: 0, failed: 0, skipped: 0 });
  });

  await check("filesystem failure keeps the job for retry", async () => {
    const filename = "33333333-3333-4333-8333-333333333333.jpg";
    const jobs: CleanupJob[] = [{ id: 7, filename }];
    const store = memoryStore(jobs);
    const result = await runPhotoCleanup({
      store,
      photosDir: "/tmp/gjt-cleanup-unused",
      unlinkFn: async () => {
        throw new FsError("EACCES", "permission denied");
      },
    });
    assert.equal(result.failed, 1);
    assert.equal(result.removed, 0);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].id, 7);
    assert.match(store.failed.get(7) || "", /permission denied/);
  });

  await check("does not delete a file still referenced by another photo", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gjt-cleanup-"));
    const filename = "44444444-4444-4444-8444-444444444444.jpg";
    const abs = path.join(dir, filename);
    await writeFile(abs, "keep");
    const jobs: CleanupJob[] = [{ id: 1, filename }];
    const store = memoryStore(jobs, new Set([filename]));
    let unlinked = false;
    const result = await runPhotoCleanup({
      store,
      photosDir: dir,
      unlinkFn: async () => {
        unlinked = true;
      },
    });
    assert.equal(unlinked, false);
    assert.equal(result.skipped, 1);
    assert.equal(jobs.length, 0);
    assert.equal(await readFile(abs, "utf8"), "keep");
  });

  await check("invalid filenames are not unlinked and are dropped", async () => {
    const jobs: CleanupJob[] = [{ id: 1, filename: "../etc/passwd" }];
    const store = memoryStore(jobs);
    let unlinked: string | null = null;
    const result = await runPhotoCleanup({
      store,
      photosDir: "/data/photos",
      unlinkFn: async (target) => {
        unlinked = target;
      },
    });
    assert.equal(unlinked, null);
    assert.equal(result.failed, 0);
    assert.equal(result.skipped, 1);
    assert.equal(jobs.length, 0);
  });

  await check("user delete queues cleanup before cascading photos", () => {
    const src = readFileSync(
      join(__dirname, "..", "src/app/api/admin/users/[id]/route.ts"),
      "utf8"
    );
    assert.match(src, /queuePhotosThenDeleteUser\(userId\)/);
    assert.equal(src.includes("prisma.user.delete"), false);
  });

  await check("queuePhotosThenDeleteUser copies filenames before deleting the user", () => {
    const src = readFileSync(
      join(__dirname, "..", "src/lib/photoCleanupDb.ts"),
      "utf8"
    );
    const fnStart = src.indexOf("export async function queuePhotosThenDeleteUser");
    assert.ok(fnStart >= 0);
    const fn = src.slice(fnStart);
    const photoFind = fn.indexOf("tx.photo.findMany");
    const jobWrite = fn.indexOf("tx.photoCleanupJob.createMany");
    const userDelete = fn.indexOf("tx.user.delete");
    assert.ok(photoFind >= 0, "must read photos");
    assert.ok(jobWrite > photoFind, "must write jobs after reading photos");
    assert.ok(userDelete > jobWrite, "must delete the user after writing jobs");
  });

  await check("delete response includes leftover cleanup counts", () => {
    const src = readFileSync(
      join(__dirname, "..", "src/app/api/admin/users/[id]/route.ts"),
      "utf8"
    );
    assert.match(src, /success:\s*true,\s*cleanup/);
  });

  await check("startup photo cleanup does not block register()", () => {
    const src = readFileSync(join(__dirname, "..", "src/instrumentation.ts"), "utf8");
    assert.match(src, /void import\("@\/lib\/photoCleanupDb"\)/);
    assert.equal(/await processPendingPhotoCleanup/.test(src), false);
  });

  await check("cleanup jobs have no foreign key to User or Photo", () => {
    const sql = readFileSync(
      join(
        __dirname,
        "..",
        "prisma/migrations/20260917120000_photo_cleanup_job/migration.sql"
      ),
      "utf8"
    );
    assert.match(sql, /CREATE TABLE "PhotoCleanupJob"/);
    assert.equal(/REFERENCES "User"/.test(sql), false);
    assert.equal(/REFERENCES "Photo"/.test(sql), false);
    assert.equal(/ON DELETE CASCADE/.test(sql), false);
  });

  if (failed > 0) {
    console.error(`\n${failed} photo-cleanup check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll photo-cleanup checks passed.");
}

void main();
