# Design Overhaul — Airtable-Inspired System

**Date:** 2026-04-16  
**Status:** Approved

---

## Overview

A full visual redesign of the UW-Madison course explorer web app ("Badger Courses"), replacing the current black/white/opacity Tailwind pattern with a cohesive Airtable-inspired design system. The app retains dark mode support. The site is renamed from the placeholder "Madgrades" branding to **Badger Courses**.

**Design reference:** `docs/DESIGN.md`

---

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Font | Inter (Google Fonts) | Haas is proprietary; Inter is the closest free Swiss geometric match |
| Dark mode | Keep, deep navy background (`#181d26`) | User preference; DESIGN.md covers only light — dark mode uses inverted Airtable palette |
| Token system | Tailwind v4 `@theme` | Native to the stack; no config files needed; auto-generates utilities |
| Navigation | Add persistent top navbar | Site has 3 pages; no cross-page navigation currently exists |
| Site name | Badger Courses | Unique to UW-Madison, short, clean in navbar |

---

## 1. Token System (`web/src/app/globals.css`)

All semantic design tokens are defined as CSS custom properties and exposed as Tailwind utilities via the `@theme` block.

Raw CSS variable names use a plain prefix (e.g. `--navy`) in `:root`/`.dark`, and are mapped to Tailwind `--color-*` tokens via `@theme inline` to avoid circular self-references.

### Light mode (`:root`)

```css
--navy:       #181d26;   /* primary text, headings */
--blue:       #1b61c9;   /* CTAs, links, active states */
--surface:    #ffffff;   /* card/panel backgrounds */
--bg:         #ffffff;   /* page background */
--border:     #e0e2e6;   /* all borders */
--text-weak:  rgba(4, 14, 32, 0.62);
--text-faint: rgba(4, 14, 32, 0.40);
--card-shadow: rgba(0,0,0,0.32) 0px 0px 1px,
               rgba(0,0,0,0.08) 0px 0px 2px,
               rgba(45,127,249,0.28) 0px 1px 3px,
               rgba(0,0,0,0.06) 0px 0px 0px 0.5px inset;
--soft-shadow: rgba(15, 48, 106, 0.05) 0px 0px 20px;
```

### Dark mode (`.dark`)

```css
--navy:       #e8edf5;
--blue:       #6b9fff;   /* lightened for contrast on dark bg */
--surface:    rgba(255, 255, 255, 0.04);
--bg:         #181d26;
--border:     rgba(255, 255, 255, 0.09);
--text-weak:  rgba(232, 237, 245, 0.58);
--text-faint: rgba(232, 237, 245, 0.38);
--card-shadow: rgba(0,0,0,0.5) 0px 0px 1px,
               rgba(0,0,0,0.2) 0px 0px 2px,
               rgba(45,127,249,0.15) 0px 1px 3px;
--soft-shadow: rgba(0, 0, 0, 0.3) 0px 0px 20px;
```

### Tailwind `@theme` block

The `@theme inline` block maps the raw CSS vars to Tailwind color/shadow utilities:

```css
@theme inline {
  --color-navy:        var(--navy);
  --color-blue:        var(--blue);
  --color-surface:     var(--surface);
  --color-bg:          var(--bg);
  --color-border:      var(--border);
  --color-text-weak:   var(--text-weak);
  --color-text-faint:  var(--text-faint);
  --shadow-card:       var(--card-shadow);
  --shadow-soft:       var(--soft-shadow);
  --font-sans:         var(--font-inter);
}
```

This makes `text-navy`, `bg-surface`, `border-border`, `text-text-weak`, `shadow-card`, etc. available as first-class Tailwind utilities in all components.

---

## 2. Typography

Replace Geist with **Inter** from `next/font/google`.

```tsx
// layout.tsx
import { Inter } from "next/font/google";
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
```

Body text uses positive letter-spacing per DESIGN.md:
- Body (18px): `tracking-[0.18px]`
- Caption (14px): `tracking-[0.14px]`
- Eyebrow labels: `tracking-[0.24em]` (existing pattern, unchanged)

Type scale applied via Tailwind utilities — no custom font-size tokens needed, the existing Tailwind scale suffices.

---

## 3. Navbar (`web/src/app/components/Navbar.tsx`)

New persistent navigation bar added to the root layout.

**Structure:**
- Server component `Navbar` renders the shell
- Client sub-component `NavLinks` handles `usePathname()` for active state

**Anatomy:**
- **Left**: blue dot (8px, `bg-blue`) + "Badger Courses" in `font-semibold text-navy`, wraps in `<Link href="/">`
- **Center/Right**: nav links "Course Explorer" (`/`) and "Schedule Builder" (`/schedule-builder`)
  - Active: `bg-blue/10 text-blue rounded-lg px-3 py-1.5`
  - Inactive: `text-text-weak hover:text-navy px-3 py-1.5 rounded-lg`
- **Far right**: ThemeToggle icon button (moved from floating position)

**Styling:**
- `sticky top-0 z-50`
- `bg-surface/90 backdrop-blur-sm`
- `border-b border-border`
- Height: `h-14` (56px)
- Max width: `max-w-screen-2xl mx-auto px-6 sm:px-10`

**Layout.tsx changes:**
- Import Inter, remove Geist
- Add `<Navbar />` above `{children}`
- Remove standalone `<ThemeToggle />` (now inside Navbar)

---

## 4. Page & Component Changes

### Pattern

All components replace current ad-hoc `black/opacity` and `white/opacity` Tailwind classes with semantic token utilities. Dark-mode `dark:` variants are removed from components — the CSS variable swap handles it automatically.

### Pages (`page.tsx` files — 3 total)

- Remove eyebrow-to-footer `bg-background text-foreground` wrapper → use `bg-bg text-navy`
- Update hero eyebrow: `text-text-faint` (was `text-black/55 dark:text-white/55`)
- Update hero sub-text: `text-text-weak`
- Remove floating ThemeToggle refs (moved to Navbar)
- Add `pt-14` to account for the sticky navbar height on each page wrapper

### Component-level changes

| Component | Changes |
|---|---|
| `CourseCard.tsx` | `border-border`, `bg-surface`, `shadow-card` hover; `text-navy` for heading; `text-text-weak` for subtitle; radius `rounded-2xl` (kept, ≈ 24px which maps to 16–24px per DESIGN.md) |
| `SearchBar.tsx` | `border-border bg-surface shadow-card`; input focus → `focus:border-blue`; label `text-text-weak`; status text `text-text-faint` |
| `ThemeToggle.tsx` | Remove fixed positioning; adapt as inline icon button with `border-border` for use inside Navbar |
| `CoursePicker.tsx` | Borders `border-border`; selected course chips `bg-blue/10 border-blue/20 text-blue` |
| `ScheduleCalendar.tsx` | Grid lines `border-border`; hour labels `text-text-faint`; day headers `text-text-weak`; event blocks retain per-course color coding |
| `SchedulePriorityList.tsx` | Row borders `border-border`; drag handles `text-text-faint`; priority badges `bg-blue/8 text-blue` |
| `ScheduleResults.tsx` | Nav buttons `border-border`; result count `text-text-weak`; no-results state `text-text-faint` |
| `SectionTable.tsx` | Table borders `border-border`; header row `bg-surface`; row hover `bg-blue/[0.03]` |
| `PrerequisiteSummary.tsx` | Course links `text-blue hover:underline`; borders `border-border` |
| `SelectedCourseList.tsx` | Chips `bg-blue/10 border-blue/20 text-blue`; remove button `text-text-faint hover:text-navy` |
| `ScheduleAvailabilityFilters.tsx` | Active toggle: `bg-blue/10 text-blue border-blue/20`; inactive: `border-border text-text-weak` |
| `SectionOptionPanel.tsx` | Cards `border-border bg-surface shadow-card`; section labels `text-text-weak` |

### Not changed

- Component logic, data fetching, state management — untouched
- API routes — untouched
- Test files — untouched
- `ScheduleCalendar` event color coding (blue/purple/teal per course) — kept as-is

---

## 5. Scope

**Files to modify:**

```
web/src/app/globals.css              — token system, Inter font var
web/src/app/layout.tsx               — Inter font, Navbar, remove ThemeToggle
web/src/app/page.tsx                 — hero section classes, remove ThemeToggle
web/src/app/schedule-builder/page.tsx — hero section classes
web/src/app/courses/[designation]/page.tsx — hero section classes
web/src/app/components/Navbar.tsx    — NEW file
web/src/app/components/CourseCard.tsx
web/src/app/components/SearchBar.tsx
web/src/app/components/ThemeToggle.tsx
web/src/app/components/CoursePicker.tsx
web/src/app/components/ScheduleCalendar.tsx
web/src/app/components/SchedulePriorityList.tsx
web/src/app/components/ScheduleResults.tsx
web/src/app/components/SectionTable.tsx
web/src/app/components/PrerequisiteSummary.tsx
web/src/app/components/SelectedCourseList.tsx
web/src/app/components/ScheduleAvailabilityFilters.tsx
web/src/app/components/SectionOptionPanel.tsx
```

**Total:** 1 new file, 17 modified files. No logic changes.

---

## 6. Success Criteria

- Site renders in light and dark mode with Airtable-inspired tokens
- Navbar appears on all pages with correct active state per route
- No `dark:` variants remain in component JSX (handled by CSS variables)
- `pnpm --filter uw-madison-courses-web run build` passes
- `pnpm --filter uw-madison-courses-web run lint` passes
- `pnpm --filter uw-madison-courses-web run test` passes
