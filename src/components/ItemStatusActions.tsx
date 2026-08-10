"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ITEM_STATUSES, type ItemStatus } from "@/types/categories";
import Alert from "@/components/ui/Alert";

const LABELS: Record<ItemStatus, string> = {
  owned: "Owned",
  sold: "Sold",
  wishlist: "Wishlist",
};

export default function ItemStatusActions({
  itemId,
  status,
}: {
  itemId: number;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = (ITEM_STATUSES as readonly string[]).includes(status)
    ? (status as ItemStatus)
    : "owned";

  async function setStatus(next: ItemStatus) {
    if (next === current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || `Update failed (HTTP ${res.status}).`);
        setBusy(false);
        return;
      }
      router.refresh();
      setBusy(false);
    } catch {
      setError("Couldn't reach the server.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-[var(--muted)] mr-1">Status</span>
        {ITEM_STATUSES.map((s) => {
          const active = s === current;
          return (
            <button
              key={s}
              type="button"
              disabled={busy || active}
              onClick={() => setStatus(s)}
              aria-pressed={active}
              className={`chip capitalize transition-colors ${
                active
                  ? s === "wishlist"
                    ? "bg-amber-500/25 text-amber-300 ring-1 ring-amber-500/40"
                    : s === "sold"
                      ? "bg-zinc-500/25 text-zinc-300 ring-1 ring-zinc-500/40"
                      : "bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-500/40"
                  : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              } disabled:cursor-default`}
            >
              {LABELS[s]}
            </button>
          );
        })}
      </div>
      <Alert>{error}</Alert>
    </div>
  );
}
