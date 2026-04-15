import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveScheduleCalendarEntries,
  expandMeetingDays,
  parseTimeToMinutes,
  type GeneratedSchedule,
  type ScheduleBuilderCourseDetailResponse,
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
    schedule_packages: [],
    ...overrides,
  };
}

test("parseTimeToMinutes converts HH:MM values into minutes", () => {
  assert.equal(parseTimeToMinutes("09:15"), 555);
  assert.equal(parseTimeToMinutes("17:05"), 1025);
  assert.equal(parseTimeToMinutes(54000000), 540);
  assert.equal(parseTimeToMinutes(57000000), 590);
  assert.equal(parseTimeToMinutes("9:15"), null);
  assert.equal(parseTimeToMinutes(null), null);
});

test("expandMeetingDays expands each applicable weekday", () => {
  assert.deepEqual(expandMeetingDays("MWF"), ["M", "W", "F"]);
  assert.deepEqual(expandMeetingDays("SU"), ["S", "U"]);
  assert.deepEqual(expandMeetingDays(null), []);
});

test("deriveScheduleCalendarEntries joins generated schedules to course detail meetings", () => {
  const schedule: GeneratedSchedule = {
    package_ids: ["pkg-1", "pkg-2"],
    packages: [
      {
        source_package_id: "pkg-1",
        course_designation: "COMP SCI 577",
        title: "Algorithms for Large Data",
        section_bundle_label: "LEC 001",
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
      {
        source_package_id: "pkg-2",
        course_designation: "MATH 240",
        title: "Linear Algebra",
        section_bundle_label: "LEC 002",
        open_seats: 5,
        is_full: 0,
        has_waitlist: 0,
        meeting_count: 1,
        campus_day_count: 1,
        earliest_start_minute_local: 660,
        latest_end_minute_local: 710,
        has_online_meeting: 0,
        has_unknown_location: 0,
        restriction_note: null,
        has_temporary_restriction: 0,
        meeting_summary_local: "S 11:00-11:50",
      },
      {
        source_package_id: "pkg-3",
        course_designation: "STAT 240",
        title: "Data Science Modeling I",
        section_bundle_label: "LEC 003",
        open_seats: 2,
        is_full: 0,
        has_waitlist: 0,
        meeting_count: 1,
        campus_day_count: 1,
        earliest_start_minute_local: 780,
        latest_end_minute_local: 830,
        has_online_meeting: 0,
        has_unknown_location: 0,
        restriction_note: null,
        has_temporary_restriction: 0,
        meeting_summary_local: "T 13:00-13:50",
      },
    ],
    conflict_count: 0,
    campus_day_count: 4,
    earliest_start_minute_local: 540,
    large_idle_gap_count: 0,
    tight_transition_count: 0,
    total_walking_distance_meters: 0,
    total_open_seats: 8,
    latest_end_minute_local: 710,
  };

  const details = [
    makeCourseDetail({
      meetings: [
        {
          sectionClassNumber: 57701,
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
    makeCourseDetail({
      course: {
        designation: "STAT 240",
        title: "Data Science Modeling I",
        minimumCredits: 3,
        maximumCredits: 3,
        crossListDesignations: ["STAT 240"],
        sectionCount: 1,
        hasAnyOpenSeats: true,
        hasAnyWaitlist: false,
        hasAnyFullSection: false,
        description: null,
        subjectCode: "943",
        catalogNumber: "240",
        courseId: "002241",
        enrollmentPrerequisites: null,
      },
      meetings: [
        {
          sectionClassNumber: 24003,
          sourcePackageId: "pkg-3",
          meetingIndex: 1,
          meetingType: "CLASS",
          meetingDays: "T",
          meetingTimeStart: 68400000,
          meetingTimeEnd: 71400000,
          startDate: null,
          endDate: null,
          examDate: null,
          room: "901",
          buildingCode: "901",
          buildingName: "Medical Sciences Center",
          streetAddress: "1300 University Ave.",
          latitude: 43.074,
          longitude: -89.403,
          locationKnown: true,
        },
      ],
    }),
    makeCourseDetail({
      course: {
        designation: "MATH 240",
        title: "Linear Algebra",
        minimumCredits: 3,
        maximumCredits: 3,
        crossListDesignations: ["MATH 240"],
        sectionCount: 1,
        hasAnyOpenSeats: true,
        hasAnyWaitlist: false,
        hasAnyFullSection: false,
        description: null,
        subjectCode: "640",
        catalogNumber: "240",
        courseId: "002240",
        enrollmentPrerequisites: null,
      },
      meetings: [
        {
          sectionClassNumber: 24002,
          sourcePackageId: "pkg-2",
          meetingIndex: 1,
          meetingType: "CLASS",
          meetingDays: "S",
          meetingTimeStart: 61200000,
          meetingTimeEnd: 64200000,
          startDate: null,
          endDate: null,
          examDate: null,
          room: "B203",
          buildingCode: "B2",
          buildingName: "Van Vleck Hall",
          streetAddress: "480 Lincoln Dr.",
          latitude: 43.076,
          longitude: -89.412,
          locationKnown: true,
        },
      ],
    }),
  ];

  assert.deepEqual(deriveScheduleCalendarEntries(schedule, details), [
    {
      weekday: "M",
      sourcePackageId: "pkg-1",
      courseDesignation: "COMP SCI 577",
      title: "Algorithms for Large Data",
      sectionBundleLabel: "LEC 001",
      meetingType: "CLASS",
      sectionType: "LEC",
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
      startMinutes: 660,
      endMinutes: 710,
      room: "B203",
      buildingName: "Van Vleck Hall",
    },
  ]);
});

test("deriveScheduleCalendarEntries falls back to section type from bundle label when class number lookup misses", () => {
  const schedule: GeneratedSchedule = {
    package_ids: ["pkg-1"],
    packages: [
      {
        source_package_id: "pkg-1",
        course_designation: "BIOLOGY 151",
        title: "Introductory Biology",
        section_bundle_label: "COMP SCI 577 LEC 001",
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
          sectionClassNumber: 10001,
          sectionNumber: "001",
          sectionType: "LEC",
          instructionMode: "P",
          openSeats: 3,
          waitlistCurrentSize: 0,
          capacity: 24,
          currentlyEnrolled: 21,
          hasOpenSeats: true,
          hasWaitlist: false,
          isFull: false,
        },
      ],
      meetings: [
        {
          sectionClassNumber: 20002,
          sourcePackageId: "pkg-1",
          meetingIndex: 1,
          meetingType: "CLASS",
          meetingDays: "MWF",
          meetingTimeStart: 54000000,
          meetingTimeEnd: 57000000,
          startDate: null,
          endDate: null,
          examDate: null,
          room: "B302",
          buildingCode: "B3",
          buildingName: "Birge Hall",
          streetAddress: "430 Lincoln Dr.",
          latitude: 43.076,
          longitude: -89.414,
          locationKnown: true,
        },
      ],
    }),
  ]);

  assert.equal(entries.length, 3);
  assert(entries.every((entry) => entry.sectionType === "LEC"));
});

test("deriveScheduleCalendarEntries falls back to the first bundle section type when class lookup misses", () => {
  const schedule: GeneratedSchedule = {
    package_ids: ["pkg-1"],
    packages: [
      {
        source_package_id: "pkg-1",
        course_designation: "CHEM 109",
        title: "Advanced General Chemistry",
        section_bundle_label: "LEC 001 / DIS 301",
        open_seats: 3,
        is_full: 0,
        has_waitlist: 0,
        meeting_count: 2,
        campus_day_count: 4,
        earliest_start_minute_local: 540,
        latest_end_minute_local: 770,
        has_online_meeting: 0,
        has_unknown_location: 0,
        restriction_note: null,
        has_temporary_restriction: 0,
        meeting_summary_local: "MWF 09:00-09:50; R 12:00-12:50",
      },
    ],
    conflict_count: 0,
    campus_day_count: 4,
    earliest_start_minute_local: 540,
    large_idle_gap_count: 0,
    tight_transition_count: 0,
    total_walking_distance_meters: 0,
    total_open_seats: 3,
    latest_end_minute_local: 770,
  };

  const entries = deriveScheduleCalendarEntries(schedule, [
    makeCourseDetail({
      meetings: [
        {
          sectionClassNumber: 90009,
          sourcePackageId: "pkg-1",
          meetingIndex: 1,
          meetingType: "CLASS",
          meetingDays: "R",
          meetingTimeStart: 72000000,
          meetingTimeEnd: 75000000,
          startDate: null,
          endDate: null,
          examDate: null,
          room: "120",
          buildingCode: "CH",
          buildingName: "Chamberlin Hall",
          streetAddress: "1150 University Ave.",
          latitude: 43.072,
          longitude: -89.406,
          locationKnown: true,
        },
      ],
    }),
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].sectionType, "LEC");
});
