"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CategoryDef } from "@/types/categories";
import ItemCard from "@/components/ItemCard";
import CategoryIcon from "@/components/CategoryIcon";
import FilterBar from "@/components/FilterBar";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";

export type ListItem = {
  id: number;
  name: string;
  brand: string;
  model: string;
  finishColor: string | null;
  status: string;
  primaryPhotoPath: string | null;
};

const MAX_COMPARE = 3;

export default function CategoryListView({
  category,
  items,
  mode,
  /** Path prefix for filters and item links, e.g. "" or "/username". */
  pathPrefix = "",
  ownerLabel,
  /** Active status query filter, when set (owned / sold / wishlist). */
  statusFilter,
}: {
  category: CategoryDef;
  items: ListItem[];
  mode: "owner" | "public";
  pathPrefix?: string;
  /** Display name for public breadcrumb (owner mode uses "All gear"). */
  ownerLabel?: string;
  statusFilter?: string | null;
}) {
  const router = useRouter();
  const basePath = `${pathPrefix}/${category.slug}`;
  const isOwner = mode === "owner";
  const countLabel =
    items.length === 1 ? category.label.toLowerCase() : category.plural.toLowerCase();
  const statusLabel = statusFilter?.trim() || "";

  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [maxHint, setMaxHint] = useState<string | null>(null);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      if (prev.includes(id)) {
        setMaxHint(null);
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= MAX_COMPARE) {
        setMaxHint(`You can compare at most ${MAX_COMPARE} ${category.plural.toLowerCase()}.`);
        return prev;
      }
      setMaxHint(null);
      return [...prev, id];
    });
  }

  function startCompareMode() {
    setCompareMode(true);
    setSelected([]);
    setMaxHint(null);
  }

  function exitCompareMode() {
    setCompareMode(false);
    setSelected([]);
    setMaxHint(null);
  }

  function goCompare() {
    if (selected.length < 2) return;
    router.push(`/${category.slug}/compare?ids=${selected.join(",")}`);
  }

  const showMobileCompareBar = compareMode && selected.length > 0;

  return (
    <div className={showMobileCompareBar ? "pb-24 sm:pb-0" : undefined}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link
            href={isOwner ? "/" : pathPrefix || "/"}
            className="text-sm text-[var(--muted)] hover:underline cursor-pointer"
          >
            {isOwner ? "← All gear" : `← ${ownerLabel || "Collection"}`}
          </Link>
          <h1 className="text-2xl font-semibold mt-1 flex items-center gap-2">
            <CategoryIcon category={category.key} className="w-6 h-6 text-[var(--accent)]" />
            {category.plural}
          </h1>
          {!isOwner && ownerLabel && (
            <p className="text-sm text-[var(--muted)] mt-0.5 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-sky-500/15 text-sky-300">
                Public
              </span>
              collection
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <span className="text-sm text-[var(--muted)]">
            {items.length} {countLabel}
          </span>
          {isOwner && (
            <>
              {compareMode ? (
                <Button variant="secondary" size="sm" onClick={exitCompareMode}>
                  Cancel compare
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={startCompareMode}
                  disabled={items.length < 2}
                >
                  Compare
                </Button>
              )}
              <Link
                href={`/${category.slug}/new`}
                className="inline-flex items-center justify-center min-h-9 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--background)] font-medium hover:bg-[var(--accent-hover)] cursor-pointer transition-colors duration-150"
              >
                + Add {category.label}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Sticky action bar for owner list */}
      {isOwner && (
        <div className="sticky top-[3.75rem] z-30 -mx-1 mb-4 px-1 py-2 bg-[var(--background)]/90 backdrop-blur-sm border-b border-[var(--border)] flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--muted)] truncate">
            {compareMode
              ? `Select 2–${MAX_COMPARE} ${category.plural.toLowerCase()} to compare (${selected.length} selected)`
              : `${items.length} ${countLabel}`}
          </span>
          {maxHint && (
            <span className="sr-only" role="status" aria-live="polite">
              {maxHint}
            </span>
          )}
          <div className="flex items-center gap-2 shrink-0">
            {compareMode ? (
              <Button size="sm" onClick={goCompare} disabled={selected.length < 2}>
                Compare {selected.length || ""}
              </Button>
            ) : (
              <Link
                href={`/${category.slug}/new`}
                className="inline-flex items-center justify-center min-h-9 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--background)] font-medium hover:bg-[var(--accent-hover)] cursor-pointer"
              >
                + Add
              </Link>
            )}
          </div>
        </div>
      )}

      <FilterBar category={category} basePath={basePath} />

      {items.length === 0 ? (
        <EmptyState
          title={
            isOwner
              ? statusLabel === "wishlist"
                ? `No wishlist ${category.plural.toLowerCase()} yet`
                : statusLabel
                  ? `No ${statusLabel} matches`
                  : `No ${category.plural.toLowerCase()} yet`
              : `No ${category.plural.toLowerCase()} here`
          }
          description={
            isOwner ? (
              statusLabel === "wishlist" ? (
                <>
                  Add one and set status to wishlist, or clear the filter.
                </>
              ) : statusLabel ? (
                <>
                  Nothing matches these filters.{" "}
                  <Link href={basePath} className="text-[var(--accent)] hover:underline">
                    Clear filters
                  </Link>
                  .
                </>
              ) : (
                <>Start your collection with the first {category.label.toLowerCase()}.</>
              )
            ) : (
              <>No {category.plural.toLowerCase()} in this public collection.</>
            )
          }
          action={
            isOwner && !statusLabel ? (
              <Link
                href={`/${category.slug}/new`}
                className="inline-flex items-center justify-center min-h-11 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-hover)] cursor-pointer"
              >
                + Add {category.label}
              </Link>
            ) : isOwner && statusLabel ? (
              <Link
                href={basePath}
                className="inline-flex items-center justify-center min-h-11 rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-hover)] cursor-pointer"
              >
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item, i) => (
            <ItemCard
              key={item.id}
              id={item.id}
              categorySlug={category.slug}
              name={item.name}
              brand={item.brand}
              model={item.model}
              finishColor={item.finishColor}
              status={item.status}
              primaryPhotoPath={item.primaryPhotoPath}
              categoryKey={category.key}
              hrefBase={basePath}
              selectable={compareMode && isOwner}
              selected={selected.includes(item.id)}
              onToggleSelect={toggleSelect}
              priority={i < 4}
            />
          ))}
        </div>
      )}

      {maxHint && compareMode && (
        <p className="mt-3 text-xs text-amber-300 sm:hidden" role="status" aria-live="polite">
          {maxHint}
        </p>
      )}

      {/* Mobile sticky compare bar */}
      {showMobileCompareBar && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm p-3 sm:hidden">
          <div className="mx-auto max-w-6xl flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--muted)]">
              {selected.length} selected
              {maxHint ? ` · max ${MAX_COMPARE}` : ""}
            </span>
            <Button size="sm" onClick={goCompare} disabled={selected.length < 2}>
              Compare
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
