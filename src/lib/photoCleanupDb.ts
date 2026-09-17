import { prisma } from "@/lib/prisma";
import { runPhotoCleanup, type CleanupResult, type CleanupStore } from "@/lib/photoCleanup";
import { photosDir } from "@/lib/storage";

export function prismaCleanupStore(): CleanupStore {
  return {
    listJobs: () =>
      prisma.photoCleanupJob.findMany({
        orderBy: { id: "asc" },
        select: { id: true, filename: true },
      }),
    deleteJob: async (id) => {
      await prisma.photoCleanupJob.delete({ where: { id } });
    },
    markFailed: async (id, error) => {
      await prisma.photoCleanupJob.update({
        where: { id },
        data: { lastError: error.slice(0, 500), attempts: { increment: 1 } },
      });
    },
    isFilenameInUse: async (filename) =>
      (await prisma.photo.count({ where: { filePath: filename } })) > 0,
  };
}

export async function queuePhotosThenDeleteUser(userId: number): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const photos = await tx.photo.findMany({
      where: { item: { userId } },
      select: { filePath: true },
    });
    const filenames = [...new Set(photos.map((p) => p.filePath))];
    for (const filename of filenames) {
      await tx.photoCleanupJob.upsert({
        where: { filename },
        create: { filename },
        update: {},
      });
    }
    await tx.user.delete({ where: { id: userId } });
    return filenames.length;
  });
}

export async function processPendingPhotoCleanup(): Promise<CleanupResult> {
  return runPhotoCleanup({
    store: prismaCleanupStore(),
    photosDir: photosDir(),
  });
}

export async function pendingPhotoCleanupCount(): Promise<number> {
  return prisma.photoCleanupJob.count();
}
