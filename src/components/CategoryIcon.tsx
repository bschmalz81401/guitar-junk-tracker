import type { CategoryKey } from "@/types/categories";

/** Line icons for gear categories (currentColor; scale via className). */
export default function CategoryIcon({
  category,
  className = "w-[1em] h-[1em]",
}: {
  category: CategoryKey;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (category) {
    case "guitar":
      // Body with a waist, neck, and headstock.
      return (
        <svg {...common}>
          <path d="M14.5 9.5 20 4" />
          <path d="M18.4 2.4 21.6 5.6" />
          <path d="M19.2 3.2 20.8 4.8" />
          <path d="M13.6 10.4a3.2 3.2 0 0 0-4.3.4c-.9 1-.7 2-1.6 2.8-.8.8-2.1.8-3 1.8a3.4 3.4 0 0 0 4.7 4.9c1-.9 1-2.2 1.8-3 .8-.9 1.9-.7 2.8-1.6a3.2 3.2 0 0 0 .4-4.3Z" />
          <circle cx="11.2" cy="14.6" r="1.5" />
        </svg>
      );

    case "amp":
      // Wide head: control panel with knobs on top, grille below.
      return (
        <svg {...common}>
          <rect x="2" y="6" width="20" height="12" rx="1.6" />
          <path d="M2 10.5h20" />
          <circle cx="6" cy="8.25" r=".85" />
          <circle cx="9.5" cy="8.25" r=".85" />
          <circle cx="13" cy="8.25" r=".85" />
          <circle cx="16.5" cy="8.25" r=".85" />
          <circle cx="20" cy="8.25" r=".85" />
          <rect x="4.5" y="12.5" width="15" height="3.75" rx=".6" />
        </svg>
      );

    case "cab":
      // 4x12: broad, near-square box with four speakers.
      return (
        <svg {...common}>
          <rect x="2.5" y="4" width="19" height="16" rx="1.6" />
          <circle cx="8" cy="8.5" r="2.7" />
          <circle cx="16" cy="8.5" r="2.7" />
          <circle cx="8" cy="15.5" r="2.7" />
          <circle cx="16" cy="15.5" r="2.7" />
        </svg>
      );

    case "pedal":
      // Stompbox: narrow and tall, knobs up top, footswitch at the bottom.
      return (
        <svg {...common}>
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <circle cx="9.6" cy="6" r="1.3" />
          <circle cx="14.4" cy="6" r="1.3" />
          <path d="M8.6 10h6.8" />
          <circle cx="12" cy="16.8" r="2.3" />
        </svg>
      );

    case "multifx":
      // Floor unit: wide chassis with a row of footswitches and a screen.
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="1.8" />
          <rect x="4" y="7" width="7" height="4" rx=".6" />
          <circle cx="14.5" cy="9" r="1.1" />
          <circle cx="18" cy="9" r="1.1" />
          <circle cx="5.5" cy="15.5" r="1.4" />
          <circle cx="9.5" cy="15.5" r="1.4" />
          <circle cx="13.5" cy="15.5" r="1.4" />
          <circle cx="17.5" cy="15.5" r="1.4" />
        </svg>
      );

    case "other":
      // Generic gear box / accessory.
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="12" rx="1.6" />
          <path d="M4 10h16" />
          <path d="M9 6V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V6" />
          <circle cx="12" cy="14" r="1.6" />
        </svg>
      );
  }
}
