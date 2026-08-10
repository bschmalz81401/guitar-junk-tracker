import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { buildItemWhere, readSpecFilters } from "@/lib/items";
import { categoryBySlug } from "@/types/categories";
import CategoryListView from "@/components/CategoryListView";

interface PageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CategoryListPage({ params, searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login?from=/");

  const { category: slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) notFound();

  const sp = await searchParams;
  const str = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "");

  const where = buildItemWhere(user.id, category, {
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
      mode="owner"
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
