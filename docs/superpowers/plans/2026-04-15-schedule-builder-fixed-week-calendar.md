# Schedule Builder Fixed-Week Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the schedule-builder calendar always render `Mon` through `Sun` so weekday columns stay stable as schedules change.

**Architecture:** Keep the change localized to the shared `ScheduleCalendar` render path and the tests that currently pin the adaptive weekday behavior. Remove the entry-driven weekday selection from the rendered grid, keep meeting placement and time-window logic unchanged, and either delete or repurpose the no-longer-needed adaptive weekday helper so the data layer matches the UI contract.

**Tech Stack:** Next.js 15, React 19, TypeScript, Node test runner, React server rendering tests

---

## File Structure

- Modify: `web/src/app/components/ScheduleCalendar.tsx`
  - Replace the adaptive weekday selection with a fixed seven-day ordered list used for headers and day lanes.
- Modify: `web/src/app/schedule-builder/components.test.tsx`
  - Update schedule calendar coverage so weekday-only schedules still render `Sat` and `Sun`.
- Modify: `web/src/app/schedule-builder/schedule-data.ts`
  - Remove or simplify `getVisibleWeekdays` if it is no longer needed by the calendar.
- Modify: `web/src/app/schedule-builder/schedule-data.test.ts`
  - Remove or replace the stale adaptive weekday helper test so the data tests match the implementation.

### Task 1: Pin Fixed-Week Rendering In The Calendar Component Test

**Files:**
- Modify: `web/src/app/schedule-builder/components.test.tsx`
- Test: `web/src/app/schedule-builder/components.test.tsx`

- [ ] **Step 1: Write the failing test expectation for a fixed seven-day calendar**

Replace the existing adaptive-weekday test with this assertion block:

```tsx
test("ScheduleCalendar renders all seven weekdays for the selected schedule", () => {
  const entries: ScheduleCalendarEntry[] = [
    {
      weekday: "M",
      sourcePackageId: "pkg-1",
      courseDesignation: "COMP SCI 577",
      title: "Algorithms for Large Data",
      sectionBundleLabel: "LEC 001",
      meetingType: "CLASS",
      startMinutes: 540,
      endMinutes: 590,
      room: "140",
      buildingName: "Grainger Hall",
    },
    {
      weekday: "W",
      sourcePackageId: "pkg-1",
      courseDesignation: "COMP SCI 577",
      title: "Algorithms for Large Data",
      sectionBundleLabel: "LEC 001",
      meetingType: "CLASS",
      startMinutes: 540,
      endMinutes: 590,
      room: "140",
      buildingName: "Grainger Hall",
    },
  ];

  const markup = renderToStaticMarkup(
    <ScheduleCalendar entries={entries} schedule={makeSchedule()} />,
  );

  assert.match(markup, />M<|>Mon<|Monday/);
  assert.match(markup, />T<|>Tue<|Tuesday/);
  assert.match(markup, />W<|>Wed<|Wednesday/);
  assert.match(markup, />R<|>Thu<|Thursday/);
  assert.match(markup, />F<|>Fri<|Friday/);
  assert.match(markup, />S<|>Sat<|Saturday/);
  assert.match(markup, />U<|>Sun<|Sunday/);
  assert.match(markup, /9:00 AM/);
  assert.match(markup, /position:absolute/);
});
```

- [ ] **Step 2: Run the focused component test to verify it fails for the expected reason**

Run: `npm run test --workspace=web -- src/app/schedule-builder/components.test.tsx`

Expected: FAIL in `ScheduleCalendar renders all seven weekdays for the selected schedule` because the current markup does not include `Tue`, `Thu`, `Sat`, or `Sun` for a weekday-only schedule.

- [ ] **Step 3: Commit the failing test change**

```bash
git add web/src/app/schedule-builder/components.test.tsx
git commit -m "test: require fixed-week schedule calendar"
```

### Task 2: Implement Fixed Seven-Day Rendering In `ScheduleCalendar`

**Files:**
- Modify: `web/src/app/components/ScheduleCalendar.tsx`
- Test: `web/src/app/schedule-builder/components.test.tsx`

- [ ] **Step 1: Replace the adaptive weekday list with a fixed ordered list**

At the top of `web/src/app/components/ScheduleCalendar.tsx`, remove the `getVisibleWeekdays` import and add a local constant immediately below `WEEKDAY_LABELS`:

```tsx
const CALENDAR_WEEKDAYS: VisibleWeekday[] = ["M", "T", "W", "R", "F", "S", "U"];
```

Update the import block to:

```tsx
import {
  type GeneratedSchedule,
  type ScheduleCalendarEntry,
  type VisibleWeekday,
} from "@/app/schedule-builder/schedule-data";
```

- [ ] **Step 2: Use the fixed weekday list in the rendered grid**

Replace the current `visibleWeekdays` calculation:

```tsx
const visibleWeekdays = getVisibleWeekdays(entries).filter((weekday) =>
  entries.some((entry) => entry.weekday === weekday),
);
```

with:

```tsx
const visibleWeekdays = CALENDAR_WEEKDAYS;
```

Do not change the per-column filtering later in the component:

```tsx
const weekdayEntries = entries.filter((entry) => entry.weekday === weekday);
```

That line is what keeps unused days empty while populated days still show meeting cards.

- [ ] **Step 3: Run the focused component test to verify it passes**

Run: `npm run test --workspace=web -- src/app/schedule-builder/components.test.tsx`

Expected: PASS, including the updated seven-day calendar test and the existing empty-state and equal-height coverage.

- [ ] **Step 4: Commit the minimal component fix**

```bash
git add web/src/app/components/ScheduleCalendar.tsx web/src/app/schedule-builder/components.test.tsx
git commit -m "fix: keep schedule calendar on a full week"
```

### Task 3: Remove Or Repurpose The Stale Adaptive Weekday Helper

**Files:**
- Modify: `web/src/app/schedule-builder/schedule-data.ts`
- Modify: `web/src/app/schedule-builder/schedule-data.test.ts`
- Test: `web/src/app/schedule-builder/schedule-data.test.ts`

- [ ] **Step 1: Write the failing data-layer test change that removes the stale adaptive behavior contract**

Delete the obsolete import and test for `getVisibleWeekdays`.

Update the import block in `web/src/app/schedule-builder/schedule-data.test.ts` by removing `getVisibleWeekdays`:

```ts
import {
  deriveScheduleCalendarEntries,
  expandMeetingDays,
  parseTimeToMinutes,
} from "./schedule-data";
```

Then delete this entire obsolete test block:

```ts
test("getVisibleWeekdays adds weekend columns only when schedules use them", () => {
  assert.deepEqual(
    getVisibleWeekdays([
      { weekday: "M", sourcePackageId: "pkg-1", courseDesignation: "A", title: "A", sectionBundleLabel: "A", meetingType: "CLASS", startMinutes: 540, endMinutes: 590, room: null, buildingName: null },
      { weekday: "F", sourcePackageId: "pkg-2", courseDesignation: "B", title: "B", sectionBundleLabel: "B", meetingType: "CLASS", startMinutes: 600, endMinutes: 650, room: null, buildingName: null },
    ]),
    ["M", "T", "W", "R", "F"],
  );

  assert.deepEqual(
    getVisibleWeekdays([
      { weekday: "M", sourcePackageId: "pkg-1", courseDesignation: "A", title: "A", sectionBundleLabel: "A", meetingType: "CLASS", startMinutes: 540, endMinutes: 590, room: null, buildingName: null },
      { weekday: "S", sourcePackageId: "pkg-2", courseDesignation: "B", title: "B", sectionBundleLabel: "B", meetingType: "CLASS", startMinutes: 600, endMinutes: 650, room: null, buildingName: null },
      { weekday: "U", sourcePackageId: "pkg-3", courseDesignation: "C", title: "C", sectionBundleLabel: "C", meetingType: "CLASS", startMinutes: 700, endMinutes: 750, room: null, buildingName: null },
    ]),
    ["M", "T", "W", "R", "F", "S", "U"],
  );
});
```

- [ ] **Step 2: Run the focused data test to verify it fails because the source file still exports now-unused logic**

Run: `npm run test --workspace=web -- src/app/schedule-builder/schedule-data.test.ts`

Expected: Either PASS immediately because the stale contract is already gone from the test file, or FAIL only if a TypeScript/import mismatch remains. If it passes immediately, continue to the next step and remove the unused helper from the implementation anyway.

- [ ] **Step 3: Remove the unused adaptive helper from `schedule-data.ts`**

Delete these constants and the helper from `web/src/app/schedule-builder/schedule-data.ts`:

```ts
const DEFAULT_VISIBLE_WEEKDAYS: VisibleWeekday[] = ["M", "T", "W", "R", "F"];

export function getVisibleWeekdays(entries: ScheduleCalendarEntry[]): VisibleWeekday[] {
  const weekdaysInUse = new Set(entries.map((entry) => entry.weekday));

  if (weekdaysInUse.has("S") || weekdaysInUse.has("U")) {
    return [...WEEKDAY_ORDER];
  }

  return [...DEFAULT_VISIBLE_WEEKDAYS];
}
```

Leave `WEEKDAY_ORDER` in place because `compareCalendarEntries` still depends on it.

- [ ] **Step 4: Run the focused data test to verify the module still passes cleanly**

Run: `npm run test --workspace=web -- src/app/schedule-builder/schedule-data.test.ts`

Expected: PASS, with no references to `getVisibleWeekdays` remaining.

- [ ] **Step 5: Commit the helper cleanup**

```bash
git add web/src/app/schedule-builder/schedule-data.ts web/src/app/schedule-builder/schedule-data.test.ts
git commit -m "refactor: drop adaptive calendar weekday helper"
```

### Task 4: Run Full Targeted Verification

**Files:**
- Modify: none
- Test: `web/src/app/schedule-builder/components.test.tsx`
- Test: `web/src/app/schedule-builder/schedule-data.test.ts`

- [ ] **Step 1: Run the two directly affected test files together**

Run: `npm run test --workspace=web -- src/app/schedule-builder/components.test.tsx src/app/schedule-builder/schedule-data.test.ts`

Expected: PASS for both files.

- [ ] **Step 2: Run the full web test suite to catch adjacent regressions**

Run: `npm run test --workspace=web`

Expected: PASS for the full `web` test suite.

- [ ] **Step 3: Inspect the working tree before finishing**

Run: `git status --short`

Expected: no unexpected changes beyond the intended calendar and test updates.

- [ ] **Step 4: Commit the verification checkpoint if needed**

If verification required no further code changes, do not create an extra commit. If a small follow-up fix was required during verification, commit it with:

```bash
git add web/src/app/components/ScheduleCalendar.tsx web/src/app/schedule-builder/components.test.tsx web/src/app/schedule-builder/schedule-data.ts web/src/app/schedule-builder/schedule-data.test.ts
git commit -m "test: verify fixed-week calendar behavior"
```

## Self-Review

- Spec coverage: the plan updates the rendered weekday columns, preserves empty states, keeps meeting placement logic unchanged, and updates tests that currently assert adaptive behavior.
- Placeholder scan: every code-edit step names exact files, code to add or delete, and exact test commands.
- Type consistency: the plan keeps `VisibleWeekday`, `ScheduleCalendarEntry`, and `WEEKDAY_ORDER` aligned with the current code, while removing only the stale `getVisibleWeekdays` helper contract.
