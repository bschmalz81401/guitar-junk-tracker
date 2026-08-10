"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function DuplicateItemButton({
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = useCallback(() => {
    if (!busy) {
      setOpen(false);
      setError(null);
    }
  }, [busy]);

  async function handleDuplicate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${itemId}/duplicate`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error || `Duplicate failed (HTTP ${res.status}).`);
        setBusy(false);
        return;
      }
      setOpen(false);
      const newId = body?.id;
      if (typeof newId === "number") {
        router.push(`/${categorySlug}/${newId}`);
      } else {
        router.push(`/${categorySlug}`);
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={busy}
      >
        {busy ? "Duplicating..." : "Duplicate"}
      </Button>
      <ConfirmDialog
        open={open}
        title={`Duplicate this ${categoryLabel.toLowerCase()}?`}
        description="Specs and ownership fields are copied; photos and mod history are not."
        error={error}
        confirmLabel="Duplicate"
        busy={busy}
        onConfirm={() => void handleDuplicate()}
        onCancel={handleCancel}
      />
    </div>
  );
}
