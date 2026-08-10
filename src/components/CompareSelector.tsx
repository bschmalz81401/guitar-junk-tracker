"use client";

import { useRouter } from "next/navigation";
import { article } from "@/lib/format";
import type { CategoryDef } from "@/types/categories";
import Field from "@/components/ui/Field";

interface ItemOption {
  id: number;
  name: string;
}

export default function CompareSelector({
  category,
  items,
  selectedIds,
}: {
  category: CategoryDef;
  items: ItemOption[];
  selectedIds: number[];
}) {
  const router = useRouter();

  const MAX = 3;

  function updateSlot(index: number, value: string) {
    const ids = [...selectedIds];
    if (value === "") {
      ids.splice(index, 1);
    } else {
      ids[index] = Number(value);
    }
    const unique = Array.from(
      new Set(ids.filter((n) => Number.isInteger(n) && n > 0))
    ).slice(0, MAX);
    router.push(
      unique.length > 0
        ? `/${category.slug}/compare?ids=${unique.join(",")}`
        : `/${category.slug}/compare`
    );
  }

  const capped = selectedIds.slice(0, MAX);
  const slots = [...capped, ...(capped.length < MAX ? [undefined] : [])];

  return (
    <div className="card p-4 mb-6 flex flex-wrap gap-3 items-end">
      {slots.map((id, i) => (
        <Field key={i} label={`${category.label} ${i + 1}`} className="min-w-0">
          <select
            value={id ?? ""}
            onChange={(e) => updateSlot(i, e.target.value)}
            className="w-full sm:w-56 max-w-full"
          >
            <option value="">
              Select {article(category.label)} {category.label.toLowerCase()}...
            </option>
            {items.map((item) => (
              <option
                key={item.id}
                value={item.id}
                disabled={capped.includes(item.id) && item.id !== id}
              >
                {item.name}
              </option>
            ))}
          </select>
        </Field>
      ))}
    </div>
  );
}
