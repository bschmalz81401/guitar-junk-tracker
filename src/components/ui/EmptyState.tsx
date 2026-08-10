import type { ReactNode } from "react";

export default function EmptyState({
  title,
  description,
  action,
  className = "",
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card p-10 text-center ${className}`}>
      <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
      {description && (
        <div className="mt-2 text-sm text-[var(--muted)] max-w-md mx-auto">{description}</div>
      )}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{action}</div>}
    </div>
  );
}
