import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  pendingPhotoCleanupCount,
  processPendingPhotoCleanup,
} from "@/lib/photoCleanupDb";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const pending = await pendingPhotoCleanupCount();
  return NextResponse.json({ pending });
}

export async function POST() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const result = await processPendingPhotoCleanup();
  const pending = await pendingPhotoCleanupCount();
  return NextResponse.json({ ...result, pending });
}
