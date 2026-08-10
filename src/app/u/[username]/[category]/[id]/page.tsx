import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { itemInclude } from "@/lib/items";
import { getPublicUser } from "@/lib/publicCatalog";
import { categoryBySlug } from "@/types/categories";
import ItemDetailView from "@/components/ItemDetailView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ username: string; category: string; id: string }>;
}

export default async function PublicItemDetailPage({ params }: PageProps) {
  const { username, category: slug, id } = await params;
  const owner = await getPublicUser(username);
  const category = categoryBySlug(slug);
  if (!category) notFound();

  const itemId = Number(id);
  if (!Number.isInteger(itemId)) notFound();

  const item = await prisma.item.findFirst({
    where: { id: itemId, userId: owner.id },
    include: itemInclude,
  });
  if (!item) notFound();
  if (item.category !== category.key) notFound();

  return (
    <ItemDetailView
      category={category}
      item={item}
      mode="public"
      pathPrefix={`/${owner.username}`}
      ownerDisplayName={owner.name || owner.username}
      ownerUsername={owner.username}
    />
  );
}
