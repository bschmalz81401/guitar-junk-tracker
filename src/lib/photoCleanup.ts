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
        await opts.store.deleteJob(job.id);
        result.skipped += 1;
        continue;
      }
      const outcome = await unlinkStoredPhoto(job.filename, {
        root: opts.photosDir,
        unlinkFn: opts.unlinkFn,
      });
      await opts.store.deleteJob(job.id);
      if (outcome === "deleted") result.removed += 1;
      else result.skipped += 1;
    } catch (err) {
      result.failed += 1;
      try {
        await opts.store.markFailed(job.id, errorMessage(err));
      } catch (markErr) {
        console.error("[photo-cleanup] could not record failure", markErr);
      }
    }
  }

  return result;
}
