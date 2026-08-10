import type { CategoryDef } from "@/types/categories";

type SpecRecord = Record<string, unknown>;

export default function SpecTable({
  category,
  spec,
}: {
  category: CategoryDef;
  spec: SpecRecord | null;
}) {
  if (!spec) {
    return <p className="text-sm text-[var(--muted)]">No specs recorded.</p>;
  }

  const sections = category.specSections
    .map((section) => ({
      title: section.title,
      rows: section.fields.filter((f) => {
        const value = spec[f.key];
        if (value === null || value === undefined || value === "") return false;
        // Unchecked booleans aren't worth a row of their own.
        if (f.type === "boolean" && value === false) return false;
        return true;
      }),
    }))
    .filter((s) => s.rows.length > 0);

  if (sections.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No specs recorded.</p>;
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="text-sm font-semibold text-[var(--accent)] mb-2">{section.title}</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {section.rows.map((f) => (
              <div key={f.key} className="contents">
                <span className="text-[var(--muted)]">{f.label}</span>
                <span>{f.type === "boolean" ? "Yes" : String(spec[f.key])}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
