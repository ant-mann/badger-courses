import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CoursePicker } from "@/app/components/CoursePicker";
import { ScheduleCalendar } from "@/app/components/ScheduleCalendar";
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

test("SectionOptionPanel uses section language in controls", () => {
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

  assert.match(markup, /Section options/i);
  assert.match(markup, /Lock section/i);
  assert.doesNotMatch(markup, /package/i);
});

test("SectionOptionPanel shows long notes behind a disclosure", () => {
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

  assert.match(markup, /<summary[^>]*>.*More details.*\+.*<\/summary>/i);
  assert.match(markup, /<details(?:(?!\sopen).)*>/i);
  assert.equal(markup.split(restrictionNote).length - 1, 1);
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

test("SectionOptionPanel derives labeled meeting rows from course-prefixed bundle labels", () => {
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
            sectionBundleLabel: "COMP SCI 577 LEC 002 + LAB 727 + DIS 427",
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

test("SectionOptionPanel renders labeled meeting rows when meeting times are numeric timestamps", () => {
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
            meetingTimeStart: Date.UTC(2026, 0, 6, 19, 0),
            meetingTimeEnd: Date.UTC(2026, 0, 6, 20, 15),
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
            meetingTimeStart: Date.UTC(2026, 0, 8, 20, 25),
            meetingTimeEnd: Date.UTC(2026, 0, 8, 23, 25),
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
            meetingTimeStart: Date.UTC(2026, 0, 6, 20, 30),
            meetingTimeEnd: Date.UTC(2026, 0, 6, 21, 45),
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

test("ScheduleResults explains how to recover when no schedules match", () => {
  const markup = renderToStaticMarkup(
    <ScheduleResults
      schedules={[]}
      selectedScheduleIndex={0}
      requestState="ready"
      loading={false}
      errorMessage={null}
      view="cards"
      onSelectSchedule={() => {}}
      onViewChange={() => {}}
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
      view="cards"
      zeroLimit={true}
      onSelectSchedule={() => {}}
      onViewChange={() => {}}
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
      view="cards"
      onSelectSchedule={() => {}}
      onViewChange={() => {}}
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
      view="cards"
      onSelectSchedule={() => {}}
      onViewChange={() => {}}
    />,
  );

  assert.match(markup, /2 schedules generated/i);
});

test("ScheduleResults changes mobile output when calendar view is selected", () => {
  const markup = renderToStaticMarkup(
    <ScheduleResults
      schedules={[makeSchedule()]}
      selectedScheduleIndex={0}
      requestState="ready"
      loading={false}
      errorMessage={null}
      view="calendar"
      onSelectSchedule={() => {}}
      onViewChange={() => {}}
    />,
  );

  assert.match(markup, /Calendar preview/i);
  assert.match(markup, /Selected schedule/i);
});

test("ScheduleResults shows a retry action for error states", () => {
  const markup = renderToStaticMarkup(
    <ScheduleResults
      schedules={[]}
      selectedScheduleIndex={0}
      requestState="error"
      loading={false}
      errorMessage="Something went wrong."
      view="cards"
      onRetry={() => {}}
      onSelectSchedule={() => {}}
      onViewChange={() => {}}
    />,
  );

  assert.match(markup, /Retry/i);
});

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
    startMinutes: 540,
    endMinutes: 590,
    room: null,
    buildingName: null,
    ...overrides,
  };
}

test("ScheduleCalendar shows LEC badge for CLASS meeting type", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ meetingType: "CLASS" })]} />,
  );

  assert.match(markup, />LEC</);
});

test("ScheduleCalendar shows LAB badge for LAB meeting type", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ meetingType: "LAB" })]} />,
  );

  assert.match(markup, />LAB</);
});

test("ScheduleCalendar shows DIS badge for DIS meeting type", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ meetingType: "DIS" })]} />,
  );

  assert.match(markup, />DIS</);
});

test("ScheduleCalendar shows no type badge when meetingType is null", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry({ meetingType: null })]} />,
  );

  assert.doesNotMatch(markup, /shrink-0 rounded bg-black/);
});

test("ScheduleCalendar renders time range before section bundle label", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar schedule={makeSchedule()} entries={[makeEntry()]} />,
  );

  const timeIndex = markup.indexOf("9:00 AM");
  const bundleIndex = markup.indexOf("LEC 001");

  assert.equal(timeIndex !== -1, true, "time range should appear in markup");
  assert.equal(bundleIndex !== -1, true, "section bundle label should appear in markup");
  assert.equal(timeIndex < bundleIndex, true, "time range should appear before section bundle label");
});
