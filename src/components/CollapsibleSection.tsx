"use client";

import { useId, useState } from "react";

export default function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between px-4 py-3 min-h-11 text-left font-semibold text-sm cursor-pointer hover:bg-[var(--surface-hover)] transition-colors duration-150"
      >
        {title}
        <span className="text-[var(--muted)] text-lg leading-none" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div id={panelId} className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {children}
        </div>
      )}
    </div>
  );
}
