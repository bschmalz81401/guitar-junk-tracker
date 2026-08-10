import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { article } from "@/lib/format";
import { categoryBySlug } from "@/types/categories";
import ItemForm from "@/components/ItemForm";
import CategoryIcon from "@/components/CategoryIcon";

interface PageProps {
  params: Promise<{ category: string }>;
}

export default async function NewItemPage({ params }: PageProps) {
  const { category: slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) notFound();

  if (!(await getSessionUser())) redirect(`/login?from=/${category.slug}/new`);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6 flex items-center gap-2">
        <CategoryIcon category={category.key} className="w-6 h-6 text-[var(--accent)]" />
        Add {article(category.label)} {category.label}
      </h1>
      <ItemForm category={category} />
    </div>
  );
}
