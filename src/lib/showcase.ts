import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export type ShowcaseUser = {
  id: number;
  username: string;
  /** When true, guests can browse this collection at /{username}. */
  catalogPublic: boolean;
};

/**
 * Collection shown on the guest landing page.
 * Order: AppSettings.showcaseEmail → SHOWCASE_EMAIL env → first admin.
 */
export async function getShowcaseUser(): Promise<ShowcaseUser | null> {
  const select = { id: true, username: true, catalogPublic: true } as const;

  const settings = await getSettings();
  const preferredEmail =
    settings.showcaseEmail?.trim() ||
    process.env.SHOWCASE_EMAIL?.trim() ||
    "";

  if (preferredEmail) {
    const preferred = await prisma.user.findUnique({
      where: { email: preferredEmail },
      select,
    });
    if (preferred) return preferred;
  }

  const admin = await prisma.user.findFirst({
    where: { role: "admin" },
    orderBy: { id: "asc" },
    select,
  });
  return admin;
}
