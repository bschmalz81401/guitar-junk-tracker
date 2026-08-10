"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createFluidSim, type FluidSimHandle } from "@/lib/fluid/fluidSim";

const STORAGE_KEY = "gjt-fx";

// ── preference store (localStorage + prefers-reduced-motion) ───────────────
// Read via useSyncExternalStore so there's no SSR/hydration mismatch and no
// setState-in-effect. Server renders "off"; the client swaps to the real
// value immediately after hydration.
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    /* storage unavailable — fall through to the motion default */
  }
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getServerSnapshot(): boolean {
  return false;
}

function setPreference(next: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** Parse the app's --background CSS var (#rrggbb) into 0–1 RGB for the sim base. */
function readBackground(): { r: number; g: number; b: number } | undefined {
  try {
    const hex = getComputedStyle(document.documentElement)
      .getPropertyValue("--background")
      .trim();
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return undefined;
    const n = parseInt(m[1], 16);
    return {
      r: ((n >> 16) & 255) / 255,
      g: ((n >> 8) & 255) / 255,
      b: (n & 255) / 255,
    };
  } catch {
    return undefined;
  }
}

/**
 * Decorative WebGL fluid background with a top-left on/off toggle.
 *
 * On by default (respecting prefers-reduced-motion for first-time visitors);
 * the choice is remembered in localStorage. Renders nothing where WebGL is
 * unavailable, so the app falls back to its solid dark background.
 */
export default function FluidBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [unsupported, setUnsupported] = useState(false);

  // Start / stop the simulation as the toggle changes.
  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let handle: FluidSimHandle | null = null;
    // Defer a frame so the fixed canvas has its final client size.
    const raf = requestAnimationFrame(() => {
      handle = createFluidSim(canvas, { background: readBackground() });
      if (!handle) setUnsupported(true);
    });

    return () => {
      cancelAnimationFrame(raf);
      handle?.destroy();
    };
  }, [enabled]);

  if (unsupported) return null;

  return (
    <>
      {enabled && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
        />
      )}
      <button
        type="button"
        onClick={() => setPreference(!enabled)}
        aria-pressed={enabled}
        aria-label={`Background effect ${enabled ? "on" : "off"} — click to turn ${enabled ? "off" : "on"}`}
        title="Toggle background effect"
        className="fixed left-3 top-[66px] z-30 inline-flex min-h-11 items-center rounded-md border border-[var(--border)] bg-[var(--surface)]/70 px-3 text-xs font-medium tracking-wide text-[var(--accent)] backdrop-blur-sm transition-colors duration-150 hover:border-[var(--accent)] btn-focus"
      >
        Effect: {enabled ? "on" : "off"}
      </button>
    </>
  );
}
