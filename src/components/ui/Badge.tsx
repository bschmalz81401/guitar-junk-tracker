import type { ReactNode } from "react";

type Tone = "default" | "owned" | "sold" | "wishlist" | "accent" | "public";

const TONE: Record<Tone, string> = {
  default: "bg-[var(--surface-hover)] text-[var(--muted)]",
  owned: "bg-emerald-500/15 text-emerald-400",
  sold: "bg-zinc-500/15 text-zinc-400",
  wishlist: "bg-amber-500/15 text-amber-400",
  accent: "bg-[var(--accent)]/15 text-[var(--accent)]",
  public: "bg-sky-500/15 text-sky-300",
};

export default function Badge({
  tone = "default",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): Tone {
  if (status === "owned") return "owned";
  if (status === "sold") return "sold";
  if (status === "wishlist") return "wishlist";
  return "default";
}
