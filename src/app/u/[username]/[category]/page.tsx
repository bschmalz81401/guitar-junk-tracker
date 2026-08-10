import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildItemWhere, readSpecFilters } from "@/lib/items";
import { getPublicUser } from "@/lib/publicCatalog";
import { categoryBySlug } from "@/types/categories";
import CategoryListView from "@/components/CategoryListView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ username: string; category: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PublicCategoryPage({ params, searchParams }: PageProps) {
  const { username, category: slug } = await params;
  const owner = await getPublicUser(username);
  const category = categoryBySlug(slug);
  if (!category) notFound();

  const sp = await searchParams;
  const str = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "");

  const where = buildItemWhere(owner.id, category, {
    search: str("search") || undefined,
    brand: str("brand") || undefined,
    status: str("status") || undefined,
    specFilters: readSpecFilters(category, (k) => str(k)),
  });

  const items = await prisma.item.findMany({
    where,
    include: {
      photos: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <CategoryListView
      category={category}
      mode="public"
      pathPrefix={`/${owner.username}`}
      ownerLabel={`${owner.name || owner.username}'s collection`}
      statusFilter={str("status") || null}
      items={items.map((item) => ({
        id: item.id,
        name: item.name,
        brand: item.brand,
        model: item.model,
        finishColor: item.finishColor,
        status: item.status,
        primaryPhotoPath: item.photos[0]?.filePath ?? null,
      }))}
    />
  );
}
