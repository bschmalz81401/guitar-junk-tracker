import { NextResponse } from "next/server";
import { access, constants, mkdir } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { photosDir } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liveness/readiness for Docker/NAS monitors.
 * Unauthenticated. Does not leak secrets.
 */
export async function GET() {
  const checks: {
    db: "up" | "down";
    photos: "up" | "down";
  } = {
    db: "down",
    photos: "down",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = "up";
  } catch {
    checks.db = "down";
  }

  try {
    // Match entrypoint: ensure the photos dir exists, then verify R/W.
    const dir = photosDir();
    await mkdir(dir, { recursive: true });
    await access(dir, constants.R_OK | constants.W_OK);
    checks.photos = "up";
  } catch {
    checks.photos = "down";
  }

  const ok = checks.db === "up" && checks.photos === "up";
  const body = {
    ok,
    status: ok ? "healthy" : "unhealthy",
    service: "guitar-tracker",
    checks,
    time: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
