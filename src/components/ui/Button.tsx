import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--background)] hover:bg-[var(--accent-hover)] disabled:opacity-50",
  secondary:
    "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50",
  ghost:
    "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50",
  danger:
    "border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50",
};

const SIZE: Record<Size, string> = {
  sm: "min-h-9 px-3 py-1.5 text-sm",
  md: "min-h-11 px-4 py-2 text-sm",
  lg: "min-h-12 px-5 py-2.5 text-base",
};

const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
    children: ReactNode;
  }
>(function Button(
  { variant = "primary", size = "md", className = "", children, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium cursor-pointer transition-colors duration-150 btn-focus ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
