export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { processPendingPhotoCleanup } = await import("@/lib/photoCleanupDb");
    const result = await processPendingPhotoCleanup();
    if (result.removed || result.failed || result.skipped) {
      console.info("[photo-cleanup] startup", result);
    }
  } catch (err) {
    console.error("[photo-cleanup] startup retry failed", err);
  }
}
