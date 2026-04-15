# Schedule Builder Padded Time Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the schedule-builder calendar default to `9:00 AM` through `5:00 PM` and expand earlier or later with one extra hour of padding when classes fall outside that range.

**Architecture:** Keep the change localized to `ScheduleCalendar` by replacing the current tight-fit `deriveTimeWindow` logic with a baseline `9:00 AM` to `5:00 PM` window plus conditional expansion on the overflowing side. Update the existing calendar component tests to pin baseline, early-overflow, late-overflow, and dual-overflow behavior while leaving the fixed seven-day layout, empty states, and meeting placement math intact.

**Tech Stack:** Next.js 15, React 19, TypeScript, Node test runner, React server rendering tests

---

## File Structure

- Modify: `web/src/app/components/ScheduleCalendar.tsx`
  - Replace the tight-fit `deriveTimeWindow` rule with a `9:00 AM` to `5:00 PM` baseline plus one-hour padded expansion for out-of-range meetings.
- Modify: `web/src/app/schedule-builder/components.test.tsx`
  - Extend the existing `ScheduleCalendar` tests to cover baseline and overflow time-window behavior.

### Task 1: Pin The New Time-Window Behavior With Failing Tests

**Files:**
- Modify: `web/src/app/schedule-builder/components.test.tsx`
- Test: `web/src/app/schedule-builder/components.test.tsx`

- [ ] **Step 1: Add failing tests for baseline, early overflow, late overflow, and dual overflow**

Insert the following tests immediately after `ScheduleCalendar renders all seven weekdays for the selected schedule` and before the existing empty-state test:

```tsx
test("ScheduleCalendar uses a 9:00 AM to 5:00 PM baseline for daytime schedules", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar
      schedule={makeSchedule()}
      entries={[
        {
          weekday: "M",
          sourcePackageId: "pkg-1",
          courseDesignation: "COMP SCI 577",
          title: "Algorithms for Large Data",
          sectionBundleLabel: "LEC 001",
          meetingType: "CLASS",
          startMinutes: 600,
          endMinutes: 660,
          room: "140",
          buildingName: "Grainger Hall",
        },
      ]}
    />,
  );

  assert.match(markup, /9:00 AM/);
  assert.match(markup, /5:00 PM/);
  assert.doesNotMatch(markup, /8:00 AM/);
  assert.doesNotMatch(markup, /6:00 PM/);
});

test("ScheduleCalendar expands earlier schedules with one extra padded hour", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar
      schedule={makeSchedule()}
      entries={[
        {
          weekday: "M",
          sourcePackageId: "pkg-1",
          courseDesignation: "COMP SCI 577",
          title: "Algorithms for Large Data",
          sectionBundleLabel: "LEC 001",
          meetingType: "CLASS",
          startMinutes: 510,
          endMinutes: 570,
          room: "140",
          buildingName: "Grainger Hall",
        },
      ]}
    />,
  );

  assert.match(markup, /7:00 AM/);
  assert.match(markup, /5:00 PM/);
  assert.doesNotMatch(markup, /6:00 AM/);
});

test("ScheduleCalendar expands later schedules with one extra padded hour", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar
      schedule={makeSchedule()}
      entries={[
        {
          weekday: "M",
          sourcePackageId: "pkg-1",
          courseDesignation: "COMP SCI 577",
          title: "Algorithms for Large Data",
          sectionBundleLabel: "LEC 001",
          meetingType: "CLASS",
          startMinutes: 600,
          endMinutes: 1100,
          room: "140",
          buildingName: "Grainger Hall",
        },
      ]}
    />,
  );

  assert.match(markup, /9:00 AM/);
  assert.match(markup, /8:00 PM/);
  assert.doesNotMatch(markup, /9:00 PM/);
});

test("ScheduleCalendar expands both sides independently for early and late schedules", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar
      schedule={makeSchedule()}
      entries={[
        {
          weekday: "M",
          sourcePackageId: "pkg-1",
          courseDesignation: "COMP SCI 577",
          title: "Algorithms for Large Data",
          sectionBundleLabel: "LEC 001",
          meetingType: "CLASS",
          startMinutes: 430,
          endMinutes: 1240,
          room: "140",
          buildingName: "Grainger Hall",
        },
      ]}
    />,
  );

  assert.match(markup, /6:00 AM/);
  assert.match(markup, /10:00 PM/);
});
```

- [ ] **Step 2: Run the focused component test file to verify the new expectations fail**

Run: `npm run test --workspace=web -- src/app/schedule-builder/components.test.tsx`

Expected: FAIL because the current `deriveTimeWindow` still tightly fits the earliest and latest meetings instead of preserving a `9:00 AM` to `5:00 PM` baseline with padded overflow.

- [ ] **Step 3: Commit the failing test change**

```bash
git add web/src/app/schedule-builder/components.test.tsx
git commit -m "test: require padded schedule time window"
```

### Task 2: Implement The Baseline And Padded Overflow Rule

**Files:**
- Modify: `web/src/app/components/ScheduleCalendar.tsx`
- Test: `web/src/app/schedule-builder/components.test.tsx`

- [ ] **Step 1: Add explicit baseline and padding constants above `deriveTimeWindow`**

In `web/src/app/components/ScheduleCalendar.tsx`, add these constants below `HOUR_HEIGHT_REM`:

```tsx
const BASELINE_START_MINUTES = 9 * 60;
const BASELINE_END_MINUTES = 17 * 60;
const WINDOW_PADDING_MINUTES = 60;
```

- [ ] **Step 2: Replace the tight-fit `deriveTimeWindow` implementation**

Replace the existing helper:

```tsx
function deriveTimeWindow(entries: ScheduleCalendarEntry[]): { startMinutes: number; endMinutes: number } {
  const earliestStart = Math.min(...entries.map((entry) => entry.startMinutes));
  const latestEnd = Math.max(...entries.map((entry) => entry.endMinutes));

  return {
    startMinutes: Math.floor(earliestStart / 60) * 60,
    endMinutes: Math.ceil(latestEnd / 60) * 60,
  };
}
```

with:

```tsx
function deriveTimeWindow(entries: ScheduleCalendarEntry[]): { startMinutes: number; endMinutes: number } {
  const earliestStart = Math.min(...entries.map((entry) => entry.startMinutes));
  const latestEnd = Math.max(...entries.map((entry) => entry.endMinutes));

  const startMinutes = earliestStart < BASELINE_START_MINUTES
    ? (Math.floor(earliestStart / 60) * 60) - WINDOW_PADDING_MINUTES
    : BASELINE_START_MINUTES;

  const endMinutes = latestEnd > BASELINE_END_MINUTES
    ? (Math.ceil(latestEnd / 60) * 60) + WINDOW_PADDING_MINUTES
    : BASELINE_END_MINUTES;

  return {
    startMinutes,
    endMinutes,
  };
}
```

Do not change `buildTimeLabels`, `getOffsetPercent`, or any meeting card rendering code.

- [ ] **Step 3: Run the focused component test file to verify it passes**

Run: `npm run test --workspace=web -- src/app/schedule-builder/components.test.tsx`

Expected: PASS, including the new baseline/overflow time-window tests, the fixed-weekday calendar test, and the existing empty-state/equal-height tests.

- [ ] **Step 4: Commit the minimal implementation change**

```bash
git add web/src/app/components/ScheduleCalendar.tsx web/src/app/schedule-builder/components.test.tsx
git commit -m "fix: pad schedule calendar time window"
```

### Task 3: Run Targeted And Full Verification

**Files:**
- Modify: none
- Test: `web/src/app/schedule-builder/components.test.tsx`

- [ ] **Step 1: Run the calendar-focused verification command**

Run: `npm run test --workspace=web -- src/app/schedule-builder/components.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run the full web test suite**

Run: `npm run test --workspace=web`

Expected: PASS for the full `web` workspace suite.

- [ ] **Step 3: Inspect the working tree before finishing**

Run: `git status --short`

Expected: no unexpected changes beyond the intended `ScheduleCalendar` and test updates.

- [ ] **Step 4: Commit a follow-up only if verification required code changes**

If verification required no further edits, do not create an extra commit. If a small follow-up fix was needed during verification, commit it with:

```bash
git add web/src/app/components/ScheduleCalendar.tsx web/src/app/schedule-builder/components.test.tsx
git commit -m "test: verify padded schedule time window"
```

## Self-Review

- Spec coverage: the plan covers the `9:00 AM` to `5:00 PM` baseline, early and late padded expansion, independent dual-side expansion, and preserving the current empty-state and meeting-placement behavior.
- Placeholder scan: every step names exact files, code blocks, commands, and expected outcomes.
- Type consistency: the plan keeps the existing `ScheduleCalendarEntry` and helper signatures intact, changing only the internal time-window constants and `deriveTimeWindow` logic.
