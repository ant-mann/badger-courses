# Calendar Weekend Hiding & Wider Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide Saturday/Sunday calendar columns by default (show only when an entry falls on that day), and widen the schedule builder page container from 1280px to 1536px.

**Architecture:** Two self-contained changes — a one-line filter in `ScheduleCalendar.tsx` makes `visibleWeekdays` dynamic, and a one-class swap in `page.tsx` widens the outer container. No new props, state, or API changes required.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Node.js test runner (`tsx --test`).

---

### Task 1: Update existing weekday test and add weekend-hiding tests

**Files:**
- Modify: `web/src/app/schedule-builder/components.test.tsx:902-943`

The existing test `"ScheduleCalendar renders all seven weekdays for the selected schedule"` asserts that Sat and Sun are always present. After our change they won't be — so we update that test first, then add three new tests for the new behavior.

- [ ] **Step 1: Update the existing "all seven weekdays" test**

In `web/src/app/schedule-builder/components.test.tsx`, find the test at line 902 and replace its last two `assert.match` lines (which check for Sat and Sun) with `assert.doesNotMatch` lines, since the entries in that test are only on Mon and Wed:

```diff
-  assert.match(markup, />S<|>Sat<|Saturday/);
-  assert.match(markup, />U<|>Sun<|Sunday/);
+  assert.doesNotMatch(markup, />Sat</);
+  assert.doesNotMatch(markup, />Sun</);
```

Also rename the test description to reflect the new behaviour:

```diff
-test("ScheduleCalendar renders all seven weekdays for the selected schedule", () => {
+test("ScheduleCalendar renders Mon–Fri columns but hides Sat/Sun when no entries fall on those days", () => {
```

- [ ] **Step 2: Add test — Sat/Sun hidden when no weekend entries**

Append this test after the block you just edited (after line 943, before the next test):

```ts
test("ScheduleCalendar hides Saturday and Sunday columns when no entries fall on those days", () => {
  const entries: ScheduleCalendarEntry[] = [
    {
      weekday: "M",
      sourcePackageId: "pkg-1",
      courseDesignation: "COMP SCI 577",
      title: "Algorithms for Large Data",
      sectionBundleLabel: "LEC 001",
      meetingType: "CLASS",
      sectionType: null,
      startMinutes: 540,
      endMinutes: 590,
      room: "140",
      buildingName: "Grainger Hall",
    },
    {
      weekday: "F",
      sourcePackageId: "pkg-1",
      courseDesignation: "COMP SCI 577",
      title: "Algorithms for Large Data",
      sectionBundleLabel: "LEC 001",
      meetingType: "CLASS",
      sectionType: null,
      startMinutes: 540,
      endMinutes: 590,
      room: "140",
      buildingName: "Grainger Hall",
    },
  ];

  const markup = renderToStaticMarkup(
    <ScheduleCalendar entries={entries} schedule={makeSchedule()} />,
  );

  assert.doesNotMatch(markup, />Sat</);
  assert.doesNotMatch(markup, />Sun</);
});
```

- [ ] **Step 3: Add test — Sat column appears when an entry is on Saturday**

```ts
test("ScheduleCalendar shows Saturday column when an entry falls on Saturday", () => {
  const entries: ScheduleCalendarEntry[] = [
    {
      weekday: "S",
      sourcePackageId: "pkg-1",
      courseDesignation: "COMP SCI 577",
      title: "Algorithms for Large Data",
      sectionBundleLabel: "LEC 001",
      meetingType: "CLASS",
      sectionType: null,
      startMinutes: 600,
      endMinutes: 660,
      room: null,
      buildingName: null,
    },
  ];

  const markup = renderToStaticMarkup(
    <ScheduleCalendar entries={entries} schedule={makeSchedule()} />,
  );

  assert.match(markup, />Sat</);
  assert.doesNotMatch(markup, />Sun</);
});
```

- [ ] **Step 4: Add test — Sun column appears when an entry is on Sunday**

```ts
test("ScheduleCalendar shows Sunday column when an entry falls on Sunday", () => {
  const entries: ScheduleCalendarEntry[] = [
    {
      weekday: "U",
      sourcePackageId: "pkg-1",
      courseDesignation: "COMP SCI 577",
      title: "Algorithms for Large Data",
      sectionBundleLabel: "LEC 001",
      meetingType: "CLASS",
      sectionType: null,
      startMinutes: 600,
      endMinutes: 660,
      room: null,
      buildingName: null,
    },
  ];

  const markup = renderToStaticMarkup(
    <ScheduleCalendar entries={entries} schedule={makeSchedule()} />,
  );

  assert.doesNotMatch(markup, />Sat</);
  assert.match(markup, />Sun</);
});
```

- [ ] **Step 5: Run the tests to confirm the new tests fail (and the updated test passes)**

```bash
cd /home/chimn/madgrades && pnpm run test:web
```

Expected: the three new tests FAIL (Sat/Sun are still always rendered), and `"ScheduleCalendar renders Mon–Fri columns but hides Sat/Sun..."` passes.

---

### Task 2: Implement dynamic weekend column filtering

**Files:**
- Modify: `web/src/app/components/ScheduleCalendar.tsx:64`

- [ ] **Step 1: Replace the static visibleWeekdays assignment**

In `web/src/app/components/ScheduleCalendar.tsx`, replace line 64:

```diff
-  const visibleWeekdays = CALENDAR_WEEKDAYS;
+  const visibleWeekdays = CALENDAR_WEEKDAYS.filter(
+    (d) => (d !== "S" && d !== "U") || entries.some((e) => e.weekday === d),
+  );
```

No other changes needed — `visibleWeekdays.length` already drives the `--calendar-columns` CSS variable, and both the header loop and day-column loop already iterate over `visibleWeekdays`.

- [ ] **Step 2: Run the tests to confirm all tests pass**

```bash
cd /home/chimn/madgrades && pnpm run test:web
```

Expected: all tests PASS including the three new weekend-hiding tests.

- [ ] **Step 3: Commit**

```bash
cd /home/chimn/madgrades && git add web/src/app/components/ScheduleCalendar.tsx web/src/app/schedule-builder/components.test.tsx && git commit -m "feat: hide Sat/Sun calendar columns when no events fall on those days"
```

---

### Task 3: Widen the schedule builder page container

**Files:**
- Modify: `web/src/app/schedule-builder/page.tsx:7`

- [ ] **Step 1: Change max-w-7xl to max-w-screen-2xl**

In `web/src/app/schedule-builder/page.tsx`, replace line 7:

```diff
-      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
+      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
```

`max-w-screen-2xl` = 1536px (up from `max-w-7xl` = 1280px). The inner two-column grid (`minmax(0,24rem) minmax(0,1fr)`) already gives the calendar all remaining space, so no further layout changes are needed.

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

```bash
cd /home/chimn/madgrades && pnpm run test:web
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
cd /home/chimn/madgrades && git add web/src/app/schedule-builder/page.tsx && git commit -m "feat: widen schedule builder page container to max-w-screen-2xl (1536px)"
```
