import Link from "next/link";
import Image from "next/image";
import { CATEGORY_LIST } from "@/types/categories";
import CategoryIcon from "@/components/CategoryIcon";

export default function CategoryGrid({
  counts,
  coverByCategory,
  hrefFor,
  preview,
}: {
  counts: Record<string, number>;
  coverByCategory: Record<string, string>;
  hrefFor: (slug: string) => string;
  /** Private showcase teaser: login overlay on cards. */
  preview?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {CATEGORY_LIST.map((category, index) => {
        const count = counts[category.key] ?? 0;
        const cover = coverByCategory[category.key] ?? null;
        const image = cover ? `/api/photos/${cover}` : (category.coverImage ?? null);
        return (
          <Link
            key={category.key}
            href={hrefFor(category.slug)}
            className="card card-interactive overflow-hidden group cursor-pointer"
          >
            <div className="relative aspect-[4/3] bg-[var(--surface-hover)]">
              {image ? (
                <Image
                  src={image}
                  alt={`${category.plural} cover photo`}
                  fill
                  className="object-contain opacity-90 group-hover:opacity-100 transition-opacity duration-200"
                  sizes="(max-width: 768px) 100vw, 300px"
                  priority={index < 2}
                  quality={75}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[var(--muted)] opacity-40">
                  <CategoryIcon category={category.key} className="w-20 h-20" />
                </div>
              )}
              {preview && (
                <div className="absolute inset-0 bg-black/20 flex items-end justify-center pb-3 pointer-events-none">
                  <span className="text-xs font-medium text-white bg-black/65 px-2.5 py-1.5 rounded-md">
                    Log in to browse
                  </span>
                </div>
              )}
            </div>
            <div className="p-4">
              <h2 className="font-semibold text-lg flex items-center gap-2 group-hover:text-[var(--accent)] transition-colors duration-150">
                <CategoryIcon
                  category={category.key}
                  className="w-5 h-5 text-[var(--accent)] shrink-0"
                />
                {category.plural}
              </h2>
              <p className="text-sm text-[var(--muted)] mt-0.5">{category.blurb}</p>
              <p className="text-sm text-[var(--accent)] mt-2">
                {count} {count === 1 ? "item" : "items"}
                {preview ? " · preview" : ""}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
