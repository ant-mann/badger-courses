# Calendar Block Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign schedule calendar event blocks: new row order (name+badge → location → time), colored type badges that include the section number (e.g. "LEC 007"), single-line truncated location, and no bundle label row.

**Architecture:** Add `sectionNumber` to `ScheduleCalendarEntry` (populated via a new `sectionNumberByClassNumber` map in `deriveScheduleCalendarEntries`), then update the block template in `ScheduleCalendar.tsx` to use the new layout and a `badgeClasses()` helper for badge colors.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Node.js test runner (`tsx --test`)

---

## File Map

| File | Change |
|------|--------|
| `web/src/app/schedule-builder/schedule-data.ts` | Add `sectionNumber: string \| null` to `ScheduleCalendarEntry` type; build + use `sectionNumberByClassNumber` map in `deriveScheduleCalendarEntries` |
| `web/src/app/schedule-builder/schedule-data.test.ts` | Add `sectionNumber: null` to all 4 entries in deepEqual test; add new test for sectionNumber derivation |
| `web/src/app/schedule-builder/components.test.tsx` | Add `sectionNumber: "001"` to `makeEntry()`; update badge content tests; replace bundle-label ordering test with location-before-time and no-bundle-label tests; add badge color tests |
| `web/src/app/components/ScheduleCalendar.tsx` | Add `badgeClasses()` helper; rewrite block rows (name+badge → location → time); colored badge with section number; `truncate whitespace-nowrap` on location; remove bundle label row |

---

## Task 1: Add `sectionNumber` to `ScheduleCalendarEntry` and populate it

**Files:**
- Modify: `web/src/app/schedule-builder/schedule-data.ts:72-191`
- Modify: `web/src/app/schedule-builder/schedule-data.test.ts:229-282`
- Modify: `web/src/app/schedule-builder/components.test.tsx:1273-1288`

### Step 1: Update the deepEqual test to expect `sectionNumber: null`

In `web/src/app/schedule-builder/schedule-data.test.ts`, find the four expected entry objects inside `assert.deepEqual(deriveScheduleCalendarEntries(schedule, details), [...])` (lines 230–282) and add `sectionNumber: null` to each:

```ts
assert.deepEqual(deriveScheduleCalendarEntries(schedule, details), [
  {
    weekday: "M",
    sourcePackageId: "pkg-1",
    courseDesignation: "COMP SCI 577",
    title: "Algorithms for Large Data",
    sectionBundleLabel: "LEC 001",
    meetingType: "CLASS",
    sectionType: "LEC",
    sectionNumber: null,
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
    sectionType: "LEC",
    sectionNumber: null,
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
    sectionType: "LEC",
    sectionNumber: null,
    startMinutes: 540,
    endMinutes: 590,
    room: "140",
    buildingName: "Grainger Hall",
  },
  {
    weekday: "S",
    sourcePackageId: "pkg-2",
    courseDesignation: "MATH 240",
    title: "Linear Algebra",
    sectionBundleLabel: "LEC 002",
    meetingType: "CLASS",
    sectionType: "LEC",
    sectionNumber: null,
    startMinutes: 660,
    endMinutes: 710,
    room: "B203",
    buildingName: "Van Vleck Hall",
  },
]);
```

Note: `sectionNumber` is `null` here because the `makeCourseDetail()` instances in this test have `sections: []` — no section class numbers are indexed.

### Step 2: Add a new test for sectionNumber derivation

Add the following new test at the end of `web/src/app/schedule-builder/schedule-data.test.ts` (after line 549):

```ts
test("deriveScheduleCalendarEntries populates sectionNumber from sections when class number matches", () => {
  const schedule: GeneratedSchedule = {
    package_ids: ["pkg-1"],
    packages: [
      {
        source_package_id: "pkg-1",
        course_designation: "COMP SCI 400",
        title: "Programming III",
        section_bundle_label: "LEC 007",
        open_seats: 3,
        is_full: 0,
        has_waitlist: 0,
        meeting_count: 1,
        campus_day_count: 3,
        earliest_start_minute_local: 540,
        latest_end_minute_local: 590,
        has_online_meeting: 0,
        has_unknown_location: 0,
        restriction_note: null,
        has_temporary_restriction: 0,
        meeting_summary_local: "MWF 09:00-09:50",
      },
    ],
    conflict_count: 0,
    campus_day_count: 3,
    earliest_start_minute_local: 540,
    large_idle_gap_count: 0,
    tight_transition_count: 0,
    total_walking_distance_meters: 0,
    total_open_seats: 3,
    latest_end_minute_local: 590,
  };

  const entries = deriveScheduleCalendarEntries(schedule, [
    makeCourseDetail({
      sections: [
        {
          sectionClassNumber: 40007,
          sectionNumber: "007",
          sectionType: "LEC",
          instructionMode: "P",
          openSeats: 3,
          waitlistCurrentSize: 0,
          capacity: 50,
          currentlyEnrolled: 47,
          hasOpenSeats: true,
          hasWaitlist: false,
          isFull: false,
        },
      ],
      meetings: [
        {
          sectionClassNumber: 40007,
          sourcePackageId: "pkg-1",
          meetingIndex: 1,
          meetingType: "CLASS",
          meetingDays: "MWF",
          meetingTimeStart: 54000000,
          meetingTimeEnd: 57000000,
          startDate: null,
          endDate: null,
          examDate: null,
          room: "140",
          buildingCode: "0140",
          buildingName: "Grainger Hall",
          streetAddress: "975 University Ave.",
          latitude: 43.0727,
          longitude: -89.4015,
          locationKnown: true,
        },
      ],
    }),
  ]);

  assert.equal(entries.length, 3);
  assert(entries.every((e) => e.sectionNumber === "007"), "all entries should have sectionNumber '007'");
});

test("deriveScheduleCalendarEntries sets sectionNumber to null when class number is not in any section", () => {
  const schedule: GeneratedSchedule = {
    package_ids: ["pkg-1"],
    packages: [
      {
        source_package_id: "pkg-1",
        course_designation: "COMP SCI 400",
        title: "Programming III",
        section_bundle_label: "LEC 001",
        open_seats: 3,
        is_full: 0,
        has_waitlist: 0,
        meeting_count: 1,
        campus_day_count: 1,
        earliest_start_minute_local: 540,
        latest_end_minute_local: 590,
        has_online_meeting: 0,
        has_unknown_location: 0,
        restriction_note: null,
        has_temporary_restriction: 0,
        meeting_summary_local: "M 09:00-09:50",
      },
    ],
    conflict_count: 0,
    campus_day_count: 1,
    earliest_start_minute_local: 540,
    large_idle_gap_count: 0,
    tight_transition_count: 0,
    total_walking_distance_meters: 0,
    total_open_seats: 3,
    latest_end_minute_local: 590,
  };

  // sections: [] — no class numbers indexed
  const entries = deriveScheduleCalendarEntries(schedule, [
    makeCourseDetail({
      sections: [],
      meetings: [
        {
          sectionClassNumber: 99999,
          sourcePackageId: "pkg-1",
          meetingIndex: 1,
          meetingType: "CLASS",
          meetingDays: "M",
          meetingTimeStart: 54000000,
          meetingTimeEnd: 57000000,
          startDate: null,
          endDate: null,
          examDate: null,
          room: "140",
          buildingCode: "0140",
          buildingName: "Grainger Hall",
          streetAddress: "975 University Ave.",
          latitude: 43.0727,
          longitude: -89.4015,
          locationKnown: true,
        },
      ],
    }),
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].sectionNumber, null);
});
```

- [ ] **Step 3: Run tests to confirm failures**

Run: `cd /home/chimn/madgrades && pnpm run test:web 2>&1 | grep -E "FAIL|Error|sectionNumber|deepEqual"`

Expected: TypeScript errors about missing `sectionNumber` field, or deepEqual mismatches. The two new tests will also fail because `sectionNumber` doesn't exist yet.

- [ ] **Step 4: Add `sectionNumber` to `ScheduleCalendarEntry` type**

In `web/src/app/schedule-builder/schedule-data.ts`, add the field to the type:

```ts
export type ScheduleCalendarEntry = {
  weekday: VisibleWeekday;
  sourcePackageId: string;
  courseDesignation: string;
  title: string;
  sectionBundleLabel: string;
  meetingType: string | null;
  sectionType: string | null;
  sectionNumber: string | null;
  startMinutes: number;
  endMinutes: number;
  room: string | null;
  buildingName: string | null;
};
```

- [ ] **Step 5: Build the `sectionNumberByClassNumber` map and populate `sectionNumber` in entries**

In `web/src/app/schedule-builder/schedule-data.ts`, in `deriveScheduleCalendarEntries()`, add the map right after the `sectionTypeByClassNumber` loop (around line 106):

```ts
  const sectionTypeByClassNumber = new Map<number, string>();
  const sectionNumberByClassNumber = new Map<number, string>();
  for (const courseDetail of courseDetails) {
    for (const section of courseDetail.sections) {
      if (section.sectionClassNumber !== null && section.sectionType !== null) {
        sectionTypeByClassNumber.set(section.sectionClassNumber, section.sectionType);
      }
      if (section.sectionClassNumber !== null) {
        sectionNumberByClassNumber.set(section.sectionClassNumber, section.sectionNumber);
      }
    }
  }
```

Then in the `entries.push({...})` call (around line 168), add `sectionNumber`:

```ts
        entries.push({
          weekday,
          sourcePackageId: schedulePackage.source_package_id,
          courseDesignation: schedulePackage.course_designation,
          title: schedulePackage.title,
          sectionBundleLabel: schedulePackage.section_bundle_label,
          meetingType: meeting.meetingType,
          sectionType: deriveSectionType({
            meeting,
            sourcePackageId: schedulePackage.source_package_id,
            sectionTypeByClassNumber,
            sectionTypesByPackageId,
          }),
          sectionNumber:
            meeting.sectionClassNumber !== null
              ? (sectionNumberByClassNumber.get(meeting.sectionClassNumber) ?? null)
              : null,
          startMinutes,
          endMinutes,
          room: meeting.room,
          buildingName: meeting.buildingName,
        });
```

- [ ] **Step 6: Add `sectionNumber: "001"` to `makeEntry()` in components.test.tsx**

In `web/src/app/schedule-builder/components.test.tsx`, update `makeEntry()` (around line 1273):

```ts
function makeEntry(overrides: Partial<ScheduleCalendarEntry> = {}): ScheduleCalendarEntry {
  return {
    weekday: "M",
    sourcePackageId: "pkg-1",
    courseDesignation: "COMP SCI 577",
    title: "Intro to Algorithms",
    sectionBundleLabel: "LEC 001",
    meetingType: "CLASS",
    sectionType: "LEC",
    sectionNumber: "001",
    startMinutes: 540,
    endMinutes: 590,
    room: null,
    buildingName: null,
    ...overrides,
  };
}
```

- [ ] **Step 7: Add `sectionNumber: null` to inline `ScheduleCalendarEntry` objects in weekend-hiding tests**

In `web/src/app/schedule-builder/components.test.tsx`, the tests "ScheduleCalendar renders Mon–Fri columns...", "ScheduleCalendar hides Saturday and Sunday...", "ScheduleCalendar shows Saturday column...", "ScheduleCalendar shows Sunday column...", and the time-window test around line 1125 construct inline `ScheduleCalendarEntry` objects (not via `makeEntry()`). Add `sectionNumber: null` to each of those inline entry objects.

Search for these patterns in the file and add `sectionNumber: null` to each:

```ts
// In each inline ScheduleCalendarEntry literal in the test file, add:
sectionNumber: null,
```

The entries are in tests starting around lines 902, 945, 983, 1008, 1100, and 1125. Each inline entry object needs the new field.

- [ ] **Step 8: Run tests and confirm all pass**

Run: `cd /home/chimn/madgrades && pnpm run test:web`

Expected: All tests pass. Fix any TypeScript errors by finding remaining inline `ScheduleCalendarEntry` objects that are missing `sectionNumber`.

- [ ] **Step 9: Commit**

```bash
cd /home/chimn/madgrades && git add web/src/app/schedule-builder/schedule-data.ts web/src/app/schedule-builder/schedule-data.test.ts web/src/app/schedule-builder/components.test.tsx && git commit -m "feat: add sectionNumber field to ScheduleCalendarEntry"
```

---

## Task 2: Redesign calendar block layout with colored badges and section number

**Files:**
- Modify: `web/src/app/schedule-builder/components.test.tsx:1290-1333`
- Modify: `web/src/app/components/ScheduleCalendar.tsx:141-155`

### Step 1: Update badge content tests to expect "TYPE NUM" format

In `web/src/app/schedule-builder/components.test.tsx`, update the three badge content tests (lines 1290–1312):

```ts
test("ScheduleCalendar shows LEC badge for LEC section type", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ sectionType: "LEC", sectionNumber: "001" })]} />,
  );

  assert.match(markup, /LEC 001/);
});

test("ScheduleCalendar shows LAB badge for LAB section type", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ sectionType: "LAB", sectionNumber: "301" })]} />,
  );

  assert.match(markup, /LAB 301/);
});

test("ScheduleCalendar shows DIS badge for DIS section type", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ sectionType: "DIS", sectionNumber: "470" })]} />,
  );

  assert.match(markup, /DIS 470/);
});
```

### Step 2: Update the null-badge test

Replace the existing null-badge test (lines 1314–1320) with one that matches the new badge format:

```ts
test("ScheduleCalendar shows no type badge when sectionType is null", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ sectionType: null, sectionNumber: null })]} />,
  );

  // No badge element at all when sectionType is null
  assert.doesNotMatch(markup, /LEC|LAB|DIS/);
});
```

### Step 3: Add badge color class tests

After the null-badge test, add:

```ts
test("ScheduleCalendar badge has blue color classes for LEC section type", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ sectionType: "LEC" })]} />,
  );

  assert.match(markup, /bg-blue-100/);
});

test("ScheduleCalendar badge has green color classes for LAB section type", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ sectionType: "LAB" })]} />,
  );

  assert.match(markup, /bg-green-100/);
});

test("ScheduleCalendar badge has orange color classes for DIS section type", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ sectionType: "DIS" })]} />,
  );

  assert.match(markup, /bg-orange-100/);
});
```

### Step 4: Replace the "renders time range before section bundle label" test

Replace the entire test at lines 1322–1333 with two tests:

```ts
test("ScheduleCalendar renders location before time range", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar
      schedule={makeSchedule()}
      entries={[makeEntry({ buildingName: "Grainger Hall", room: "140" })]}
    />,
  );

  const locationIndex = markup.indexOf("Grainger Hall");
  const timeIndex = markup.indexOf("9:00 AM");

  assert.ok(locationIndex !== -1, "location should appear in markup");
  assert.ok(timeIndex !== -1, "time range should appear in markup");
  assert.ok(locationIndex < timeIndex, "location should appear before time range");
});

test("ScheduleCalendar does not render section bundle label", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar
      schedule={makeSchedule()}
      entries={[makeEntry({ sectionBundleLabel: "UNIQUE-BUNDLE-XYZ", sectionType: "LEC", sectionNumber: "001" })]}
    />,
  );

  assert.doesNotMatch(markup, /UNIQUE-BUNDLE-XYZ/);
});
```

- [ ] **Step 5: Run tests to confirm new failures**

Run: `cd /home/chimn/madgrades && pnpm run test:web 2>&1 | grep -E "FAIL|not ok"`

Expected: The updated badge content tests fail (currently shows "LEC" not "LEC 001"), the badge color tests fail (no color classes yet), and the new layout tests fail (location is not before time; bundle label still appears).

- [ ] **Step 6: Add `badgeClasses()` helper to `ScheduleCalendar.tsx`**

In `web/src/app/components/ScheduleCalendar.tsx`, add this function before `export function ScheduleCalendar`:

```tsx
function badgeClasses(sectionType: string | null): string {
  switch (sectionType) {
    case "LEC":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "LAB":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "DIS":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    default:
      return "bg-black/8 dark:bg-white/10";
  }
}
```

- [ ] **Step 7: Rewrite the calendar block content in `ScheduleCalendar.tsx`**

Replace the block content inside the `<article>` element (lines 141–155):

```tsx
                      <div className="flex flex-col gap-1 text-xs leading-5">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate font-semibold">{entry.courseDesignation}</p>
                          {typeLabel ? (
                            <span
                              className={`shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide ${badgeClasses(entry.sectionType)}`}
                            >
                              {typeLabel}{entry.sectionNumber ? ` ${entry.sectionNumber}` : ""}
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate whitespace-nowrap text-black/60 dark:text-white/60">
                          {[entry.buildingName, entry.room].filter(Boolean).join(" • ") || "Location unavailable"}
                        </p>
                        <p className="text-black/60 dark:text-white/60">
                          {formatMinutes(entry.startMinutes)}-{formatMinutes(entry.endMinutes)}
                        </p>
                      </div>
```

The full `<article>` block should look like:

```tsx
                    <article
                      key={`${entry.sourcePackageId}-${entry.weekday}-${entry.startMinutes}-${entry.endMinutes}-${entry.meetingType ?? "meeting"}`}
                      className="absolute left-2 right-2 overflow-hidden rounded-xl border border-black/10 bg-black/[0.06] p-2 dark:border-white/10 dark:bg-white/[0.1]"
                      style={{ top: `${top}%`, height: `${Math.max(height, 6)}%`, position: "absolute" }}
                    >
                      <div className="flex flex-col gap-1 text-xs leading-5">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate font-semibold">{entry.courseDesignation}</p>
                          {typeLabel ? (
                            <span
                              className={`shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide ${badgeClasses(entry.sectionType)}`}
                            >
                              {typeLabel}{entry.sectionNumber ? ` ${entry.sectionNumber}` : ""}
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate whitespace-nowrap text-black/60 dark:text-white/60">
                          {[entry.buildingName, entry.room].filter(Boolean).join(" • ") || "Location unavailable"}
                        </p>
                        <p className="text-black/60 dark:text-white/60">
                          {formatMinutes(entry.startMinutes)}-{formatMinutes(entry.endMinutes)}
                        </p>
                      </div>
                    </article>
```

- [ ] **Step 8: Run tests and confirm all pass**

Run: `cd /home/chimn/madgrades && pnpm run test:web`

Expected: All tests pass. If any fail, check for:
- Badge format: `typeLabel` returns the raw section type string (e.g. "LEC"); verify `meetingTypeLabel()` returns `entry.sectionType` for known types
- Color class: ensure `badgeClasses()` is called with `entry.sectionType`
- Location ordering: ensure location `<p>` is before the time `<p>` in the JSX

- [ ] **Step 9: Commit**

```bash
cd /home/chimn/madgrades && git add web/src/app/components/ScheduleCalendar.tsx web/src/app/schedule-builder/components.test.tsx && git commit -m "feat: redesign calendar blocks with colored badges, section number, and location-first layout"
```
