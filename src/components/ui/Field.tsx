"use client";

import { useId, type ReactElement, type ReactNode, cloneElement, isValidElement } from "react";

export default function Field({
  label,
  required,
  hint,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string; "aria-required"?: boolean }>, {
        id,
        ...(required ? { "aria-required": true } : {}),
      })
    : children;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-xs text-[var(--muted)]">
        {label}
        {required && (
          <span className="text-[var(--accent)]" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {child}
      {hint && <p className="text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}
