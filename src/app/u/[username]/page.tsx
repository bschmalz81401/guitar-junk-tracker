import { categoryCounts, randomCategoryCovers } from "@/lib/items";
import { getPublicUser } from "@/lib/publicCatalog";
import CategoryGrid from "@/components/CategoryGrid";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function PublicCatalogHome({ params }: PageProps) {
  const { username } = await params;
  const owner = await getPublicUser(username);

  const [counts, coverByCategory] = await Promise.all([
    categoryCounts(owner.id),
    randomCategoryCovers(owner.id),
  ]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const displayName = owner.name || owner.username;

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm text-[var(--muted)]">Public collection</p>
        <h1 className="text-3xl font-semibold mt-1">
          {displayName}
          <span className="text-[var(--muted)] font-normal text-xl ml-2">
            @{owner.username}
          </span>
        </h1>
        {owner.location && (
          <p className="text-sm text-[var(--muted)] mt-1">{owner.location}</p>
        )}
        {owner.bio && (
          <p className="text-sm mt-3 max-w-2xl whitespace-pre-wrap">{owner.bio}</p>
        )}
        <p className="text-sm text-[var(--accent)] mt-3">
          {total} {total === 1 ? "piece" : "pieces"} of gear
        </p>
      </div>

      <CategoryGrid
        counts={counts}
        coverByCategory={coverByCategory}
        hrefFor={(slug) => `/${owner.username}/${slug}`}
      />
    </div>
  );
}
