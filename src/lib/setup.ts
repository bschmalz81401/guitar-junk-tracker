import { prisma } from "@/lib/prisma";

/**
 * First-run setup is complete once at least one admin user exists. Until then
 * the app routes every request to the /setup wizard (see the root layout) and
 * /api/setup accepts the very first admin.
 */
export async function isSetupComplete(): Promise<boolean> {
  const admins = await prisma.user.count({ where: { role: "admin" } });
  return admins > 0;
}
