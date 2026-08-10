"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import CategoryIcon from "./CategoryIcon";
import GearPhoto from "./GearPhoto";
import type { CategoryKey } from "@/types/categories";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface Photo {
  id: number;
  filePath: string;
  caption: string | null;
  isPrimary: boolean;
}

export default function PhotoGallery({
  itemId,
  photos,
  canEdit = false,
  categoryKey,
}: {
  itemId: number;
  photos: Photo[];
  canEdit?: boolean;
  categoryKey: CategoryKey;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const active = photos[activeIndex];

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setActionError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/items/${itemId}/photos`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setActionError(body?.error || `Upload failed (HTTP ${res.status}).`);
        return;
      }
      router.refresh();
    } catch {
      setActionError("Couldn't reach the server.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAddFromUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!photoUrl.trim()) return;

    setUploading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/items/${itemId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: photoUrl.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setActionError(body?.error || "Failed to download image from that URL.");
        return;
      }

      setPhotoUrl("");
      router.refresh();
    } catch {
      setActionError("Couldn't reach the server.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!active) return;
    setDeleting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/items/${itemId}/photos/${active.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setActionError(body?.error || `Delete failed (HTTP ${res.status}).`);
        setDeleting(false);
        return;
      }
      setDeleteOpen(false);
      setDeleting(false);
      setActiveIndex(0);
      router.refresh();
    } catch {
      setActionError("Couldn't reach the server.");
      setDeleting(false);
    }
  }

  async function handleSetPrimary(photoId: number) {
    setActionError(null);
    try {
      const res = await fetch(`/api/items/${itemId}/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setActionError(body?.error || `Update failed (HTTP ${res.status}).`);
        return;
      }
      router.refresh();
    } catch {
      setActionError("Couldn't reach the server.");
    }
  }

  return (
    <div>
      <div className="relative aspect-[4/3] card overflow-hidden mb-3">
        {active ? (
          <GearPhoto
            src={`/api/photos/${active.filePath}`}
            alt={active.caption ?? "Gear photo"}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 500px"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--muted)] opacity-40">
            <CategoryIcon category={categoryKey} className="w-24 h-24" />
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Show photo ${i + 1}${p.isPrimary ? " (primary)" : ""}`}
              aria-pressed={i === activeIndex}
              className={`relative w-16 h-16 min-w-11 min-h-11 rounded-md overflow-hidden border cursor-pointer transition-colors duration-150 ${
                i === activeIndex ? "border-[var(--accent)]" : "border-[var(--border)]"
              }`}
            >
              <GearPhoto
                src={`/api/photos/${p.filePath}`}
                alt={p.caption ?? `Gear photo ${i + 1}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}

      {canEdit && active && (
        <div className="flex gap-3 mb-3 text-sm flex-wrap">
          {!active.isPrimary && (
            <button
              type="button"
              onClick={() => handleSetPrimary(active.id)}
              className="text-[var(--accent)] hover:underline min-h-11 cursor-pointer"
            >
              Set as primary
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              setDeleteOpen(true);
            }}
            className="text-red-400 hover:underline min-h-11 cursor-pointer"
          >
            Delete photo
          </button>
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center justify-center min-h-11 cursor-pointer rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)] transition-colors duration-150">
            {uploading ? "Working..." : "+ Add photo"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>

          <form onSubmit={handleAddFromUrl} className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <label htmlFor={urlId} className="sr-only">
              Image URL
            </label>
            <input
              id={urlId}
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="Paste an image URL..."
              disabled={uploading}
              className="w-full sm:w-56 min-w-0"
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={uploading || !photoUrl.trim()}
            >
              Add from URL
            </Button>
          </form>
        </div>
      )}
      {canEdit && !deleteOpen && <Alert className="mt-2">{actionError}</Alert>}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this photo?"
        description="The file will be removed from this item. This cannot be undone."
        error={deleteOpen ? actionError : null}
        confirmLabel="Delete photo"
        destructive
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!deleting) {
            setDeleteOpen(false);
            setActionError(null);
          }
        }}
      />
    </div>
  );
}
