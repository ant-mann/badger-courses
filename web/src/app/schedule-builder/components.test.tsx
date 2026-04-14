import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CoursePicker } from "@/app/components/CoursePicker";
import { ScheduleCalendar } from "@/app/components/ScheduleCalendar";
import { ScheduleResults } from "@/app/components/ScheduleResults";
import { SectionOptionPanel } from "@/app/components/SectionOptionPanel";
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

  assert.match(markup, /No conflict-free schedules match your current courses and section choices/i);
  assert.match(markup, /Relax your locked or excluded sections and try again/i);
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

test("ScheduleCalendar renders only the weekdays used by the selected schedule", () => {
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
  assert.match(markup, />W<|>Wed<|Wednesday/);
  assert.doesNotMatch(markup, />T<|>Tue<|Tuesday/);
  assert.doesNotMatch(markup, />F<|>Fri<|Friday/);
  assert.match(markup, /9:00 AM/);
  assert.match(markup, /position:absolute/);
});

test("ScheduleCalendar shows an accurate empty state when a selected schedule has no entries", () => {
  const markup = renderToStaticMarkup(
    <ScheduleCalendar entries={[]} schedule={makeSchedule()} />,
  );

  assert.match(markup, /No calendar meetings are available for this selected schedule/i);
  assert.doesNotMatch(markup, /Select a generated schedule to see its meetings laid out across the week/i);
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
