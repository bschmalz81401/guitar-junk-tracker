import type { ReactNode } from "react";

type Variant = "error" | "success" | "info";

const STYLES: Record<Variant, string> = {
  error: "text-red-400",
  success: "text-emerald-400",
  info: "text-[var(--muted)]",
};

export default function Alert({
  variant = "error",
  children,
  className = "",
}: {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={`text-xs ${STYLES[variant]} ${className}`}
    >
      {children}
    </p>
  );
}
