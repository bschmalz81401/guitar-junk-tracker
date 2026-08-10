"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Field from "@/components/ui/Field";

interface Mod {
  id: number;
  date: string;
  description: string;
}

export default function ModHistory({
  itemId,
  mods,
  canEdit = false,
}: {
  itemId: number;
  mods: Mod[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !description) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${itemId}/mods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, description }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || `Failed to log mod (HTTP ${res.status}).`);
        return;
      }
      setDate("");
      setDescription("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (deleteId == null) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${itemId}/mods/${deleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || `Failed to delete mod (HTTP ${res.status}).`);
        setDeleting(false);
        return;
      }
      setDeleteId(null);
      setDeleting(false);
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
      setDeleting(false);
    }
  }

  return (
    <div>
      {mods.length === 0 ? (
        <p className="text-sm text-[var(--muted)] mb-4">No mods logged yet.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {mods.map((m) => (
            <li
              key={m.id}
              className="card p-3 flex items-start justify-between gap-3 text-sm"
            >
              <div>
                <span className="text-[var(--muted)]">
                  {new Date(m.date).toLocaleDateString()}
                </span>{" "}
                — {m.description}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setDeleteId(m.id)}
                  className="text-red-400 hover:underline shrink-0 min-h-11 min-w-11 cursor-pointer"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end">
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="What changed" className="flex-1 min-w-48">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Swapped bridge pickup for..."
              className="w-full"
              required
            />
          </Field>
          <Button type="submit" disabled={submitting}>
            Log mod
          </Button>
        </form>
      )}
      {canEdit && deleteId == null && <Alert className="mt-2">{error}</Alert>}

      <ConfirmDialog
        open={deleteId != null}
        title="Delete this mod entry?"
        description="This removes the history entry only. The item itself is unchanged."
        error={deleteId != null ? error : null}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!deleting) {
            setDeleteId(null);
            setError(null);
          }
        }}
      />
    </div>
  );
}
