"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function DeleteItemButton({
  itemId,
  categorySlug,
  categoryLabel,
}: {
  itemId: number;
  categorySlug: string;
  categoryLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = useCallback(() => {
    if (!deleting) {
      setOpen(false);
      setError(null);
    }
  }, [deleting]);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || `Delete failed (HTTP ${res.status}).`);
        setDeleting(false);
        return;
      }
      setOpen(false);
      router.push(`/${categorySlug}`);
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="danger"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={deleting}
      >
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        title={`Delete this ${categoryLabel.toLowerCase()}?`}
        description="All photos and mod history for this item will be removed. This cannot be undone."
        error={error}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={handleCancel}
      />
    </div>
  );
}
