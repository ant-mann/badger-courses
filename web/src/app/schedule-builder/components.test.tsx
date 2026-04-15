import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CoursePicker } from "@/app/components/CoursePicker";
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

  assert.match(markup, /6:00 AM/);
  assert.match(markup, /10:00 PM/);
  assert.doesNotMatch(markup, /5:00 AM/);
  assert.doesNotMatch(markup, /11:00 PM/);
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

  assert.match(markup, /bg-blue-100/);
});

test("ScheduleCalendar uses green badge classes for LAB", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ sectionType: "LAB" })]} />,
  );

  assert.match(markup, /bg-green-100/);
});

test("ScheduleCalendar uses orange badge classes for DIS", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ sectionType: "DIS" })]} />,
  );

  assert.match(markup, /bg-orange-100/);
});

test("ScheduleCalendar renders time range before location", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar
      schedule={makeSchedule()}
      entries={[makeEntry({ buildingName: "Grainger Hall", room: "140" })]}
    />,
  );

  const locationIndex = markup.indexOf("Grainger Hall");
  const timeIndex = markup.indexOf("9:00 AM-9:50 AM");

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
