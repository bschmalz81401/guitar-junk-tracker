# Design System: Guitar Junk Tracker

Character: dark, flat, and photo-forward — a quiet catalog where the gear
photos are the color and the UI gets out of the way.

> Extracted from the existing implementation, not invented: tokens live in
> `src/app/globals.css`, primitives in `src/components/ui/`. This file is the
> short contract; `design-system/guitar-tracker/MASTER.md` holds the longer
> pattern/anti-pattern catalog. When a token changes, change it in
> `globals.css` and here in the same commit.

## Color

Dark-first (`color-scheme: dark`), OLED-friendly. Surfaces separate by
lightness + a hairline border, never by shadow (see Shape & elevation).

- `--background` `#0a0a0b`: near-black base, slightly warm-neutral so the gold accent reads as warm, not clinical. Lives on `<html>` as the always-present fallback behind the optional fluid canvas.
- `--surface` `#141416` / `--surface-hover` `#1c1c20`: cards and inputs; the only elevation cue is being one step lighter than the background.
- `--border` `rgba(255,255,255,0.1)`: hairline separation. Low-opacity white so it reads on any surface without a hard line.
- `--foreground` `#edeeef` / `--muted` `#a8afb8`: body vs. secondary text; contrast carries hierarchy so weight/size can stay restrained.
- `--accent` `#d4a24e` (hover `#e6b866`): warm gold — the wood-and-metal gear aesthetic. Signature color, reserved for the **primary action** and key highlights; not decorative.
- `--success` `#34d399` / `--warning` `#fbbf24` / `--danger` `#f87171`: semantic only. Status is **never color-only** — always paired with a text label (see Badge).
- `--ring` `#d4a24e`: focus ring, same gold as accent so focus feels part of the brand.

## Typography

- Family: **Geist Sans** (UI) + **Geist Mono** (serial numbers, IDs, code). Mono signals "exact machine value" for things you copy verbatim.
- Base: 16px body, system line-height. Scale is Tailwind's (`text-xs` 12 / `text-sm` 14 / `text-base` 16 / `text-lg` 18 / `text-2xl` 24 / `text-3xl` 30). Contrast between levels lives in **color and weight**, not dramatic size jumps — this is a dense catalog, not a landing page.
- Weights: `font-medium` for labels/buttons/emphasis, normal for body. Headings lean on size + foreground color, not heavy weights.
- Labels are **always visible** `text-xs` `--muted` (never placeholder-only), so a filled field never loses its label.

## Spacing

- Base unit 4px (Tailwind). Scale in use: 4 / 8 / 12 / 16 / 24 / 32.
- Rhythm: tight within a group (`gap-2`/`gap-3` = 8/12px), generous between groups (card `p-4`/`p-6` = 16/24px, page `py-8` = 32px). Container `max-w-6xl`, `px-4`.
- Dense but not cramped: this is data entry on desktop and browsing on a phone, so groups read as blocks without wasting vertical space.

## Shape & elevation

- Radii: `--radius` `0.75rem` (12px) for **cards**; `rounded-md` (6px) for **buttons, inputs, small controls**; `rounded-full` for **badges and chips**. Bigger container / smaller control is the consistent rule.
- Separation language: **flat surfaces + hairline borders. No shadows.** Elevation is communicated by surface lightness and the 10%-white border, which suits a dark, photo-forward UI where drop-shadows would muddy the black.

## Motion

- Durations: `--duration-fast` 150ms (micro: hover, focus, color) / `--duration` 200ms (transitions). Easing `--ease-out` `cubic-bezier(0.16, 1, 0.3, 1)` — fast out, soft settle.
- Transition color/border/background, not layout, on interactive elements.
- `prefers-reduced-motion` is honored globally in `globals.css`, and the decorative fluid background is off by default under it.

## Components

Primitives in `src/components/ui/`. Use them; don't re-style ad hoc.

- **Button** (`Button.tsx`) — 3-tier + destructive, sizes `sm`/`md`/`lg` (min-height 36 / 44 / 48px; `md` is the 44px touch-target default):
  - `primary`: accent fill, `--background` text — the one main action per view.
  - `secondary`: bordered, transparent fill — supporting actions.
  - `ghost`: muted text, surface-hover on hover — tertiary / low-emphasis.
  - `danger`: red hairline border + red text, red tint on hover — destructive only.
  - All: `rounded-md`, `font-medium`, `cursor-pointer`, `btn-focus` ring, 150ms color transition.
- **Badge** (`Badge.tsx`) — `rounded-full`, `text-xs`, tinted-bg + matching text tones: `owned` (emerald), `sold` (zinc), `wishlist` (amber), `accent` (gold), `public` (sky), `default` (muted). Status tone always accompanies the status **word**.
- **Field** (`Field.tsx`): visible `text-xs` muted label wired via `htmlFor`, optional hint, required marker in accent.
- **Alert** (`Alert.tsx`): inline `role="alert"` messaging for form/validation errors.
- **EmptyState** (`EmptyState.tsx`): icon/title + description + primary CTA — never a blank list.
- **ConfirmDialog** (`ConfirmDialog.tsx`): in-app confirmation for destructive actions — **never** `window.confirm`.
- **CategoryIcon** (`CategoryIcon.tsx`): drawn line icons for gear categories. Emoji are **not** used as icons or branding.

## Voice

- Tone: plain, direct, lightly warm — "Heads and combos", "Log in to browse". No marketing gloss, no exclamation.
- Labels: sentence case; buttons are verbs ("Add guitar", "Create admin & continue"); private/ownership language is factual, never judgmental.

## Non-negotiables (from MASTER.md)

- No emoji as brand/icons. Status is never color-only. Focus-visible rings on every interactive element. 44px minimum touch targets on primary controls. Filters and nav stay usable at 375px. Meaningful `alt` on every gear photo.
