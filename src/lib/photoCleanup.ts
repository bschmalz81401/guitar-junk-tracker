import { unlinkStoredPhoto } from "@/lib/storage";

export type CleanupJob = { id: number; filename: string };

export type CleanupStore = {
  listJobs(): Promise<CleanupJob[]>;
  deleteJob(id: number): Promise<void>;
  markFailed(id: number, error: string): Promise<void>;
  isFilenameInUse(filename: string): Promise<boolean>;
};

export type CleanupResult = {
  removed: number;
  failed: number;
  skipped: number;
};

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Photo cleanup failed";
}

function isMissingRecord(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  if (code === "P2025") return true;
  return err instanceof Error && /record to delete does not exist/i.test(err.message);
}

async function dropJob(store: CleanupStore, id: number): Promise<void> {
  try {
    await store.deleteJob(id);
  } catch (err) {
    if (!isMissingRecord(err)) throw err;
  }
}

/**
 * Process queued photo-file deletions. Idempotent: a missing file is success.
 * Never unlinks a name still referenced by a Photo row, or a path outside the
 * photos directory.
 */
export async function runPhotoCleanup(opts: {
  store: CleanupStore;
  photosDir: string;
  unlinkFn?: (target: string) => Promise<void>;
}): Promise<CleanupResult> {
  const result: CleanupResult = { removed: 0, failed: 0, skipped: 0 };
  const jobs = await opts.store.listJobs();

  for (const job of jobs) {
    try {
      if (await opts.store.isFilenameInUse(job.filename)) {
        await dropJob(opts.store, job.id);
        result.skipped += 1;
        continue;
      }
      const outcome = await unlinkStoredPhoto(job.filename, {
        root: opts.photosDir,
        unlinkFn: opts.unlinkFn,
      });
      await dropJob(opts.store, job.id);
      if (outcome === "deleted") result.removed += 1;
      else result.skipped += 1;
    } catch (err) {
      if (err instanceof Error && err.message === "Invalid photo filename") {
        await dropJob(opts.store, job.id);
        result.skipped += 1;
        continue;
      }
      result.failed += 1;
      try {
        await opts.store.markFailed(job.id, errorMessage(err));
      } catch (markErr) {
        if (!isMissingRecord(markErr)) {
          console.error("[photo-cleanup] could not record failure", markErr);
        }
      }
    }
  }

  return result;
}
