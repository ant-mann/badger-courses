# Design: Calendar Weekend Hiding & Wider Layout

**Date:** 2026-04-14
**Status:** Approved

## Summary

Two small, focused improvements to the schedule builder:

1. Hide Saturday and Sunday columns in the weekly calendar by default. Show them only if at least one scheduled event falls on that day.
2. Widen the schedule builder page container from `max-w-7xl` (1280px) to `max-w-screen-2xl` (1536px) to give the calendar more horizontal room.

## Problem

- The weekly calendar always renders 7 columns (Mon–Sun), even when no classes fall on weekends. This wastes horizontal space and makes the Mon–Fri columns narrow.
- Event blocks inside calendar columns are cramped — course name, type badge, time, section label, and location all fail to display clearly at the current column width.
- The page container caps at 1280px, limiting how wide each column can grow even on large monitors.

## Changes

### 1. Dynamic weekend visibility — `ScheduleCalendar.tsx`

**File:** `web/src/app/components/ScheduleCalendar.tsx`

Replace the static `visibleWeekdays` assignment (currently line 64) with a computed filter:

```ts
const visibleWeekdays = CALENDAR_WEEKDAYS.filter(
  (d) => (d !== "S" && d !== "U") || entries.some((e) => e.weekday === d)
);
```

- `S` (Saturday) and `U` (Sunday) are included only when at least one entry has that weekday.
- Mon–Fri are always included.
- The CSS variable `--calendar-columns` is already derived from `visibleWeekdays.length`, so the grid automatically uses 5 columns (or 6/7 if weekend events exist) — no further changes needed.
- Column headers and day-column bodies both loop over `visibleWeekdays`, so both contract in sync.

### 2. Wider page container — `schedule-builder/page.tsx`

**File:** `web/src/app/schedule-builder/page.tsx`, line 7

Change `max-w-7xl` to `max-w-screen-2xl`:

```diff
- <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
+ <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
```

- `max-w-screen-2xl` = 1536px (up from 1280px).
- The inner two-column grid (`minmax(0,24rem)_minmax(0,1fr)`) already gives the calendar side all remaining space, so it automatically fills the extra 256px.
- The home page (`max-w-5xl`) is unchanged.

## Scope

- No new props, state, or API changes required.
- No changes to event data, routing, or other pages.
- Both changes are self-contained within their respective files.

## Testing

- Verify that the calendar shows 5 columns (Mon–Fri) when no weekend events are present.
- Verify that Sat/Sun columns appear when a course section's meeting days include Saturday or Sunday.
- Verify that the schedule builder page is visibly wider on large screens (≥1536px viewport).
- Verify that on small screens the behavior is unchanged (horizontal scroll still kicks in below `min-w-[42rem]`).
