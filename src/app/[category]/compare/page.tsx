import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { specOf } from "@/lib/items";
import { categoryBySlug } from "@/types/categories";
import CompareSelector from "@/components/CompareSelector";

interface PageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ComparePage({ params, searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login?from=/");

  const { category: slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) notFound();

  const sp = await searchParams;
  const idsParam = typeof sp.ids === "string" ? sp.ids : "";
  // Positive ints → unique → max 3 (matches list multi-select).
  const ids = Array.from(
    new Set(
      idsParam
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0)
    )
  ).slice(0, 3);

  const specInclude = { [category.specRelation]: true };

  const [allItems, items] = await Promise.all([
    prisma.item.findMany({
      where: { category: category.key, userId: user.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    ids.length > 0
      ? prisma.item.findMany({
          where: { id: { in: ids }, category: category.key, userId: user.id },
          include: specInclude,
        })
      : Promise.resolve([]),
  ]);

  const ordered = ids
    .map((id) => items.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  const allFields = category.specSections.flatMap((s) => s.fields);

  return (
    <div>
      <div className="mb-6">
        <Link href={`/${category.slug}`} className="text-sm text-[var(--muted)] hover:underline">
          ← Back to {category.plural.toLowerCase()}
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Compare {category.plural}</h1>
      </div>

      <CompareSelector category={category} items={allItems} selectedIds={ids} />

      {ordered.length === 0 ? (
        <div className="card p-10 text-center text-[var(--muted)]">
          {allItems.length === 0
            ? `No ${category.plural.toLowerCase()} to compare yet.`
            : `Pick ${category.plural.toLowerCase()} above to compare their specs.`}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left p-3 text-[var(--muted)] font-medium w-40">Spec</th>
                {ordered.map((item) => (
                  <th key={item.id} className="text-left p-3 font-medium">
                    <Link
                      href={`/${category.slug}/${item.id}`}
                      className="hover:text-[var(--accent)]"
                    >
                      {item.name}
                    </Link>
                    <div className="text-[var(--muted)] font-normal">
                      {item.brand} {item.model}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border)]">
                <td className="p-3 text-[var(--muted)]">{category.finishLabel}</td>
                {ordered.map((item) => (
                  <td key={item.id} className="p-3">
                    {item.finishColor || "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="p-3 text-[var(--muted)]">Status</td>
                {ordered.map((item) => (
                  <td key={item.id} className="p-3 capitalize">
                    {item.status}
                  </td>
                ))}
              </tr>
              {allFields.map((f) => {
                const values = ordered.map((item) => specOf(item)?.[f.key]);
                const anyValue = values.some(
                  (v) => v !== null && v !== undefined && v !== "" && v !== false
                );
                if (!anyValue) return null;
                return (
                  <tr key={f.key} className="border-b border-[var(--border)]">
                    <td className="p-3 text-[var(--muted)]">{f.label}</td>
                    {ordered.map((item, i) => {
                      const v = values[i];
                      return (
                        <td key={item.id} className="p-3">
                          {v === null || v === undefined || v === ""
                            ? "—"
                            : f.type === "boolean"
                              ? v
                                ? "Yes"
                                : "No"
                              : String(v)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
