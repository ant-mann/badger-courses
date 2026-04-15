# Implementation Plan: Schedule Builder Calendar Block Clarity

Spec: `docs/superpowers/specs/2026-04-14-schedule-builder-calendar-block-clarity-design.md`

## Overview

Add an abbreviated meeting type badge (`LEC`, `LAB`, `DIS`) to each calendar block in `ScheduleCalendar.tsx`, and reorder block content so time always appears before section bundle label. Scoped entirely to that one component and its tests.

---

## Step 1 — Add meeting type label helper to `ScheduleCalendar.tsx`

Add a pure function that maps the raw `meetingType` string to a display label:

```ts
function meetingTypeLabel(meetingType: string | null): string | null {
  if (meetingType === null) return null;
  if (meetingType === "CLASS") return "LEC";
  return meetingType; // LAB, DIS, and any unknown values pass through as-is
}
```

Place it alongside the existing helpers at the bottom of the file.

**Verify:** function is pure, handles null, handles "CLASS" → "LEC", passes through unknown values.

---

## Step 2 — Reorder and restructure the meeting block content

In `ScheduleCalendar.tsx`, inside the `weekdayEntries.map(...)` render, replace the current four-line stack:

```tsx
<div className="flex flex-col gap-1 text-xs leading-5">
  <p className="font-semibold">{entry.courseDesignation}</p>
  <p className="text-black/72 dark:text-white/72">{entry.sectionBundleLabel}</p>
  <p className="text-black/60 dark:text-white/60">{formatMinutes(entry.startMinutes)}-{formatMinutes(entry.endMinutes)}</p>
  <p className="text-black/60 dark:text-white/60">
    {[entry.buildingName, entry.room].filter(Boolean).join(" • ") || "Location unavailable"}
  </p>
</div>
```

With the new structure:

```tsx
<div className="flex flex-col gap-1 text-xs leading-5">
  <div className="flex items-center justify-between gap-1">
    <p className="truncate font-semibold">{entry.courseDesignation}</p>
    {meetingTypeLabel(entry.meetingType) ? (
      <span className="shrink-0 rounded bg-black/8 px-1 py-px text-[9px] font-bold uppercase tracking-wide dark:bg-white/10">
        {meetingTypeLabel(entry.meetingType)}
      </span>
    ) : null}
  </div>
  <p className="text-black/60 dark:text-white/60">{formatMinutes(entry.startMinutes)}-{formatMinutes(entry.endMinutes)}</p>
  <p className="text-black/72 dark:text-white/72">{entry.sectionBundleLabel}</p>
  <p className="text-black/60 dark:text-white/60">
    {[entry.buildingName, entry.room].filter(Boolean).join(" • ") || "Location unavailable"}
  </p>
</div>
```

Changes from current:
- Line 1 becomes a flex row: course name (truncating) + optional badge
- Line 2 is now time (moved up from line 3)
- Line 3 is now section bundle label (moved down from line 2)
- Line 4 location unchanged

**Verify:** renders in browser; 50-min block shows badge and time; null meetingType renders no badge.

---

## Step 3 — Add test cases to `components.test.tsx`

In `web/src/app/schedule-builder/components.test.tsx`, add a new `describe` block (or top-level tests) for `ScheduleCalendar` meeting type badge coverage.

Add a helper that constructs the minimal `ScheduleCalendarEntry`:

```ts
function makeEntry(overrides: Partial<ScheduleCalendarEntry> = {}): ScheduleCalendarEntry {
  return {
    weekday: "M",
    sourcePackageId: "pkg-1",
    courseDesignation: "COMP SCI 577",
    title: "Intro to Algorithms",
    sectionBundleLabel: "LEC 001",
    meetingType: "CLASS",
    startMinutes: 540,
    endMinutes: 590,
    room: null,
    buildingName: null,
    ...overrides,
  };
}
```

Required test cases:

1. `meetingType: "CLASS"` → markup contains `LEC` badge
2. `meetingType: "LAB"` → markup contains `LAB` badge
3. `meetingType: "DIS"` → markup contains `DIS` badge
4. `meetingType: null` → markup does not contain a badge element (no `<span>` with those values next to the course name)
5. Time range appears before section bundle label in the rendered markup (use `markup.indexOf` comparison)

**Verify:** `npm test` (or equivalent) passes all new and existing cases.

---

## Step 4 — Manual browser check

With the dev server running at `http://localhost:3001`:

1. Open `/schedule-builder?course=COMP+SCI+577&limit=25&view=cards`
2. Select a generated schedule that includes both lecture and discussion meetings
3. Confirm each calendar block shows the type badge and time as the top two visible lines
4. Confirm a lecture block shows `LEC` and a discussion block shows `DIS` on the same day
5. Confirm short blocks don't clip the badge or time

---

## Files changed

| File | Change |
|---|---|
| `web/src/app/components/ScheduleCalendar.tsx` | Add `meetingTypeLabel` helper; restructure block content |
| `web/src/app/schedule-builder/components.test.tsx` | Add badge and line-order test cases |
