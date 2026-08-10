import Link from "next/link";
import CategoryIcon from "./CategoryIcon";
import GearPhoto from "./GearPhoto";
import Badge, { statusTone } from "./ui/Badge";
import type { CategoryKey } from "@/types/categories";

interface ItemCardProps {
  id: number;
  categorySlug: string;
  categoryKey: CategoryKey;
  name: string;
  brand: string;
  model: string;
  finishColor: string | null;
  status: string;
  primaryPhotoPath: string | null;
  /** Override link base, e.g. /username/guitars for public catalogs. */
  hrefBase?: string;
  /** Multi-select compare mode */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
  priority?: boolean;
}

export default function ItemCard({
  id,
  categorySlug,
  categoryKey,
  name,
  brand,
  model,
  finishColor,
  status,
  primaryPhotoPath,
  hrefBase,
  selectable = false,
  selected = false,
  onToggleSelect,
  priority = false,
}: ItemCardProps) {
  const href = hrefBase ? `${hrefBase}/${id}` : `/${categorySlug}/${id}`;

  const media = (
    <div className="relative aspect-[4/3] bg-[var(--surface-hover)]">
      {primaryPhotoPath ? (
        <GearPhoto
          src={`/api/photos/${primaryPhotoPath}`}
          alt={name}
          fill
          className="object-contain"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          priority={priority}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-[var(--muted)] opacity-40">
          <CategoryIcon category={categoryKey} className="w-16 h-16" />
        </div>
      )}
      <Badge tone={statusTone(status)} className="absolute top-2 right-2">
        {status}
      </Badge>
      {selectable && (
        <span
          className={`absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold ${
            selected
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--background)]"
              : "border-[var(--border)] bg-black/50 text-white"
          }`}
          aria-hidden
        >
          {selected ? "✓" : ""}
        </span>
      )}
    </div>
  );

  const body = (
    <div className="p-4">
      <h3 className="font-semibold group-hover:text-[var(--accent)] transition-colors duration-150">
        {name}
      </h3>
      <p className="text-sm text-[var(--muted)]">
        {brand} {model}
      </p>
      {finishColor && <p className="text-sm text-[var(--muted)] mt-1">{finishColor}</p>}
    </div>
  );

  if (selectable && onToggleSelect) {
    return (
      <button
        type="button"
        onClick={() => onToggleSelect(id)}
        aria-pressed={selected}
        className={`card card-interactive overflow-hidden group text-left w-full cursor-pointer ${
          selected ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/40" : ""
        }`}
      >
        {media}
        {body}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className="card card-interactive overflow-hidden group cursor-pointer"
    >
      {media}
      {body}
    </Link>
  );
}
