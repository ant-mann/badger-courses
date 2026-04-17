import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CoursePicker } from "@/app/components/CoursePicker";
import { ScheduleAvailabilityFilters } from "@/app/components/ScheduleAvailabilityFilters";
import { ScheduleCalendar } from "@/app/components/ScheduleCalendar";
import { SchedulePriorityList } from "@/app/components/SchedulePriorityList";
import { ScheduleResults } from "@/app/components/ScheduleResults";
import { SectionOptionPanel } from "@/app/components/SectionOptionPanel";
import { SelectedCourseList } from "@/app/components/SelectedCourseList";
import type {
  GeneratedSchedule,
  ScheduleCalendarEntry,
  ScheduleBuilderCourseDetailResponse,
} from "./schedule-data";

function makeCourseDetail(
  overrides: Partial<ScheduleBuilderCourseDetailResponse> = {},
): ScheduleBuilderCourseDetailResponse {
  return {
    course: {
      designation: "COMP SCI 577",
      title: "Algorithms for Large Data",
      minimumCredits: 3,
      maximumCredits: 3,
      crossListDesignations: ["COMP SCI 577"],
      sectionCount: 1,
      hasAnyOpenSeats: true,
      hasAnyWaitlist: false,
      hasAnyFullSection: false,
      description: null,
      subjectCode: "302",
      catalogNumber: "577",
      courseId: "005770",
      enrollmentPrerequisites: null,
    },
    sections: [],
    meetings: [],
    prerequisites: [],
    instructor_grades: [],
    schedule_packages: [
      {
        sourcePackageId: "pkg-1",
        sectionBundleLabel: "LEC 001 + DIS 301",
        openSeats: 4,
        isFull: false,
        hasWaitlist: false,
        campusDayCount: 2,
        meetingSummaryLocal: "TR 11:00-12:15",
        restrictionNote: null,
      },
    ],
    ...overrides,
  };
}

function makeSchedule(overrides: Partial<GeneratedSchedule> = {}): GeneratedSchedule {
  return {
    package_ids: ["pkg-1"],
    packages: [
      {
        source_package_id: "pkg-1",
        course_designation: "COMP SCI 577",
        title: "Algorithms for Large Data",
        section_bundle_label: "LEC 001 + DIS 301",
        open_seats: 4,
        is_full: 0,
        has_waitlist: 0,
        meeting_count: 2,
        campus_day_count: 2,
        earliest_start_minute_local: 660,
        latest_end_minute_local: 735,
        has_online_meeting: 0,
        has_unknown_location: 0,
        restriction_note: null,
        has_temporary_restriction: 0,
        meeting_summary_local: "TR 11:00-12:15",
      },
    ],
    conflict_count: 0,
    campus_day_count: 2,
    earliest_start_minute_local: 660,
    large_idle_gap_count: 0,
    tight_transition_count: 0,
    total_walking_distance_meters: 0,
    total_open_seats: 4,
    latest_end_minute_local: 735,
    ...overrides,
  };
}

test("SectionOptionPanel starts collapsed with a course summary", () => {
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

  assert.match(markup, /COMP SCI 577/);
  assert.match(markup, /Algorithms for Large Data/);
  assert.match(markup, /1 section available/i);
  assert.doesNotMatch(markup, /Lock section/i);
  assert.doesNotMatch(markup, /Exclude section/i);
  assert.doesNotMatch(markup, /package/i);
});

test("SectionOptionPanel keeps restriction details hidden while collapsed", () => {
  const restrictionNote =
    "Reserved for declared majors. | Contact chemistry@wisc.edu for enrollment help.";
  const markup = renderToStaticMarkup(
    <SectionOptionPanel
      course={makeCourseDetail({
        schedule_packages: [
          {
            ...makeCourseDetail().schedule_packages[0],
            restrictionNote,
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

  assert.match(markup, /1 section available/i);
  assert.doesNotMatch(markup, /More details/i);
  assert.doesNotMatch(markup, new RegExp(restrictionNote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("SectionOptionPanel hides meeting rows and controls until expanded", () => {
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
        ],
        meetings: [
          {
            sectionClassNumber: 2002,
            sourcePackageId: "pkg-1",
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
        ],
        schedule_packages: [
          {
            sourcePackageId: "pkg-1",
            sectionBundleLabel: "LEC 002",
            openSeats: 4,
            isFull: false,
            hasWaitlist: false,
            campusDayCount: 2,
            meetingSummaryLocal: "TR 1:00 PM-2:15 PM @ Chemistry Building",
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

  assert.match(markup, /1 section available/i);
  assert.doesNotMatch(markup, /Lock section/i);
  assert.doesNotMatch(markup, /Exclude section/i);
  assert.doesNotMatch(markup, />LEC</);
  assert.doesNotMatch(markup, /TR 1:00 PM-2:15 PM @ Chemistry Building/);
});

test("SectionOptionPanel renders repeated section types without duplicate key warnings", () => {
  const originalError = console.error;
  const errors: unknown[] = [];
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };

  try {
    renderToStaticMarkup(
      <SectionOptionPanel
        course={makeCourseDetail({
          sections: [
            {
              sectionClassNumber: 3101,
              sectionNumber: "301",
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
            {
              sectionClassNumber: 3102,
              sectionNumber: "302",
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
              sectionClassNumber: 3101,
              sourcePackageId: "pkg-discussions",
              meetingIndex: 0,
              meetingType: "DIS",
              meetingDays: "T",
              meetingTimeStart: "09:00",
              meetingTimeEnd: "09:50",
              startDate: null,
              endDate: null,
              examDate: null,
              room: null,
              buildingCode: null,
              buildingName: "Van Vleck Hall",
              streetAddress: null,
              latitude: null,
              longitude: null,
              locationKnown: true,
            },
            {
              sectionClassNumber: 3102,
              sourcePackageId: "pkg-discussions",
              meetingIndex: 0,
              meetingType: "DIS",
              meetingDays: "R",
              meetingTimeStart: "10:00",
              meetingTimeEnd: "10:50",
              startDate: null,
              endDate: null,
              examDate: null,
              room: null,
              buildingCode: null,
              buildingName: "Van Vleck Hall",
              streetAddress: null,
              latitude: null,
              longitude: null,
              locationKnown: true,
            },
          ],
          schedule_packages: [
            {
              sourcePackageId: "pkg-discussions",
              sectionBundleLabel: "DIS 301 + DIS 302",
              sectionTitle: null,
              openSeats: 4,
              isFull: false,
              hasWaitlist: false,
              campusDayCount: 2,
              meetingSummaryLocal: "T 9:00 AM-9:50 AM @ Van Vleck Hall; R 10:00 AM-10:50 AM @ Van Vleck Hall",
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
  } finally {
    console.error = originalError;
  }

  assert.equal(errors.length, 0);
});

test("ScheduleResults explains how to recover when no schedules match", () => {
  const markup = renderToStaticMarkup(
    <ScheduleResults
      schedules={[]}
      selectedScheduleIndex={0}
      requestState="ready"
      loading={false}
      errorMessage={null}
      onSelectSchedule={() => {}}
    />,
  );

  assert.match(markup, /No conflict-free schedules matched these courses and section constraints/i);
  assert.match(markup, /Try unlocking or excluding fewer sections/i);
});

test("ScheduleResults explains intentional zero-result limits separately from no-match results", () => {
  const markup = renderToStaticMarkup(
    <ScheduleResults
      schedules={[]}
      selectedScheduleIndex={0}
      requestState="ready"
      loading={false}
      errorMessage={null}
      zeroLimit={true}
      onSelectSchedule={() => {}}
    />,
  );

  assert.match(markup, /Result limit is set to 0/i);
  assert.match(markup, /Increase the limit to generate schedules/i);
  assert.doesNotMatch(markup, /No conflict-free schedules match your current courses and section choices/i);
});

test("ScheduleResults shows guidance before any generation attempt", () => {
  const markup = renderToStaticMarkup(
    <ScheduleResults
      schedules={[]}
      selectedScheduleIndex={0}
      requestState="idle"
      loading={false}
      errorMessage={null}
      onSelectSchedule={() => {}}
    />,
  );

  assert.match(markup, /Add courses and section constraints to generate schedules/i);
  assert.doesNotMatch(markup, /Relax your locked or excluded sections and try again/i);
});

test("ScheduleResults shows a generated schedule count summary", () => {
  const markup = renderToStaticMarkup(
    <ScheduleResults
      schedules={[makeSchedule(), makeSchedule({ package_ids: ["pkg-2"], packages: [{ ...makeSchedule().packages[0], source_package_id: "pkg-2" }] })]}
      selectedScheduleIndex={0}
      requestState="ready"
      loading={false}
      errorMessage={null}
      onSelectSchedule={() => {}}
    />,
  );

  assert.match(markup, /2 schedules generated/i);
});

test("ScheduleResults shows a retry action for error states", () => {
  const markup = renderToStaticMarkup(
    <ScheduleResults
      schedules={[]}
      selectedScheduleIndex={0}
      requestState="error"
      loading={false}
      errorMessage="Something went wrong."
      onRetry={() => {}}
      onSelectSchedule={() => {}}
    />,
  );

  assert.match(markup, /Retry/i);
});

test("ScheduleResults keeps selected state and uses quieter secondary framing", () => {
  const markup = renderToStaticMarkup(
    <ScheduleResults
      schedules={[
        makeSchedule(),
        makeSchedule({
          package_ids: ["pkg-2"],
          packages: [{ ...makeSchedule().packages[0], source_package_id: "pkg-2" }],
        }),
      ]}
      selectedScheduleIndex={0}
      requestState="ready"
      loading={false}
      errorMessage={null}
      onSelectSchedule={() => {}}
    />,
  );

  assert.match(markup, /Schedule 1/);
  assert.match(markup, /Selected/);
  assert.match(markup, /aria-pressed="false" class="[^"]*rounded-lg[^"]*border-border[^"]*bg-muted\/60/);
});

test("SchedulePriorityList shows ordered rules, guidance copy, and move controls", () => {
  const markup = renderToStaticMarkup(
    <SchedulePriorityList
      preferenceOrder={[
        "later-starts",
        "fewer-campus-days",
        "fewer-long-gaps",
        "earlier-finishes",
      ]}
      onMoveRule={() => {}}
    />,
  );

  assert.match(markup, /Schedule priorities/i);
  assert.match(markup, /Schedules are generated using this priority order top to bottom/i);
  assert.match(markup, />1\.<\/span>\s*<span[^>]*>Later starts</i);
  assert.match(markup, />2\.<\/span>\s*<span[^>]*>Fewer campus days</i);
  assert.match(markup, />3\.<\/span>\s*<span[^>]*>Fewer long gaps</i);
  assert.match(markup, />4\.<\/span>\s*<span[^>]*>Earlier finishes</i);
  assert.equal(markup.match(/Move up/g)?.length, 4);
  assert.equal(markup.match(/Move down/g)?.length, 4);
});

test("ScheduleAvailabilityFilters renders both toggles and locked-section helper copy", () => {
  const markup = renderToStaticMarkup(
    <ScheduleAvailabilityFilters
      includeWaitlisted={true}
      includeClosed={false}
      onIncludeWaitlistedChange={() => {}}
      onIncludeClosedChange={() => {}}
    />,
  );

  assert.match(markup, /Include waitlisted sections/i);
  assert.match(markup, /Include closed sections/i);
  assert.match(markup, /Locked sections still count even if these are off/i);
});

test("ScheduleCalendar renders Mon–Fri columns but hides Sat/Sun when no entries fall on those days", () => {
  const entries: ScheduleCalendarEntry[] = [
    {
      weekday: "M",
      sourcePackageId: "pkg-1",
      courseDesignation: "COMP SCI 577",
      title: "Algorithms for Large Data",
      sectionBundleLabel: "LEC 001",
      meetingType: "CLASS",
      sectionType: null,
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
      sectionType: null,
      sectionNumber: null,
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
  assert.doesNotMatch(markup, />Sat</);
  assert.doesNotMatch(markup, />Sun</);
});

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
      sectionType: null,
      sectionNumber: null,
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
      sectionNumber: null,
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
      sectionNumber: null,
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
          sectionType: null,
          sectionNumber: null,
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

test("ScheduleCalendar expands earlier schedules to the nearest hour boundary", () => {
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
          sectionType: null,
          sectionNumber: null,
          startMinutes: 510,
          endMinutes: 570,
          room: "140",
          buildingName: "Grainger Hall",
        },
      ]}
    />,
  );

  assert.match(markup, /8:00 AM/);
  assert.match(markup, /5:00 PM/);
  assert.doesNotMatch(markup, /7:00 AM/);
});

test("ScheduleCalendar expands later schedules to the nearest hour boundary", () => {
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
          sectionType: null,
          sectionNumber: null,
          startMinutes: 600,
          endMinutes: 1100,
          room: "140",
          buildingName: "Grainger Hall",
        },
      ]}
    />,
  );

  assert.match(markup, /9:00 AM/);
  assert.match(markup, /7:00 PM/);
  assert.doesNotMatch(markup, /8:00 PM/);
});

test("ScheduleCalendar expands both sides independently to nearest hour boundaries", () => {
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
          sectionType: null,
          sectionNumber: null,
          startMinutes: 430,
          endMinutes: 1240,
          room: "140",
          buildingName: "Grainger Hall",
        },
      ]}
    />,
  );

  assert.match(markup, /7:00 AM/);
  assert.match(markup, /9:00 PM/);
  assert.doesNotMatch(markup, /6:00 AM/);
  assert.doesNotMatch(markup, /10:00 PM/);
});

test("ScheduleCalendar shows an accurate empty state when a selected schedule has no entries", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar entries={[]} schedule={makeSchedule()} />,
  );

  assert.match(markup, /No calendar meetings are available for this selected schedule/i);
  assert.doesNotMatch(markup, /Select a generated schedule to see its meetings laid out across the week/i);
});

test("ScheduleCalendar gives equal-duration meetings equal heights", () => {
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
          sectionType: null,
          sectionNumber: null,
          startMinutes: 540,
          endMinutes: 600,
          room: "140",
          buildingName: "Grainger Hall",
        },
        {
          weekday: "W",
          sourcePackageId: "pkg-2",
          courseDesignation: "MATH 240",
          title: "Linear Algebra",
          sectionBundleLabel: "LEC 002",
          meetingType: "CLASS",
          sectionType: null,
          sectionNumber: null,
          startMinutes: 780,
          endMinutes: 840,
          room: "B203",
          buildingName: "Van Vleck Hall",
        },
      ]}
    />,
  );

  const heightMatches = [...markup.matchAll(/height:([0-9.]+)%/g)].map((match) => match[1]);

  assert.equal(heightMatches.length >= 2, true);
  assert.equal(heightMatches[0], heightMatches[1]);
});

function parseStyleAttribute(style: string): Map<string, string> {
  return new Map(
    style
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separatorIndex = declaration.indexOf(":");
        return [
          declaration.slice(0, separatorIndex).trim(),
          declaration.slice(separatorIndex + 1).trim(),
        ];
      }),
  );
}

function getDesktopCalendarArticles(markup: string): Array<{
  ariaLabel: string;
  className: string;
  style: Map<string, string>;
  tag: string;
}> {
  return [...markup.matchAll(/<article([^>]*)>/g)]
    .filter((match) => /class="[^"]*\babsolute\b/.test(match[1]))
    .map((match) => {
    const tag = match[0];
    const attributes = match[1];
    const ariaLabelMatch = attributes.match(/aria-label="([^"]+)"/);
    const classNameMatch = attributes.match(/class="([^"]+)"/);
    const styleMatch = attributes.match(/style="([^"]+)"/);

    assert.ok(ariaLabelMatch, "calendar article should include an aria-label");
    assert.ok(classNameMatch, "calendar article should include classes");
    assert.ok(styleMatch, "calendar article should include inline positioning styles");

    return {
      ariaLabel: ariaLabelMatch[1],
      className: classNameMatch[1],
      style: parseStyleAttribute(styleMatch[1]),
      tag,
    };
    });
}

function getDesktopCalendarSegments(markup: string): Array<{
  ariaLabel: string;
  className: string;
  entryId: string | null;
  startMinutes: number | null;
  endMinutes: number | null;
  style: Map<string, string>;
  tag: string;
}> {
  return getDesktopCalendarArticles(markup).map((article) => {
    const entryIdMatch = article.tag.match(/data-calendar-entry="([^"]+)"/);
    const startMatch = article.tag.match(/data-calendar-segment-start="([0-9]+)"/);
    const endMatch = article.tag.match(/data-calendar-segment-end="([0-9]+)"/);

    return {
      ...article,
      entryId: entryIdMatch?.[1] ?? null,
      startMinutes: startMatch ? Number(startMatch[1]) : null,
      endMinutes: endMatch ? Number(endMatch[1]) : null,
    };
  });
}

function getSegmentGeometry(
  markup: string,
  entryId: string,
  courseDesignation: string,
  startMinutes: number,
  endMinutes: number,
) {
  const segment = getDesktopCalendarSegments(markup).find(
    (candidate) =>
      candidate.entryId === entryId &&
      candidate.startMinutes === startMinutes &&
      candidate.endMinutes === endMinutes,
  );

  if (segment) {
    return segment;
  }

  const article = getArticleByCourse(markup, courseDesignation);

  return {
    ...article,
    entryId,
    startMinutes,
    endMinutes,
  };
}

function getArticleByCourse(markup: string, courseDesignation: string) {
  const article = getDesktopCalendarArticles(markup).find((candidate) =>
    candidate.ariaLabel.startsWith(courseDesignation),
  );

  assert.ok(article, `expected calendar article for ${courseDesignation}`);
  return article;
}

function getCourseColorSignature(className: string): string {
  return className
    .split(/\s+/)
    .filter((token) => /^calendar-course-slot-\d$/.test(token))
    .sort()
    .join(" ");
}

function parseWidthPercent(styleValue: string | undefined): number | null {
  if (!styleValue) {
    return null;
  }

  if (styleValue === "100%") {
    return 100;
  }

  const percentMatch = styleValue.match(/^([0-9.]+)%$/);

  if (percentMatch) {
    return Number(percentMatch[1]);
  }

  const calcMatch = styleValue.match(/^calc\(\(100% - ([0-9.]+)%\) \/ ([0-9]+)\)$/);

  if (!calcMatch) {
    return null;
  }

  return (100 - Number(calcMatch[1])) / Number(calcMatch[2]);
}

function parseLeftPercent(styleValue: string | undefined): number | null {
  if (!styleValue) {
    return null;
  }

  const percentMatch = styleValue.match(/^([0-9.]+)%$/);

  if (percentMatch) {
    return Number(percentMatch[1]);
  }

  const calcMatch = styleValue.match(
    /^calc\(\(\(100% - ([0-9.]+)%\) \/ ([0-9]+)\) \* ([0-9]+) \+ ([0-9.]+)%\)$/,
  );

  if (!calcMatch) {
    return null;
  }

  return ((100 - Number(calcMatch[1])) / Number(calcMatch[2])) * Number(calcMatch[3]) + Number(calcMatch[4]);
}

test("ScheduleCalendar assigns separate desktop lanes to overlapping meetings", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar
      schedule={makeSchedule({
        package_ids: ["pkg-1", "pkg-2"],
        packages: [
          makeSchedule().packages[0],
          {
            ...makeSchedule().packages[0],
            source_package_id: "pkg-2",
            course_designation: "MATH 240",
            title: "Linear Algebra",
          },
        ],
      })}
      entries={[
        makeEntry({
          sourcePackageId: "pkg-1",
          courseDesignation: "COMP SCI 577",
          startMinutes: 540,
          endMinutes: 600,
        }),
        makeEntry({
          sourcePackageId: "pkg-2",
          courseDesignation: "MATH 240",
          title: "Linear Algebra",
          startMinutes: 555,
          endMinutes: 615,
        }),
      ]}
    />,
  );

  const compSciArticle = getArticleByCourse(markup, "COMP SCI 577");
  const mathArticle = getArticleByCourse(markup, "MATH 240");

  assert.equal(getDesktopCalendarArticles(markup).length, 2);
  assert.ok(compSciArticle.style.has("left"), "overlapping article should get a lane offset");
  assert.ok(compSciArticle.style.has("width"), "overlapping article should get a lane width");
  assert.ok(mathArticle.style.has("left"), "second overlapping article should get a lane offset");
  assert.ok(mathArticle.style.has("width"), "second overlapping article should get a lane width");
  assert.notEqual(compSciArticle.style.get("left"), mathArticle.style.get("left"));
});

test("ScheduleCalendar does not treat boundary-touching meetings as overlapping lanes", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar
      schedule={makeSchedule({
        package_ids: ["pkg-1", "pkg-2", "pkg-3"],
        packages: [
          makeSchedule().packages[0],
          {
            ...makeSchedule().packages[0],
            source_package_id: "pkg-2",
            course_designation: "MATH 240",
            title: "Linear Algebra",
          },
          {
            ...makeSchedule().packages[0],
            source_package_id: "pkg-3",
            course_designation: "STAT 340",
            title: "Data Science Modeling I",
          },
        ],
      })}
      entries={[
        makeEntry({
          sourcePackageId: "pkg-1",
          courseDesignation: "COMP SCI 577",
          startMinutes: 540,
          endMinutes: 600,
        }),
        makeEntry({
          sourcePackageId: "pkg-2",
          courseDesignation: "MATH 240",
          title: "Linear Algebra",
          startMinutes: 555,
          endMinutes: 615,
        }),
        makeEntry({
          sourcePackageId: "pkg-3",
          courseDesignation: "STAT 340",
          title: "Data Science Modeling I",
          startMinutes: 615,
          endMinutes: 675,
        }),
      ]}
    />,
  );

  const compSciArticle = getArticleByCourse(markup, "COMP SCI 577");
  const mathArticle = getArticleByCourse(markup, "MATH 240");
  const statArticle = getArticleByCourse(markup, "STAT 340");

  assert.equal(getDesktopCalendarArticles(markup).length, 3);
  assert.ok(compSciArticle.style.has("width"), "first overlapping article should shrink into a lane");
  assert.ok(mathArticle.style.has("width"), "second overlapping article should shrink into a lane");
  assert.equal(statArticle.style.get("left"), "0%", "boundary-touching article should keep the default left edge");
  assert.equal(statArticle.style.get("width"), "100%", "boundary-touching article should keep the default full-width layout");
});

test("ScheduleCalendar expands chained overlaps once earlier conflicts end", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar
      schedule={makeSchedule({
        package_ids: ["pkg-1", "pkg-2", "pkg-3", "pkg-4"],
        packages: [
          makeSchedule().packages[0],
          {
            ...makeSchedule().packages[0],
            source_package_id: "pkg-2",
            course_designation: "MATH 240",
            title: "Linear Algebra",
          },
          {
            ...makeSchedule().packages[0],
            source_package_id: "pkg-3",
            course_designation: "STAT 340",
            title: "Data Science Modeling I",
          },
          {
            ...makeSchedule().packages[0],
            source_package_id: "pkg-4",
            course_designation: "ECON 310",
            title: "Statistics: Measurement in Economics",
          },
        ],
      })}
      entries={[
        makeEntry({
          sourcePackageId: "pkg-1",
          courseDesignation: "COMP SCI 577",
          startMinutes: 540,
          endMinutes: 600,
        }),
        makeEntry({
          sourcePackageId: "pkg-2",
          courseDesignation: "MATH 240",
          title: "Linear Algebra",
          startMinutes: 555,
          endMinutes: 615,
        }),
        makeEntry({
          sourcePackageId: "pkg-3",
          courseDesignation: "STAT 340",
          title: "Data Science Modeling I",
          startMinutes: 570,
          endMinutes: 630,
        }),
        makeEntry({
          sourcePackageId: "pkg-4",
          courseDesignation: "ECON 310",
          title: "Statistics: Measurement in Economics",
          startMinutes: 615,
          endMinutes: 675,
        }),
      ]}
    />,
  );

  const statArticle = getArticleByCourse(markup, "STAT 340");
  const econArticle = getArticleByCourse(markup, "ECON 310");
  const statWidth = parseWidthPercent(statArticle.style.get("width"));
  const econWidth = parseWidthPercent(econArticle.style.get("width"));
  const statLeft = parseLeftPercent(statArticle.style.get("left"));
  const econLeft = parseLeftPercent(econArticle.style.get("left"));

  assert.notEqual(statWidth, null, "expected a parsable width for the continuing overlap article");
  assert.notEqual(econWidth, null, "expected a parsable width for the later chained-overlap article");
  assert.notEqual(statLeft, null, "expected a parsable left offset for the continuing overlap article");
  assert.notEqual(econLeft, null, "expected a parsable left offset for the later chained-overlap article");
  assert.equal(statWidth, econWidth, "the remaining overlap pair should be reflowed to equal-width lanes");
  assert.notEqual(statLeft, econLeft, "the remaining overlap pair should occupy different lanes");
  assert.ok(
    Math.abs(statLeft! - econLeft!) <= statWidth! + 1.5,
    "the remaining overlap pair should stay contiguous after the earlier 3-way conflict ends",
  );
});

test("ScheduleCalendar compacts chained overlaps without leaving a dead middle lane", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar
      schedule={makeSchedule({
        package_ids: ["pkg-a", "pkg-b", "pkg-c", "pkg-d"],
        packages: [
          {
            ...makeSchedule().packages[0],
            source_package_id: "pkg-a",
            course_designation: "A 101",
            title: "Course A",
          },
          {
            ...makeSchedule().packages[0],
            source_package_id: "pkg-b",
            course_designation: "B 101",
            title: "Course B",
          },
          {
            ...makeSchedule().packages[0],
            source_package_id: "pkg-c",
            course_designation: "C 101",
            title: "Course C",
          },
          {
            ...makeSchedule().packages[0],
            source_package_id: "pkg-d",
            course_designation: "D 101",
            title: "Course D",
          },
        ],
      })}
      entries={[
        makeEntry({
          sourcePackageId: "pkg-a",
          courseDesignation: "A 101",
          title: "Course A",
          startMinutes: 540,
          endMinutes: 570,
        }),
        makeEntry({
          sourcePackageId: "pkg-b",
          courseDesignation: "B 101",
          title: "Course B",
          startMinutes: 540,
          endMinutes: 570,
        }),
        makeEntry({
          sourcePackageId: "pkg-c",
          courseDesignation: "C 101",
          title: "Course C",
          startMinutes: 540,
          endMinutes: 720,
        }),
        makeEntry({
          sourcePackageId: "pkg-d",
          courseDesignation: "D 101",
          title: "Course D",
          startMinutes: 600,
          endMinutes: 660,
        }),
      ]}
    />,
  );

  const longArticle = getArticleByCourse(markup, "C 101");
  const laterArticle = getArticleByCourse(markup, "D 101");
  const longWidth = parseWidthPercent(longArticle.style.get("width"));
  const laterWidth = parseWidthPercent(laterArticle.style.get("width"));
  const longLeft = parseLeftPercent(longArticle.style.get("left"));
  const laterLeft = parseLeftPercent(laterArticle.style.get("left"));

  assert.notEqual(longWidth, null, "expected a parsable width for the continuing meeting");
  assert.notEqual(laterWidth, null, "expected a parsable width for the later meeting");
  assert.notEqual(longLeft, null, "expected a parsable left offset for the continuing meeting");
  assert.notEqual(laterLeft, null, "expected a parsable left offset for the later meeting");
  assert.equal(longWidth, laterWidth, "the remaining overlap pair should be reflowed to equal-width lanes");
  assert.notEqual(longLeft, laterLeft, "remaining overlap pair should occupy different lanes");
  assert.ok(
    Math.abs(longLeft! - laterLeft!) <= Math.max(longWidth!, laterWidth!) + 1.5,
    "the remaining overlap pair should stay adjacent instead of leaving a dead middle lane",
  );
});

test("ScheduleCalendar splits middle-survivor overlap topology into compact desktop segments", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar
      schedule={makeSchedule({
        package_ids: ["pkg-a", "pkg-b", "pkg-c", "pkg-d"],
        packages: [
          {
            ...makeSchedule().packages[0],
            source_package_id: "pkg-a",
            course_designation: "A 101",
            title: "Course A",
          },
          {
            ...makeSchedule().packages[0],
            source_package_id: "pkg-b",
            course_designation: "B 101",
            title: "Course B",
          },
          {
            ...makeSchedule().packages[0],
            source_package_id: "pkg-c",
            course_designation: "C 101",
            title: "Course C",
          },
          {
            ...makeSchedule().packages[0],
            source_package_id: "pkg-d",
            course_designation: "D 101",
            title: "Course D",
          },
        ],
      })}
      entries={[
        makeEntry({
          sourcePackageId: "pkg-a",
          courseDesignation: "A 101",
          title: "Course A",
          startMinutes: 540,
          endMinutes: 630,
        }),
        makeEntry({
          sourcePackageId: "pkg-b",
          courseDesignation: "B 101",
          title: "Course B",
          startMinutes: 555,
          endMinutes: 720,
        }),
        makeEntry({
          sourcePackageId: "pkg-c",
          courseDesignation: "C 101",
          title: "Course C",
          startMinutes: 570,
          endMinutes: 600,
        }),
        makeEntry({
          sourcePackageId: "pkg-d",
          courseDesignation: "D 101",
          title: "Course D",
          startMinutes: 630,
          endMinutes: 660,
        }),
      ]}
    />,
  );

  const earlyASegment = getSegmentGeometry(markup, "pkg-a", "A 101", 570, 600);
  const earlyBSegment = getSegmentGeometry(markup, "pkg-b", "B 101", 570, 600);
  const earlyCSegment = getSegmentGeometry(markup, "pkg-c", "C 101", 570, 600);
  const laterBSegment = getSegmentGeometry(markup, "pkg-b", "B 101", 630, 660);
  const laterDSegment = getSegmentGeometry(markup, "pkg-d", "D 101", 630, 660);
  const earlyThreeWayLefts = [earlyASegment, earlyBSegment, earlyCSegment].map((segment) =>
    parseLeftPercent(segment.style.get("left")),
  );
  const earlyThreeWayWidths = [earlyASegment, earlyBSegment, earlyCSegment].map((segment) =>
    parseWidthPercent(segment.style.get("width")),
  );
  const earlyBWidth = parseWidthPercent(earlyBSegment.style.get("width"));
  const laterBWidth = parseWidthPercent(laterBSegment.style.get("width"));
  const laterDWidth = parseWidthPercent(laterDSegment.style.get("width"));
  const laterBLeft = parseLeftPercent(laterBSegment.style.get("left"));
  const laterDLeft = parseLeftPercent(laterDSegment.style.get("left"));

  assert.equal(
    earlyThreeWayLefts.every((left) => left !== null),
    true,
    "the early three-way overlap should expose parsable lane offsets",
  );
  assert.equal(
    earlyThreeWayWidths.every((width) => width !== null),
    true,
    "the early three-way overlap should expose parsable lane widths",
  );
  assert.equal(
    new Set(earlyThreeWayLefts).size,
    3,
    "the early three-way overlap should place each segment in a separate lane",
  );
  assert.notEqual(earlyBWidth, null, "expected a parsable width for the early B segment");
  assert.notEqual(laterBWidth, null, "expected a parsable width for the later B segment");
  assert.notEqual(laterDWidth, null, "expected a parsable width for the later D segment");
  assert.notEqual(laterBLeft, null, "expected a parsable left offset for the later B segment");
  assert.notEqual(laterDLeft, null, "expected a parsable left offset for the later D segment");
  assert.equal(laterBWidth, laterDWidth, "the later two-way overlap should compact to equal-width lanes");
  assert.ok(
    laterBWidth! > earlyBWidth!,
    "the continuing middle-survivor meeting should widen once the earlier three-way overlap ends",
  );
  assert.notEqual(laterBLeft, laterDLeft, "the later two-way overlap should occupy separate lanes");
  assert.ok(
    Math.abs(laterBLeft! - laterDLeft!) <= laterBWidth! + 1.5,
    "the remaining two-meeting overlap should stay contiguous without a dead middle gap",
  );
  assert.ok(
    Math.max(laterBLeft!, laterDLeft!) + laterBWidth! <= 100,
    "the remaining two-meeting overlap should fit within the day column without horizontal overflow",
  );
});

test("ScheduleCalendar gives eight selected courses distinct color slots", () => {
  const entries = Array.from({ length: 8 }, (_, index) => makeEntry({
    sourcePackageId: `pkg-${index + 1}`,
    courseDesignation: `COURSE ${index + 1}`,
    title: `Course ${index + 1}`,
    startMinutes: 540 + index * 70,
    endMinutes: 590 + index * 70,
  }));

  const markup = renderToStaticMarkup(
    <ScheduleCalendar
      schedule={makeSchedule({
        package_ids: entries.map((entry) => entry.sourcePackageId),
        packages: entries.map((entry, index) => ({
          ...makeSchedule().packages[0],
          source_package_id: entry.sourcePackageId,
          course_designation: entry.courseDesignation,
          title: entry.title,
          section_bundle_label: `LEC ${String(index + 1).padStart(3, "0")}`,
        })),
      })}
      entries={entries}
    />,
  );

  const colorSignatures = getDesktopCalendarArticles(markup).map((article) =>
    getCourseColorSignature(article.className),
  );

  assert.equal(colorSignatures.length, 8);
  assert.equal(new Set(colorSignatures).size, 8);
});

test("ScheduleCalendar avoids interactive grid semantics for static calendar content", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar
      schedule={makeSchedule()}
      entries={[
        makeEntry({ weekday: "M" }),
        makeEntry({
          weekday: "W",
          sourcePackageId: "pkg-2",
          courseDesignation: "MATH 240",
          title: "Linear Algebra",
        }),
      ]}
    />,
  );

  const weekdayHeaderTags = [...markup.matchAll(/<div[^>]*>(Mon|Tue|Wed|Thu|Fri)<\/div>/g)].map((match) => match[0]);
  const weekdayLaneTags = [...markup.matchAll(/<section[^>]*aria-label="(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)"[^>]*>/g)].map((match) => match[0]);
  const articleTags = getDesktopCalendarArticles(markup).map((article) => article.tag);

  assert.equal(weekdayHeaderTags.length >= 5, true);
  assert.equal(weekdayLaneTags.length >= 5, true);
  assert.doesNotMatch(markup, /role="grid"/);
  assert.equal(weekdayHeaderTags.some((tag) => /role=/.test(tag)), false);
  assert.equal(weekdayLaneTags.some((tag) => /role=/.test(tag)), false);
  assert.equal(articleTags.some((tag) => /tabindex=/i.test(tag)), false);
});

test("CoursePicker stays prop-driven and presentational", () => {
  const markup = renderToStaticMarkup(
    <CoursePicker
      query="comp sci"
      onQueryChange={() => {}}
      onAddCourse={() => {}}
      loading={false}
      errorMessage={null}
      maxCoursesReached={false}
      results={[
        {
          designation: "COMP SCI 577",
          title: "Algorithms for Large Data",
          minimumCredits: 3,
          maximumCredits: 3,
          crossListDesignations: ["COMP SCI 577"],
          sectionCount: 1,
          hasAnyOpenSeats: true,
          hasAnyWaitlist: false,
          hasAnyFullSection: false,
        },
      ]}
      selectedCourseDesignations={[]}
    />,
  );

  assert.match(markup, /Add course/i);
  assert.match(markup, /COMP SCI 577/);
});

test("CoursePicker does not show no-results copy while loading", () => {
  const markup = renderToStaticMarkup(
    <CoursePicker
      query="comp sci"
      onQueryChange={() => {}}
      onAddCourse={() => {}}
      loading={true}
      errorMessage={null}
      maxCoursesReached={false}
      results={[]}
      selectedCourseDesignations={[]}
    />,
  );

  assert.match(markup, /Searching courses/i);
  assert.doesNotMatch(markup, /No matching courses found for this search/i);
});

test("SelectedCourseList shows its key presentational states", () => {
  const emptyMarkup = renderToStaticMarkup(
    <SelectedCourseList courses={[]} onRemoveCourse={() => {}} />,
  );

  assert.match(emptyMarkup, /No courses selected yet/i);

  const populatedMarkup = renderToStaticMarkup(
    <SelectedCourseList
      courses={[
        {
          designation: "COMP SCI 577",
          title: "Algorithms for Large Data",
          loading: true,
          errorMessage: null,
        },
        {
          designation: "MATH 240",
          title: "Linear Algebra",
          loading: false,
          errorMessage: "Could not load section options.",
        },
      ]}
      onRemoveCourse={() => {}}
    />,
  );

  assert.match(populatedMarkup, /Loading section options/i);
  assert.match(populatedMarkup, /Could not load section options/i);
  assert.match(populatedMarkup, /Remove/i);
});

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

test("ScheduleCalendar shows no type badge when sectionType is null", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ sectionType: null })]} />,
  );

  assert.doesNotMatch(markup, /LEC|LAB|DIS/);
});

test("ScheduleCalendar uses blue badge classes for LEC", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ sectionType: "LEC" })]} />,
  );

  assert.match(markup, /calendar-course-badge-1/);
});

test("ScheduleCalendar uses green badge classes for LAB", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ sectionType: "LAB" })]} />,
  );

  assert.match(markup, /calendar-course-badge-1/);
});

test("ScheduleCalendar uses orange badge classes for DIS", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ sectionType: "DIS" })]} />,
  );

  assert.match(markup, /calendar-course-badge-1/);
});

test("ScheduleCalendar renders time range before location", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar
      schedule={makeSchedule()}
      entries={[makeEntry({ buildingName: "Grainger Hall", room: "140" })]}
    />,
  );

  const visibleMarkup = markup.replace(/aria-label="[^"]+"/g, "");

  const locationIndex = visibleMarkup.indexOf("Grainger Hall");
  const timeIndex = visibleMarkup.indexOf("9:00 AM-9:50 AM");

  assert.ok(locationIndex !== -1, "location should appear in markup");
  assert.ok(timeIndex !== -1, "time range should appear in markup");
  assert.ok(timeIndex < locationIndex, "time range should appear before location");
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
