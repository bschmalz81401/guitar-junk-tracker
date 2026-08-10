import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { itemInclude, specOf } from "@/lib/items";
import { categoryBySlug, categoryByKey, specFieldKeys } from "@/types/categories";
import ItemForm, { type ItemFormValues } from "@/components/ItemForm";

interface PageProps {
  params: Promise<{ category: string; id: string }>;
}

export default async function EditItemPage({ params }: PageProps) {
  const { category: slug, id } = await params;
  const category = categoryBySlug(slug);
  if (!category) notFound();

  const user = await getSessionUser();
  if (!user) redirect(`/login?from=/${category.slug}/${id}/edit`);

  const item = await prisma.item.findFirst({
    where: { id: Number(id), userId: user.id },
    include: itemInclude,
  });
  if (!item) notFound();

  if (item.category !== category.key) {
    const actual = categoryByKey(item.category);
    if (actual) redirect(`/${actual.slug}/${item.id}/edit`);
    notFound();
  }

  const spec = specOf(item);
  const specValues: Record<string, string | number | boolean | undefined> = {};
  if (spec) {
    for (const key of specFieldKeys(category)) {
      const value = spec[key];
      specValues[key] =
        value === null || value === undefined ? undefined : (value as string | number | boolean);
    }
  }

  const initialValues: Partial<ItemFormValues> = {
    id: item.id,
    name: item.name,
    brand: item.brand,
    model: item.model,
    series: item.series ?? "",
    finishColor: item.finishColor ?? "",
    dateAcquired: item.dateAcquired ? item.dateAcquired.toISOString().slice(0, 10) : "",
    acquisitionSource: item.acquisitionSource ?? "",
    pricePaid: item.pricePaid != null ? String(item.pricePaid) : "",
    pricePaidPublic: item.pricePaidPublic,
    serialNumber: item.serialNumber ?? "",
    serialNumberPublic: item.serialNumberPublic,
    status: item.status,
    notes: item.notes ?? "",
    ...specValues,
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Edit {item.name}</h1>
      <ItemForm category={category} initialValues={initialValues} />
    </div>
  );
}
