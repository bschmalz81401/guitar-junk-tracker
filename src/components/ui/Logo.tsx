import Link from "next/link";

/** Wordmark + mark for header / auth screens. */
export default function Logo({
  href = "/",
  className = "",
  showText = true,
}: {
  href?: string;
  className?: string;
  showText?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 text-lg font-semibold tracking-tight shrink-0 cursor-pointer hover:text-[var(--accent)] transition-colors duration-150 ${className}`}
    >
      <LogoMark className="w-7 h-7 text-[var(--accent)] shrink-0" />
      {showText && <span className="truncate">Guitar Junk Tracker</span>}
    </Link>
  );
}

export function LogoMark({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* Simplified headstock + body mark */}
      <path d="M14.5 9.5 20 4" />
      <path d="M18.4 2.4 21.6 5.6" />
      <path d="M13.6 10.4a3.2 3.2 0 0 0-4.3.4c-.9 1-.7 2-1.6 2.8-.8.8-2.1.8-3 1.8a3.4 3.4 0 0 0 4.7 4.9c1-.9 1-2.2 1.8-3 .8-.9 1.9-.7 2.8-1.6a3.2 3.2 0 0 0 .4-4.3Z" />
      <circle cx="11.2" cy="14.6" r="1.5" />
    </svg>
  );
}
