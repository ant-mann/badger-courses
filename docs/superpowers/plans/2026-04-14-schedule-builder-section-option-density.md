# Schedule Builder Section Option Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make schedule-builder section rows compact by hiding long notes behind a disclosure and rendering distinct `LEC` / `LAB` / `DIS` meeting lines when structured data is available.

**Architecture:** Keep the change localized to `web/src/app/components/SectionOptionPanel.tsx`. Derive labeled meeting lines from the existing `sectionBundleLabel`, `sections`, and `meetings` data already present in `ScheduleBuilderCourseDetailResponse`, and fall back to `meetingSummaryLocal` when the mapping cannot be resolved. Preserve the existing row badges and actions while replacing the always-visible long note paragraph with a collapsed `<details>` disclosure.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Node test runner via `tsx --test`

---

## File Map

- `web/src/app/components/SectionOptionPanel.tsx`
  - Keep the section-option panel as the single rendering surface.
  - Add small local helpers for bundle parsing, meeting-line derivation, time formatting, and the new disclosure UI.
- `web/src/app/schedule-builder/components.test.tsx`
  - Add regression coverage for note disclosure, labeled `LEC` / `LAB` / `DIS` lines, and fallback-to-summary behavior.

### Task 1: Hide Long Notes Behind A Disclosure

**Files:**
- Modify: `web/src/app/components/SectionOptionPanel.tsx`
- Test: `web/src/app/schedule-builder/components.test.tsx`

- [ ] **Step 1: Write the failing tests for note disclosure behavior**

Add these tests near the existing `SectionOptionPanel` coverage in `web/src/app/schedule-builder/components.test.tsx`:

```tsx
test("SectionOptionPanel shows long notes behind a disclosure", () => {
  const markup = renderToStaticMarkup(
    <SectionOptionPanel
      course={makeCourseDetail({
        schedule_packages: [
          {
            ...makeCourseDetail().schedule_packages[0],
            restrictionNote:
              "Reserved for declared majors. | Contact chemistry@wisc.edu for enrollment help.",
          },
        ],
      })}
      excludedSectionIds={[]}
      loading={false}
      lockedSectionId={null}
      errorMessage={null}
      onExcludeSection={() => {}}
      onLockSection={() => {}}
    />,
  );

  assert.match(markup, /More details/i);
  assert.match(markup, /<details/);
  assert.match(markup, /Reserved for declared majors/i);
});

test("SectionOptionPanel omits the disclosure when no note exists", () => {
  const markup = renderToStaticMarkup(
    <SectionOptionPanel
      course={makeCourseDetail()}
      excludedSectionIds={[]}
      loading={false}
      lockedSectionId={null}
      errorMessage={null}
      onExcludeSection={() => {}}
      onLockSection={() => {}}
    />,
  );

  assert.doesNotMatch(markup, /More details/i);
  assert.doesNotMatch(markup, /<details/);
});
```

- [ ] **Step 2: Run the focused component test file and verify the new test fails**

Run:

```bash
npx tsx --test src/app/schedule-builder/components.test.tsx
```

Expected:

```text
FAIL SectionOptionPanel shows long notes behind a disclosure
```

The failure should be because `More details` and `<details>` do not exist yet.

- [ ] **Step 3: Replace the inline note paragraph with a disclosure in `SectionOptionPanel`**

Replace the current inline `restrictionNote` paragraph with this disclosure block in `web/src/app/components/SectionOptionPanel.tsx`:

```tsx
{schedulePackage.restrictionNote ? (
  <details className="rounded-2xl border border-black/10 bg-white/45 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
    <summary className="cursor-pointer list-none text-sm font-medium text-black/72 marker:content-none dark:text-white/72">
      More details
    </summary>
    <p className="mt-3 text-sm leading-7 text-black/60 dark:text-white/60">
      {schedulePackage.restrictionNote}
    </p>
  </details>
) : null}
```

This is intentionally minimal:

- keep the full note text available
- remove it from the always-visible scan path
- do not add note deduplication or note parsing in this panel

- [ ] **Step 4: Run the focused component test file again and verify the disclosure tests pass**

Run:

```bash
npx tsx --test src/app/schedule-builder/components.test.tsx
```

Expected:

```text
PASS SectionOptionPanel shows long notes behind a disclosure
PASS SectionOptionPanel omits the disclosure when no note exists
```

- [ ] **Step 5: Commit if the user explicitly asks for commits**

```bash
git add web/src/app/components/SectionOptionPanel.tsx web/src/app/schedule-builder/components.test.tsx
git commit -m "fix: collapse long schedule builder section notes"
```

### Task 2: Render Distinct `LEC` / `LAB` / `DIS` Meeting Lines

**Files:**
- Modify: `web/src/app/components/SectionOptionPanel.tsx`
- Test: `web/src/app/schedule-builder/components.test.tsx`

- [ ] **Step 1: Write the failing tests for labeled meeting lines and fallback behavior**

Add these tests after the disclosure tests in `web/src/app/schedule-builder/components.test.tsx`:

```tsx
test("SectionOptionPanel renders separate LEC, LAB, and DIS meeting rows from section details", () => {
  const markup = renderToStaticMarkup(
    <SectionOptionPanel
      course={makeCourseDetail({
        sections: [
          {
            sectionClassNumber: 2002,
            sectionNumber: "002",
            sectionType: "LEC",
            sectionTitle: null,
            instructionMode: null,
            openSeats: 4,
            waitlistCurrentSize: null,
            capacity: null,
            currentlyEnrolled: null,
            hasOpenSeats: true,
            hasWaitlist: false,
            isFull: false,
          },
          {
            sectionClassNumber: 2727,
            sectionNumber: "727",
            sectionType: "LAB",
            sectionTitle: null,
            instructionMode: null,
            openSeats: 4,
            waitlistCurrentSize: null,
            capacity: null,
            currentlyEnrolled: null,
            hasOpenSeats: true,
            hasWaitlist: false,
            isFull: false,
          },
          {
            sectionClassNumber: 2427,
            sectionNumber: "427",
            sectionType: "DIS",
            sectionTitle: null,
            instructionMode: null,
            openSeats: 4,
            waitlistCurrentSize: null,
            capacity: null,
            currentlyEnrolled: null,
            hasOpenSeats: true,
            hasWaitlist: false,
            isFull: false,
          },
        ],
        meetings: [
          {
            sectionClassNumber: 2002,
            sourcePackageId: "pkg-lec-002",
            meetingIndex: 0,
            meetingType: "CLASS",
            meetingDays: "TR",
            meetingTimeStart: "13:00",
            meetingTimeEnd: "14:15",
            startDate: null,
            endDate: null,
            examDate: null,
            room: null,
            buildingCode: null,
            buildingName: "Chemistry Building",
            streetAddress: null,
            latitude: null,
            longitude: null,
            locationKnown: true,
          },
          {
            sectionClassNumber: 2727,
            sourcePackageId: "pkg-chem-104-002-727-427",
            meetingIndex: 0,
            meetingType: "LAB",
            meetingDays: "R",
            meetingTimeStart: "14:25",
            meetingTimeEnd: "17:25",
            startDate: null,
            endDate: null,
            examDate: null,
            room: null,
            buildingCode: null,
            buildingName: "Chemistry Building",
            streetAddress: null,
            latitude: null,
            longitude: null,
            locationKnown: true,
          },
          {
            sectionClassNumber: 2427,
            sourcePackageId: "pkg-chem-104-002-727-427",
            meetingIndex: 0,
            meetingType: "DIS",
            meetingDays: "T",
            meetingTimeStart: "14:30",
            meetingTimeEnd: "15:45",
            startDate: null,
            endDate: null,
            examDate: null,
            room: null,
            buildingCode: null,
            buildingName: "Chemistry Building",
            streetAddress: null,
            latitude: null,
            longitude: null,
            locationKnown: true,
          },
        ],
        schedule_packages: [
          {
            sourcePackageId: "pkg-chem-104-002-727-427",
            sectionBundleLabel: "LEC 002 + LAB 727 + DIS 427",
            sectionTitle: null,
            openSeats: 4,
            isFull: false,
            hasWaitlist: false,
            campusDayCount: 2,
            meetingSummaryLocal:
              "TR 1:00 PM-2:15 PM @ Chemistry Building; R 2:25 PM-5:25 PM @ Chemistry Building; T 2:30 PM-3:45 PM @ Chemistry Building",
            restrictionNote: null,
          },
        ],
      })}
      excludedSectionIds={[]}
      loading={false}
      lockedSectionId={null}
      errorMessage={null}
      onExcludeSection={() => {}}
      onLockSection={() => {}}
    />,
  );

  assert.match(markup, />LEC</);
  assert.match(markup, />LAB</);
  assert.match(markup, />DIS</);
  assert.match(markup, /TR 1:00 PM-2:15 PM @ Chemistry Building/);
  assert.match(markup, /R 2:25 PM-5:25 PM @ Chemistry Building/);
  assert.match(markup, /T 2:30 PM-3:45 PM @ Chemistry Building/);
});

test("SectionOptionPanel falls back to the merged meeting summary when labeled rows cannot be derived", () => {
  const markup = renderToStaticMarkup(
    <SectionOptionPanel
      course={makeCourseDetail({
        sections: [],
        meetings: [],
        schedule_packages: [
          {
            ...makeCourseDetail().schedule_packages[0],
            meetingSummaryLocal: "TR 11:00-12:15",
          },
        ],
      })}
      excludedSectionIds={[]}
      loading={false}
      lockedSectionId={null}
      errorMessage={null}
      onExcludeSection={() => {}}
      onLockSection={() => {}}
    />,
  );

  assert.match(markup, /TR 11:00-12:15/);
  assert.doesNotMatch(markup, />LEC</);
});
```

- [ ] **Step 2: Run the focused component test file and verify the meeting-line test fails**

Run:

```bash
npx tsx --test src/app/schedule-builder/components.test.tsx
```

Expected:

```text
FAIL SectionOptionPanel renders separate LEC, LAB, and DIS meeting rows from section details
```

The failure should be because the component still renders one merged paragraph rather than distinct labeled lines.

- [ ] **Step 3: Add local helpers and render labeled meeting lines in `SectionOptionPanel`**

Add these helpers near the top of `web/src/app/components/SectionOptionPanel.tsx`:

```tsx
type MeetingLine = {
  key: string;
  label: string;
  detail: string;
};

function parseBundleSections(
  sectionBundleLabel: string,
): Array<{ sectionType: string; sectionNumber: string }> {
  return sectionBundleLabel
    .split(" + ")
    .map((part) => /^([A-Z]+)\s+([0-9A-Z]+)$/.exec(part.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({
      sectionType: match[1],
      sectionNumber: match[2],
    }));
}

function formatLocalTime(value: string | number | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const hour = Number.parseInt(match[1], 10);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 || 12;

  return `${normalizedHour}:${minute} ${suffix}`;
}

function formatMeetingDetail(
  meeting: ScheduleBuilderCourseDetailResponse["meetings"][number],
): string {
  const days = meeting.meetingDays ?? "Days unavailable";
  const start = formatLocalTime(meeting.meetingTimeStart);
  const end = formatLocalTime(meeting.meetingTimeEnd);
  const timeRange = start && end ? `${days} ${start}-${end}` : days;
  const location = meeting.buildingName ?? meeting.room;

  return location ? `${timeRange} @ ${location}` : timeRange;
}

function buildMeetingLines(
  course: ScheduleBuilderCourseDetailResponse,
  schedulePackage: SchedulePackage,
): MeetingLine[] {
  const sectionsByKey = new Map(
    course.sections.map((section) => [
      `${section.sectionType}|${section.sectionNumber}`,
      section,
    ] as const),
  );
  const meetingsByClassNumber = new Map<
    number,
    Array<ScheduleBuilderCourseDetailResponse["meetings"][number]>
  >();

  for (const meeting of course.meetings) {
    if (meeting.sectionClassNumber === null) {
      continue;
    }

    const existing = meetingsByClassNumber.get(meeting.sectionClassNumber) ?? [];
    existing.push(meeting);
    meetingsByClassNumber.set(meeting.sectionClassNumber, existing);
  }

  return parseBundleSections(schedulePackage.sectionBundleLabel).flatMap(
    ({ sectionType, sectionNumber }) => {
      const section = sectionsByKey.get(`${sectionType}|${sectionNumber}`);

      if (!section?.sectionClassNumber) {
        return [];
      }

      return (meetingsByClassNumber.get(section.sectionClassNumber) ?? [])
        .slice()
        .sort((left, right) => (left.meetingIndex ?? 0) - (right.meetingIndex ?? 0))
        .map((meeting, meetingIndex) => ({
          key: `${sectionType}-${sectionNumber}-${meeting.meetingIndex ?? meetingIndex}`,
          label: sectionType,
          detail: formatMeetingDetail(meeting),
        }));
    },
  );
}
```

Then replace the current single meeting-summary paragraph with this rendering block inside the row loop:

```tsx
const meetingLines = buildMeetingLines(course, schedulePackage);

return (
  <article
    key={schedulePackage.sourcePackageId}
    className="rounded-3xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.04]"
  >
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{schedulePackage.sectionBundleLabel}</h3>
          {locked ? (
            <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-900 dark:text-emerald-100">
              Locked section
            </span>
          ) : null}
          {excluded ? (
            <span className="rounded-full bg-red-500/12 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-red-900 dark:text-red-100">
              Excluded section
            </span>
          ) : null}
        </div>

        {meetingLines.length > 0 ? (
          <div className="grid gap-2 text-sm leading-6 text-black/68 dark:text-white/68">
            {meetingLines.map((meetingLine) => (
              <div
                key={meetingLine.key}
                className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-3"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45 dark:text-white/45">
                  {meetingLine.label}
                </span>
                <span>{meetingLine.detail}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-7 text-black/68 dark:text-white/68">
            {schedulePackage.meetingSummaryLocal ?? "Meeting summary unavailable."}
          </p>
        )}

        <p className="text-sm text-black/60 dark:text-white/60">
          {seatsLabel(schedulePackage)}
          {schedulePackage.campusDayCount !== null ? `, ${schedulePackage.campusDayCount} campus days` : ""}
        </p>

        {schedulePackage.restrictionNote ? (
          <details className="rounded-2xl border border-black/10 bg-white/45 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
            <summary className="cursor-pointer list-none text-sm font-medium text-black/72 marker:content-none dark:text-white/72">
              More details
            </summary>
            <p className="mt-3 text-sm leading-7 text-black/60 dark:text-white/60">
              {schedulePackage.restrictionNote}
            </p>
          </details>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onLockSection(locked ? null : schedulePackage.sourcePackageId)}
          className="min-h-11 rounded-full border border-black/10 px-4 text-sm font-medium transition hover:border-black/20 hover:bg-black/[0.03] dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
        >
          {locked ? "Unlock section" : "Lock section"}
        </button>
        <button
          type="button"
          onClick={() => onExcludeSection(schedulePackage.sourcePackageId, !excluded)}
          className="min-h-11 rounded-full border border-black/10 px-4 text-sm font-medium transition hover:border-black/20 hover:bg-black/[0.03] dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
        >
          {excluded ? "Include section" : "Exclude section"}
        </button>
      </div>
    </div>
  </article>
);
```

Important implementation notes:

- do not key meeting derivation off `meeting.sourcePackageId` alone, because the lecture meeting may live under a separate lecture package ID
- instead, parse the bundle members from `sectionBundleLabel`, match them to `course.sections`, then match meetings by `sectionClassNumber`
- keep the fallback paragraph exactly for packages that cannot be mapped reliably

- [ ] **Step 4: Run the focused component test file again and verify the new meeting-line tests pass**

Run:

```bash
npx tsx --test src/app/schedule-builder/components.test.tsx
```

Expected:

```text
PASS SectionOptionPanel renders separate LEC, LAB, and DIS meeting rows from section details
PASS SectionOptionPanel falls back to the merged meeting summary when labeled rows cannot be derived
```

- [ ] **Step 5: Commit if the user explicitly asks for commits**

```bash
git add web/src/app/components/SectionOptionPanel.tsx web/src/app/schedule-builder/components.test.tsx
git commit -m "fix: clarify schedule builder section meeting lines"
```

### Task 3: Run Broader Verification And Manual Smoke Checks

**Files:**
- Verify only: `web/src/app/components/SectionOptionPanel.tsx`, `web/src/app/schedule-builder/components.test.tsx`

- [ ] **Step 1: Re-run the focused component test file as a clean final check**

Run:

```bash
npx tsx --test src/app/schedule-builder/components.test.tsx
```

Expected:

```text
All tests pass with the new disclosure and labeled meeting rendering covered.
```

- [ ] **Step 2: Run the full web test suite to catch regressions outside this component**

Run:

```bash
npm run test --workspace=web
```

Expected:

```text
All listed web tests pass.
```

- [ ] **Step 3: Verify the browser behavior manually with a real course that currently reproduces the problem**

Run:

```bash
npm run dev --workspace=web
```

Then open the printed local URL and visit:

```text
/schedule-builder?course=CHEM+104&limit=25&view=cards
```

Expected:

```text
- each CHEM 104 row is shorter than before
- the row shows separate LEC, LAB, and DIS labels on the left
- the right side shows the corresponding time/building line for each label
- the long repeated note is hidden until More details is expanded
- Lock section and Exclude section still work visually
```

- [ ] **Step 4: Commit if the user explicitly asks for commits**

```bash
git add web/src/app/components/SectionOptionPanel.tsx web/src/app/schedule-builder/components.test.tsx
git commit -m "fix: declutter schedule builder section options"
```
