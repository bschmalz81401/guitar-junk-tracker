"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ITEM_STATUSES, type CategoryDef, type ItemStatus } from "@/types/categories";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";

const STATUS_CHIP: Record<ItemStatus, { idle: string; active: string }> = {
  owned: {
    idle: "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)]",
    active: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40",
  },
  sold: {
    idle: "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)]",
    active: "bg-zinc-500/20 text-zinc-300 ring-1 ring-zinc-500/40",
  },
  wishlist: {
    idle: "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)]",
    active: "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40",
  },
};

const DEBOUNCE_MS = 350;

function paramsFromUrl(
  searchParams: URLSearchParams,
  category: CategoryDef
): {
  search: string;
  brand: string;
  status: string;
  specValues: Record<string, string>;
} {
  return {
    search: searchParams.get("search") ?? "",
    brand: searchParams.get("brand") ?? "",
    status: searchParams.get("status") ?? "",
    specValues: Object.fromEntries(
      category.filters.map((f) => [f.param, searchParams.get(f.param) ?? ""])
    ),
  };
}

function serializeFilters(next: {
  search: string;
  brand: string;
  status: string;
  specValues: Record<string, string>;
}): string {
  const params = new URLSearchParams();
  if (next.search) params.set("search", next.search);
  if (next.brand) params.set("brand", next.brand);
  if (next.status) params.set("status", next.status);
  for (const [key, value] of Object.entries(next.specValues)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export default function FilterBar({
  category,
  basePath,
}: {
  category: CategoryDef;
  /** Defaults to /{category.slug}. Use /username/guitars for public catalogs. */
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const path = basePath ?? `/${category.slug}`;
  const urlKey = searchParams.toString();

  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [brand, setBrand] = useState(() => searchParams.get("brand") ?? "");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const [specValues, setSpecValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(category.filters.map((f) => [f.param, searchParams.get(f.param) ?? ""]))
  );

  // Tracks the last URL string *we* pushed so we can ignore echo updates and only
  // resync local state for external navigations (back/forward, Clear link).
  const lastPushedUrl = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstDebounce = useRef(true);

  // External URL → local state (no remount, keeps focus while typing).
  useEffect(() => {
    if (lastPushedUrl.current !== null && lastPushedUrl.current === urlKey) {
      return;
    }
    // External change (or first mount after navigation we did not push).
    const fromUrl = paramsFromUrl(searchParams, category);
    setSearch(fromUrl.search);
    setBrand(fromUrl.brand);
    setStatus(fromUrl.status);
    setSpecValues(fromUrl.specValues);
    lastPushedUrl.current = urlKey;
    // Do not immediately re-push from this sync.
    skipFirstDebounce.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from urlKey only
  }, [urlKey]);

  function buildParams(next: {
    search?: string;
    brand?: string;
    status?: string;
    specValues?: Record<string, string>;
  }) {
    return serializeFilters({
      search: next.search ?? search,
      brand: next.brand ?? brand,
      status: next.status !== undefined ? next.status : status,
      specValues: next.specValues ?? specValues,
    });
  }

  function navigate(qs: string) {
    lastPushedUrl.current = qs;
    router.push(`${path}${qs ? `?${qs}` : ""}`);
  }

  // Debounced auto-apply for text filters (search, brand, specs) — stays mounted.
  useEffect(() => {
    if (skipFirstDebounce.current) {
      skipFirstDebounce.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const qs = buildParams({});
      if (qs === urlKey) return;
      navigate(qs);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, brand, specValues]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(buildParams({}));
  }

  function clearFilters() {
    setSearch("");
    setBrand("");
    setStatus("");
    setSpecValues(Object.fromEntries(category.filters.map((f) => [f.param, ""])));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    skipFirstDebounce.current = true;
    lastPushedUrl.current = "";
    router.push(path);
  }

  function selectStatus(next: string) {
    const value = status === next ? "" : next;
    setStatus(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(buildParams({ status: value }));
  }

  return (
    <form onSubmit={applyFilters} className="card p-4 mb-6 space-y-3">
      <div className="flex flex-wrap gap-2 items-center" role="group" aria-label="Status filter">
        <span className="text-xs text-[var(--muted)] mr-1">Status</span>
        <button
          type="button"
          onClick={() => selectStatus("")}
          aria-pressed={!status}
          className={`chip ${
            !status
              ? "bg-[var(--accent)]/20 text-[var(--accent)] ring-1 ring-[var(--accent)]/40"
              : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)]"
          }`}
        >
          All
        </button>
        {ITEM_STATUSES.map((s) => {
          const active = status === s;
          const styles = STATUS_CHIP[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => selectStatus(s)}
              aria-pressed={active}
              className={`chip capitalize ${active ? styles.active : styles.idle}`}
            >
              {s}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <Field label="Search" className="min-w-[min(100%,12rem)] flex-1 sm:flex-none">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, brand, model..."
            className="w-full sm:w-48"
            autoComplete="off"
          />
        </Field>
        <Field label="Brand" className="min-w-[min(100%,9rem)] flex-1 sm:flex-none">
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full sm:w-36"
            autoComplete="off"
          />
        </Field>

        {category.filters.map((f) => (
          <Field
            key={f.param}
            label={f.label}
            className="min-w-[min(100%,9rem)] flex-1 sm:flex-none"
          >
            <input
              value={specValues[f.param] ?? ""}
              onChange={(e) =>
                setSpecValues((v) => ({ ...v, [f.param]: e.target.value }))
              }
              className="w-full sm:w-36"
              autoComplete="off"
            />
          </Field>
        ))}

        <div className="flex gap-2">
          <Button type="submit" size="md">
            Filter
          </Button>
          <Button type="button" variant="secondary" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Search and brand update automatically after you pause typing.
      </p>
    </form>
  );
}
