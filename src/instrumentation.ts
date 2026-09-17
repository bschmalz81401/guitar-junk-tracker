export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Do not await: leftover unlinks must not block the server from listening.
  void import("@/lib/photoCleanupDb")
    .then(({ processPendingPhotoCleanup }) => processPendingPhotoCleanup())
    .then((result) => {
      if (result.removed || result.failed || result.skipped) {
        console.info("[photo-cleanup] startup", result);
      }
    })
    .catch((err) => {
      console.error("[photo-cleanup] startup retry failed", err);
    });
}
