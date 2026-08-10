import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { itemInclude } from "@/lib/items";
import { categoryBySlug, categoryByKey } from "@/types/categories";
import ItemDetailView from "@/components/ItemDetailView";

interface PageProps {
  params: Promise<{ category: string; id: string }>;
}

export default async function ItemDetailPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login?from=/");

  const { category: slug, id } = await params;
  const category = categoryBySlug(slug);
  if (!category) notFound();

  const itemId = Number(id);
  if (!Number.isInteger(itemId)) notFound();

  const item = await prisma.item.findFirst({
    where: { id: itemId, userId: user.id },
    include: itemInclude,
  });
  if (!item) notFound();

  // Wrong category slug → redirect to the item's real home.
  if (item.category !== category.key) {
    const actual = categoryByKey(item.category);
    if (actual) redirect(`/${actual.slug}/${item.id}`);
    notFound();
  }

  return <ItemDetailView category={category} item={item} mode="owner" />;
}
