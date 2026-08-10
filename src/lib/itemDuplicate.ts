/**
 * Helpers for cloning catalog items (specs only — not photos or mods).
 */

const SPEC_META_KEYS = new Set(["id", "itemId", "createdAt", "updatedAt"]);

/** Display name for a duplicated item. */
export function duplicateItemName(name: string): string {
  const base = name.trim() || "Item";
  const copyMatch = /^(.*)\s+\(copy(?:\s+(\d+))?\)$/i.exec(base);
  if (copyMatch) {
    const stem = copyMatch[1].trim();
    const n = copyMatch[2] ? Number(copyMatch[2]) + 1 : 2;
    return `${stem} (copy ${n})`;
  }
  return `${base} (copy)`;
}

/**
 * Strip Prisma relation/meta fields so a *Spec row can be recreated.
 * Boolean defaults stay as-is; undefined values are dropped.
 */
export function cleanSpecForDuplicate(
  spec: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!spec) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(spec)) {
    if (SPEC_META_KEYS.has(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}
