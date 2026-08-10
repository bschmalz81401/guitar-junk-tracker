import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isCatalogPubliclyAccessible } from "@/lib/privacy";
import { normalizeUsername } from "@/lib/username";

export async function getPublicUser(usernameRaw: string) {
  const username = normalizeUsername(usernameRaw);
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      bio: true,
      location: true,
      catalogPublic: true,
    },
  });
  if (!user || !isCatalogPubliclyAccessible(user.catalogPublic)) notFound();
  return user;
}
