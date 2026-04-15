import type {
  CourseListItem,
  CourseMeeting,
  CourseSection,
  InstructorHistoryItem,
  PrerequisiteRule,
  SchedulePackage,
} from "@/lib/course-data";

const SCHEDULE_TIMEZONE = "America/Chicago";
const localTimePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHEDULE_TIMEZONE,
  hour: "numeric",
  minute: "numeric",
  hour12: false,
});

export type GeneratedSchedulePackage = {
  source_package_id: string;
  course_designation: string;
  title: string;
  section_bundle_label: string;
  open_seats: number | null;
  is_full: number | null;
  has_waitlist: number | null;
  meeting_count: number | null;
  campus_day_count: number | null;
  earliest_start_minute_local: number | null;
  latest_end_minute_local: number | null;
  has_online_meeting: number | null;
  has_unknown_location: number | null;
  restriction_note: string | null;
  has_temporary_restriction: number | null;
  meeting_summary_local: string | null;
};

export type GeneratedSchedule = {
  package_ids: string[];
  packages: GeneratedSchedulePackage[];
  conflict_count: number;
  campus_day_count: number | null;
  earliest_start_minute_local: number | null;
  large_idle_gap_count: number;
  tight_transition_count: number;
  total_walking_distance_meters: number;
  total_open_seats: number;
  latest_end_minute_local: number | null;
};

export type ScheduleBuilderCourseDetailResponse = {
  course: CourseListItem & {
    description: string | null;
    subjectCode: string;
    catalogNumber: string;
    courseId: string;
    enrollmentPrerequisites: string | null;
  };
  sections: CourseSection[];
  meetings: CourseMeeting[];
  prerequisites: PrerequisiteRule[];
  instructor_grades: InstructorHistoryItem[];
  schedule_packages: SchedulePackage[];
  package_section_memberships?: Array<{ packageId: string; sectionClassNumber: number | null }>;
};

export type ScheduleBuilderSchedulesResponse = {
  schedules: GeneratedSchedule[];
};

export type VisibleWeekday = "M" | "T" | "W" | "R" | "F" | "S" | "U";

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

const WEEKDAY_ORDER: VisibleWeekday[] = ["M", "T", "W", "R", "F", "S", "U"];

export function deriveScheduleCalendarEntries(
  schedule: GeneratedSchedule,
  courseDetails: ScheduleBuilderCourseDetailResponse[],
): ScheduleCalendarEntry[] {
  const meetingsByPackageId = new Map<string, CourseMeeting[]>();
  // Composite key `${courseId}:${classNumber}` — prevents cross-course contamination
  // when two selected courses share the same section class number (e.g. synthetic negatives).
  const meetingsByCompositeKey = new Map<string, CourseMeeting[]>();
  const sectionClassNumbersByPackageId = new Map<string, number[]>();
  // Maps any packageId (bundle or source) to its owning courseId.
  const courseIdByPackageId = new Map<string, string>();
  const packagesById = new Map(
    schedule.packages.map((schedulePackage) => [schedulePackage.source_package_id, schedulePackage] as const),
  );

  const sectionTypeByCompositeKey = new Map<string, string>();
  const sectionNumberByCompositeKey = new Map<string, string>();
  for (const courseDetail of courseDetails) {
    const courseId = courseDetail.course.courseId;
    for (const section of courseDetail.sections) {
      if (section.sectionClassNumber !== null) {
        const key = `${courseId}:${section.sectionClassNumber}`;
        if (section.sectionType !== null) {
          sectionTypeByCompositeKey.set(key, section.sectionType);
        }
        sectionNumberByCompositeKey.set(key, section.sectionNumber);
      }
    }
  }
  const sectionTypesByPackageId = new Map(
    schedule.packages.map((schedulePackage) => [
      schedulePackage.source_package_id,
      parseSectionTypesFromBundleLabel(schedulePackage.section_bundle_label),
    ] as const),
  );

  for (const courseDetail of courseDetails) {
    const courseId = courseDetail.course.courseId;

    for (const meeting of courseDetail.meetings) {
      // Track source package → course mapping (fallback for cases without membership data)
      courseIdByPackageId.set(meeting.sourcePackageId, courseId);

      // Index by package ID (fallback behavior)
      const byPkg = meetingsByPackageId.get(meeting.sourcePackageId) ?? [];
      byPkg.push(meeting);
      meetingsByPackageId.set(meeting.sourcePackageId, byPkg);

      // Index by composite key (preferred lookup path)
      if (meeting.sectionClassNumber !== null) {
        const key = `${courseId}:${meeting.sectionClassNumber}`;
        const byClass = meetingsByCompositeKey.get(key) ?? [];
        byClass.push(meeting);
        meetingsByCompositeKey.set(key, byClass);
      }
    }

    // Build package → course ID mapping and section class numbers from membership data.
    // Using courseId as part of the key prevents meetings from a different course with
    // the same class number from being attached to the wrong bundle package.
    if (courseDetail.package_section_memberships) {
      for (const membership of courseDetail.package_section_memberships) {
        courseIdByPackageId.set(membership.packageId, courseId);
        if (membership.sectionClassNumber !== null) {
          const classNumbers = sectionClassNumbersByPackageId.get(membership.packageId) ?? [];
          classNumbers.push(membership.sectionClassNumber);
          sectionClassNumbersByPackageId.set(membership.packageId, classNumbers);
        }
      }
    }
  }

  const entries: ScheduleCalendarEntry[] = [];

  for (const packageId of schedule.package_ids) {
    const schedulePackage = packagesById.get(packageId);

    if (!schedulePackage) {
      continue;
    }

    // Use membership-based lookup when available to handle sourcePackageId mismatches.
    // Without this, a LEC refreshed into a newer package (P2) would be missed when
    // looking up meetings for the bundle package (P1).
    const sectionClassNumbers = sectionClassNumbersByPackageId.get(packageId);
    const courseId = courseIdByPackageId.get(packageId);
    const meetings =
      sectionClassNumbers && sectionClassNumbers.length > 0 && courseId
        ? sectionClassNumbers.flatMap((cn) => meetingsByCompositeKey.get(`${courseId}:${cn}`) ?? [])
        : (meetingsByPackageId.get(packageId) ?? []);

    for (const meeting of meetings) {
      const startMinutes = parseTimeToMinutes(meeting.meetingTimeStart);
      const endMinutes = parseTimeToMinutes(meeting.meetingTimeEnd);

      if (startMinutes == null || endMinutes == null) {
        continue;
      }

      for (const weekday of expandMeetingDays(meeting.meetingDays)) {
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
            courseId: courseId ?? null,
            sectionTypeByCompositeKey,
            sectionTypesByPackageId,
          }),
          sectionNumber:
            meeting.sectionClassNumber !== null && courseId
              ? (sectionNumberByCompositeKey.get(`${courseId}:${meeting.sectionClassNumber}`) ?? null)
              : null,
          startMinutes,
          endMinutes,
          room: meeting.room,
          buildingName: meeting.buildingName,
        });
      }
    }
  }

  return entries.sort(compareCalendarEntries);
}

export function expandMeetingDays(meetingDays: string | null): VisibleWeekday[] {
  if (!meetingDays) {
    return [];
  }

  const expandedDays: VisibleWeekday[] = [];

  for (const weekday of meetingDays.toUpperCase()) {
    if (isVisibleWeekday(weekday) && !expandedDays.includes(weekday)) {
      expandedDays.push(weekday);
    }
  }

  return expandedDays;
}

export function parseTimeToMinutes(value: string | number | null): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    const parts = localTimePartsFormatter.formatToParts(new Date(value));
    const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "", 10);
    const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "", 10);

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
      return null;
    }

    return (hour * 60) + minute;
  }

  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);

  if (hour > 23 || minute > 59) {
    return null;
  }

  return (hour * 60) + minute;
}

function compareCalendarEntries(left: ScheduleCalendarEntry, right: ScheduleCalendarEntry): number {
  return (
    WEEKDAY_ORDER.indexOf(left.weekday) - WEEKDAY_ORDER.indexOf(right.weekday) ||
    left.startMinutes - right.startMinutes ||
    left.endMinutes - right.endMinutes ||
    left.courseDesignation.localeCompare(right.courseDesignation) ||
    left.sourcePackageId.localeCompare(right.sourcePackageId)
  );
}

function isVisibleWeekday(value: string): value is VisibleWeekday {
  return WEEKDAY_ORDER.includes(value as VisibleWeekday);
}

function deriveSectionType({
  meeting,
  sourcePackageId,
  courseId,
  sectionTypeByCompositeKey,
  sectionTypesByPackageId,
}: {
  meeting: CourseMeeting;
  sourcePackageId: string;
  courseId: string | null;
  sectionTypeByCompositeKey: Map<string, string>;
  sectionTypesByPackageId: Map<string, string[]>;
}): string | null {
  if (meeting.sectionClassNumber !== null && courseId !== null) {
    const sectionType = sectionTypeByCompositeKey.get(`${courseId}:${meeting.sectionClassNumber}`);
    if (sectionType) {
      return sectionType;
    }
  }

  const sectionTypesForPackage = sectionTypesByPackageId.get(sourcePackageId) ?? [];

  if (sectionTypesForPackage.length === 0) {
    return null;
  }

  return sectionTypesForPackage[0];
}

function parseSectionTypesFromBundleLabel(sectionBundleLabel: string): string[] {
  const sectionTypes = new Set<string>();

  for (const bundlePart of sectionBundleLabel.split(/[+/]/)) {
    const matches = [...bundlePart.matchAll(/\b([A-Z]{2,4})\s+\d{3}\b/g)];

    if (matches.length > 0) {
      sectionTypes.add(matches[matches.length - 1][1]);
    }
  }

  return [...sectionTypes];
}
