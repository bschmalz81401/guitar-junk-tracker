import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { categoryCounts, randomCategoryCovers } from "@/lib/items";
import { getSettings } from "@/lib/settings";
import { guestVisibleCategoryCounts } from "@/lib/privacy";
import { getShowcaseUser } from "@/lib/showcase";
import { CATEGORY_LIST } from "@/types/categories";
import CategoryGrid from "@/components/CategoryGrid";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  const settings = await getSettings();

  if (!user) {
    const showcase = await getShowcaseUser();
    const isPublic = Boolean(showcase?.catalogPublic && showcase.username);
    const [rawCounts, coverByCategory] =
      isPublic && showcase
        ? await Promise.all([
            categoryCounts(showcase.id),
            randomCategoryCovers(showcase.id),
          ])
        : [{}, {} as Record<string, string>];
    const safeCounts = guestVisibleCategoryCounts(
      isPublic,
      rawCounts,
      CATEGORY_LIST.map((c) => c.key)
    );
    const total = Object.values(safeCounts).reduce((a, b) => a + b, 0);
    const publicBase = isPublic ? `/${showcase!.username}` : null;

    return (
      <div>
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Guitar Junk Tracker</h1>
            <p className="text-[var(--muted)] mt-1">
              {isPublic
                ? `Browse the public collection${total > 0 ? ` (${total} pieces)` : ""} — log in to manage your own gear.`
                : `Preview of the collection — log in to manage your own gear${total > 0 ? ` (${total} pieces shown)` : ""}.`}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/login"
              className="inline-flex items-center justify-center min-h-11 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-hover)] cursor-pointer transition-colors duration-150"
            >
              Log in
            </Link>
            {settings.allowSignup && (
              <Link
                href="/signup"
                className="inline-flex items-center justify-center min-h-11 rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-hover)] cursor-pointer transition-colors duration-150"
              >
                Sign up
              </Link>
            )}
          </div>
        </div>

        <CategoryGrid
          counts={safeCounts}
          coverByCategory={coverByCategory}
          hrefFor={(slug) =>
            publicBase ? `${publicBase}/${slug}` : `/login?from=/${slug}`
          }
          preview={!isPublic}
        />
      </div>
    );
  }

  const [counts, coverByCategory] = await Promise.all([
    categoryCounts(user.id),
    randomCategoryCovers(user.id),
  ]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const firstCategory = CATEGORY_LIST[0];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Your collection</h1>
        <p className="text-[var(--muted)] mt-1">
          {total === 0
            ? "Empty vault — add your first piece of gear."
            : `${total} ${total === 1 ? "piece" : "pieces"} of gear. Pick a category to browse.`}
        </p>
        {total > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORY_LIST.filter((c) => (counts[c.key] ?? 0) > 0).map((c) => (
              <Badge key={c.key} tone="accent">
                {c.plural}: {counts[c.key]}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {total === 0 ? (
        <EmptyState
          title="No gear yet"
          description="Track guitars, amps, cabs, pedals, multi-FX, and more — with specs, photos, and mod history."
          action={
            <Link
              href={`/${firstCategory.slug}/new`}
              className="inline-flex items-center justify-center min-h-11 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-hover)] cursor-pointer"
            >
              + Add your first {firstCategory.label.toLowerCase()}
            </Link>
          }
        />
      ) : (
        <CategoryGrid
          counts={counts}
          coverByCategory={coverByCategory}
          hrefFor={(slug) => `/${slug}`}
        />
      )}
    </div>
  );
}
