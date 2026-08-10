# Guitar Junk Tracker — Design System Master

Source of truth for UI/UX decisions (ui-ux-pro-max review, 2026-08).

## Product

- **Type:** Self-hosted gear collection / inventory catalog
- **Audience:** Guitarists & collectors on phone (browse) and desktop (data entry)
- **Stack:** Next.js 16, React 19, Tailwind 4

## Style

- **Primary:** Dark-first, flat, photo-forward (OLED-friendly)
- **Not:** Glassmorphism, cyberpunk neon, marketing “vibrant blocks”
- **Accent:** Warm gold/amber (wood & metal gear aesthetic)

## Tokens (`globals.css`)

| Role | Value |
|------|--------|
| Background | `#0a0a0b` |
| Surface | `#141416` |
| Surface hover | `#1c1c20` |
| Border | `rgba(255,255,255,0.1)` |
| Foreground | `#edeeef` |
| Muted | `#a8afb8` |
| Accent | `#d4a24e` |
| Accent hover | `#e6b866` |
| Success | `#34d399` (owned) |
| Warning | `#fbbf24` (wishlist) |
| Danger | `#f87171` |
| Radius | `0.75rem` |
| Motion | 150–200ms, `cubic-bezier(0.16,1,0.3,1)` |
| Reduced motion | Honored globally |

## Typography

- **Family:** Geist Sans + Geist Mono (serial numbers mono)
- **Body:** 16px base, line-height system default
- **Labels:** `text-xs` muted, always visible (never placeholder-only)

## Components

| Primitive | Path |
|-----------|------|
| Button | `src/components/ui/Button.tsx` |
| Badge | `src/components/ui/Badge.tsx` |
| EmptyState | `src/components/ui/EmptyState.tsx` |
| Alert | `src/components/ui/Alert.tsx` |
| Field | `src/components/ui/Field.tsx` |
| ConfirmDialog | `src/components/ui/ConfirmDialog.tsx` |
| Logo | `src/components/ui/Logo.tsx` |

## Patterns

1. **Navigation:** Sticky header; desktop category links with active state; mobile hamburger drawer; categories overflow under `lg`
2. **Lists:** Portfolio grid + FilterBar (debounced search); sticky +Add / compare bar; multi-select compare (2–3 items)
3. **Empty states:** Title + description + primary CTA
4. **Forms:** Visible labels + `htmlFor`; sticky save on ItemForm; progress chips; `role="alert"` errors
5. **Destructive actions:** In-app ConfirmDialog (no `window.confirm`)
6. **Photos:** Aspect-ratio boxes, meaningful `alt`, quality/sizes tuned for grids vs detail
7. **Public chrome:** “Public” badge on shared catalogs

## Anti-patterns (avoid)

- Emoji as brand/icons
- Hover-only critical affordances on touch
- Outline-none without focus-visible replacement
- Color-only status (always pair with text)
- Fixed-width filter inputs that break at 375px

## Checklist (pre-delivery)

- [x] No emoji logo
- [x] cursor-pointer / min 44px touch targets on primary controls
- [x] Focus-visible rings
- [x] prefers-reduced-motion
- [x] Responsive filters & mobile nav
- [x] Alt text on category/item images
- [x] Loading button states on mutations
- [x] Empty states with CTAs

## Page overrides

See `pages/` when route-specific rules diverge from this master.
