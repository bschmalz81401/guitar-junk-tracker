import Link from "next/link";
import type { CategoryDef } from "@/types/categories";
import type { ItemWithRelations } from "@/lib/items";
import { specOf } from "@/lib/items";
import { canRevealPricePaid, canRevealSerialNumber } from "@/lib/privacy";
import PhotoGallery from "@/components/PhotoGallery";
import SpecTable from "@/components/SpecTable";
import ModHistory from "@/components/ModHistory";
import DeleteItemButton from "@/components/DeleteItemButton";
import DuplicateItemButton from "@/components/DuplicateItemButton";
import ItemStatusActions from "@/components/ItemStatusActions";
import Badge, { statusTone } from "@/components/ui/Badge";

export default function ItemDetailView({
  category,
  item,
  mode,
  pathPrefix = "",
  ownerDisplayName,
  ownerUsername,
}: {
  category: CategoryDef;
  item: ItemWithRelations;
  mode: "owner" | "public";
  pathPrefix?: string;
  ownerDisplayName?: string;
  ownerUsername?: string;
}) {
  const isOwner = mode === "owner";
  const listHref = `${pathPrefix}/${category.slug}`;
  const spec = specOf(item);

  const showPrice = canRevealPricePaid({
    viewerIsOwner: isOwner,
    pricePaid: item.pricePaid,
    pricePaidPublic: item.pricePaidPublic,
  });
  const showSerial = canRevealSerialNumber({
    viewerIsOwner: isOwner,
    serialNumber: item.serialNumber,
    serialNumberPublic: item.serialNumberPublic,
  });
  const showSource = isOwner && Boolean(item.acquisitionSource);
  const showNotes = isOwner && Boolean(item.notes);

  return (
    <div>
      <div className={`mb-6 ${isOwner ? "flex items-start justify-between gap-4 flex-wrap" : ""}`}>
        <div className="min-w-0">
          <Link
            href={listHref}
            className="text-sm text-[var(--muted)] hover:underline cursor-pointer"
          >
            ← Back to {category.plural.toLowerCase()}
          </Link>
          <h1 className="text-2xl font-semibold mt-1 tracking-tight">{item.name}</h1>
          <p className="text-[var(--muted)]">
            {item.brand} {item.model}
            {item.finishColor ? ` — ${item.finishColor}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(item.status)}>{item.status}</Badge>
            {!isOwner && ownerUsername && (
              <>
                <Badge tone="public">Public</Badge>
                <span className="text-xs text-[var(--muted)]">
                  From{" "}
                  <Link
                    href={`/${ownerUsername}`}
                    className="text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    {ownerDisplayName || ownerUsername}
                  </Link>
                </span>
              </>
            )}
          </div>
        </div>
        {isOwner && (
          <div className="flex flex-wrap gap-2 shrink-0 justify-end">
            <Link
              href={`/${category.slug}/${item.id}/edit`}
              className="inline-flex items-center justify-center min-h-11 rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-hover)] cursor-pointer transition-colors duration-150"
            >
              Edit
            </Link>
            <DuplicateItemButton
              itemId={item.id}
              categorySlug={category.slug}
              categoryLabel={category.label}
            />
            <DeleteItemButton
              itemId={item.id}
              categorySlug={category.slug}
              categoryLabel={category.label}
            />
          </div>
        )}
      </div>

      {isOwner && (
        <div className="card p-3 mb-6">
          <ItemStatusActions itemId={item.id} status={item.status} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <PhotoGallery
            itemId={item.id}
            photos={item.photos}
            canEdit={isOwner}
            categoryKey={category.key}
          />

          <div className="card p-4 mt-6">
            <h2 className="text-sm font-semibold text-[var(--accent)] mb-3">Ownership</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-[var(--muted)]">Status</span>
              <span className="capitalize">{item.status}</span>
              {item.dateAcquired && (
                <>
                  <span className="text-[var(--muted)]">Date Acquired</span>
                  <span>{new Date(item.dateAcquired).toLocaleDateString()}</span>
                </>
              )}
              {showSource && (
                <>
                  <span className="text-[var(--muted)]">Source</span>
                  <span>{item.acquisitionSource}</span>
                </>
              )}
              {showPrice && (
                <>
                  <span className="text-[var(--muted)]">Price Paid</span>
                  <span>${item.pricePaid!.toLocaleString()}</span>
                </>
              )}
              {showSerial && (
                <>
                  <span className="text-[var(--muted)]">Serial Number</span>
                  <span className="font-mono text-sm">{item.serialNumber}</span>
                </>
              )}
            </div>
          </div>

          {showNotes && (
            <div className="card p-4 mt-6">
              <h2 className="text-sm font-semibold text-[var(--accent)] mb-3">Notes</h2>
              <p className="text-sm whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}
        </div>

        <div>
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-[var(--accent)] mb-3">Specs</h2>
            <SpecTable category={category} spec={spec} />
          </div>

          <div className="card p-4 mt-6">
            <h2 className="text-sm font-semibold text-[var(--accent)] mb-3">Mod History</h2>
            <ModHistory
              itemId={item.id}
              canEdit={isOwner}
              mods={item.mods.map((m) => ({
                id: m.id,
                date: m.date.toISOString(),
                description: m.description,
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
