import type Database from "better-sqlite3";

import { normalizeCourseDesignation } from "./course-designation";
import { getDb } from "./db";

type SqlitePrimitive = string | number | null;
type Row = Record<string, SqlitePrimitive>;

export type CourseListItem = {
  designation: string;
  title: string;
  minimumCredits: number | null;
  maximumCredits: number | null;
  crossListDesignations: string[];
  sectionCount: number;
  hasAnyOpenSeats: boolean | null;
  hasAnyWaitlist: boolean | null;
  hasAnyFullSection: boolean | null;
};

export type CourseSection = {
  sectionClassNumber: number | null;
  sectionNumber: string;
  sectionType: string;
  instructionMode: string | null;
  openSeats: number | null;
  waitlistCurrentSize: number | null;
  capacity: number | null;
  currentlyEnrolled: number | null;
  hasOpenSeats: boolean | null;
  hasWaitlist: boolean | null;
  isFull: boolean | null;
};

export type PrerequisiteSummary = {
  summaryStatus: string | null;
  courseGroups: string[][];
  escapeClauses: string[];
  rawText: string | null;
  unparsedText: string | null;
};

export type InstructorHistoryItem = {
  sectionNumber: string;
  sectionType: string;
  instructorDisplayName: string | null;
  sameCoursePriorOfferingCount: number | null;
  sameCourseStudentCount: number | null;
  sameCourseGpa: number | null;
  courseHistoricalGpa: number | null;
  instructorMatchStatus: string | null;
};

export type CourseMeeting = {
  sectionClassNumber: number | null;
  sourcePackageId: string;
  meetingIndex: number | null;
  meetingType: string | null;
  meetingDays: string | null;
  meetingTimeStart: string | null;
  meetingTimeEnd: string | null;
  startDate: string | null;
  endDate: string | null;
  examDate: string | null;
  room: string | null;
  buildingCode: string | null;
  buildingName: string | null;
  streetAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  locationKnown: boolean | null;
};

export type PrerequisiteRule = {
  ruleId: string;
  parseStatus: string | null;
  parseConfidence: number | null;
  summaryStatus: string | null;
  courseGroups: string[][];
  escapeClauses: string[];
  rawText: string | null;
  unparsedText: string | null;
};

export type SchedulePackage = {
  sourcePackageId: string;
  sectionBundleLabel: string;
  openSeats: number | null;
  isFull: boolean | null;
  hasWaitlist: boolean | null;
  campusDayCount: number | null;
  meetingSummaryLocal: string | null;
  restrictionNote: string | null;
};

export type CourseDetail = {
  course: CourseListItem & {
    description: string | null;
    subjectCode: string;
    catalogNumber: string;
    courseId: string;
      enrollmentPrerequisites: string | null;
  };
  meetings: CourseMeeting[];
  prerequisites: PrerequisiteRule[];
  instructorGrades: InstructorHistoryItem[];
  prerequisite: PrerequisiteSummary | null;
  sections: CourseSection[];
  schedulePackages: SchedulePackage[];
};

export type CourseSearchParams = {
  query?: string;
  subject?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;

let hasInstructorHistoryView: boolean | null = null;

export const normalizeDesignation = normalizeCourseDesignation;

export function parseStringArrayJson(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

export function parseCourseGroupsJson(value: string | null): string[][] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) &&
      parsed.every(
        (group) => Array.isArray(group) && group.every((item) => typeof item === "string"),
      )
      ? (parsed as string[][])
      : [];
  } catch {
    return [];
  }
}

export function searchCourses(params: CourseSearchParams = {}): CourseListItem[] {
  const db = getDb();
  const query = params.query?.trim() ?? "";
  const subject = params.subject?.trim() ?? "";
  const limit = clampLimit(params.limit);
  const where: string[] = [];
  const bindings: SqlitePrimitive[] = [];

  if (query) {
    const searchLike = `%${escapeLike(query.toUpperCase())}%`;
    where.push(
      `(
        UPPER(course_designation) LIKE ? ESCAPE '\\'
        OR UPPER(title) LIKE ? ESCAPE '\\'
      )`,
    );
    bindings.push(searchLike, searchLike);
  }

  if (subject) {
    where.push("UPPER(course_designation) LIKE ? ESCAPE '\\'");
    bindings.push(`${escapeLike(subject.toUpperCase())}%`);
  }

  bindings.push(limit);

  const rows = db
    .prepare(
      `
        SELECT
          course_designation,
          title,
          minimum_credits,
          maximum_credits,
          cross_list_designations_json,
          section_count,
          has_any_open_seats,
          has_any_waitlist,
          has_any_full_section
        FROM course_overview_v
        ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY has_any_open_seats DESC, course_designation ASC
        LIMIT ?
      `,
    )
    .all(...bindings) as Row[];

  return rows.map(mapCourseListItem);
}

export function getCourseDetail(designation: string): CourseDetail | null {
  const db = getDb();
  let normalizedDesignation: string;

  try {
    normalizedDesignation = normalizeDesignation(decodeURIComponent(designation));
  } catch {
    return null;
  }

  const canonical = resolveCanonicalCourse(db, normalizedDesignation);

  if (!canonical) {
    return null;
  }

  const courseRow = db
    .prepare(
      `
        SELECT
          c.course_designation,
          c.title,
          c.description,
          c.subject_code,
          c.catalog_number,
          c.course_id,
          c.minimum_credits,
          c.maximum_credits,
          c.enrollment_prerequisites,
          co.cross_list_designations_json,
          co.section_count,
          co.has_any_open_seats,
          co.has_any_waitlist,
          co.has_any_full_section
        FROM courses c
        JOIN course_overview_v co
          ON co.term_code = c.term_code AND co.course_id = c.course_id
        WHERE c.term_code = ? AND c.course_id = ?
        LIMIT 1
      `,
    )
    .get(canonical.termCode, canonical.courseId) as Row | undefined;

  if (!courseRow) {
    return null;
  }

  const prerequisiteRow = db
    .prepare(
      `
        SELECT summary_status, course_groups_json, escape_clauses_json, raw_text, unparsed_text
        FROM prerequisite_course_summary_overview_v
        WHERE term_code = ? AND course_id = ?
        ORDER BY rule_id ASC
        LIMIT 1
      `,
    )
    .get(canonical.termCode, canonical.courseId) as Row | undefined;

  const prerequisiteRows = db
    .prepare(
      `
        SELECT
          p.rule_id,
          p.parse_status,
          p.parse_confidence,
          pcs.summary_status,
          pcs.course_groups_json,
          pcs.escape_clauses_json,
          p.raw_text,
          p.unparsed_text
        FROM prerequisite_rule_overview_v p
        LEFT JOIN prerequisite_course_summary_overview_v pcs
          ON pcs.rule_id = p.rule_id
        WHERE p.term_code = ? AND p.course_id = ?
        ORDER BY p.rule_id ASC
      `,
    )
    .all(canonical.termCode, canonical.courseId) as Row[];

  const sections = db
    .prepare(
      `
        SELECT
          section_class_number,
          section_number,
          section_type,
          instruction_mode,
          open_seats,
          waitlist_current_size,
          capacity,
          currently_enrolled,
          has_open_seats,
          has_waitlist,
          is_full
        FROM section_overview_v
        WHERE term_code = ? AND course_id = ?
        ORDER BY section_type ASC, section_number ASC
      `,
    )
    .all(canonical.termCode, canonical.courseId) as Row[];

  const meetings = db
    .prepare(
      `
        SELECT
          section_class_number,
          source_package_id,
          meeting_index,
          meeting_type,
          meeting_days,
          meeting_time_start,
          meeting_time_end,
          start_date,
          end_date,
          exam_date,
          room,
          building_code,
          building_name,
          street_address,
          latitude,
          longitude,
          location_known
        FROM schedule_planning_v
        WHERE term_code = ? AND course_id = ?
        ORDER BY section_class_number ASC, meeting_index ASC, source_package_id ASC
      `,
    )
    .all(canonical.termCode, canonical.courseId) as Row[];

  const schedulePackages = db
    .prepare(
      `
        SELECT
          source_package_id,
          section_bundle_label,
          open_seats,
          is_full,
          has_waitlist,
          campus_day_count,
          meeting_summary_local,
          restriction_note
        FROM schedule_candidates_v
        WHERE term_code = ? AND course_id = ?
        ORDER BY is_full ASC, campus_day_count ASC, earliest_start_minute_local ASC, source_package_id ASC
      `,
    )
    .all(canonical.termCode, canonical.courseId) as Row[];

  const instructorGrades = getInstructorHistory(db, canonical.termCode, canonical.courseId);
  const prerequisites = prerequisiteRows.map(mapPrerequisiteRule);

  return {
    course: {
      ...mapCourseListItem(courseRow),
      description: asNullableString(courseRow.description),
      subjectCode: asString(courseRow.subject_code),
      catalogNumber: asString(courseRow.catalog_number),
      courseId: asString(courseRow.course_id),
      enrollmentPrerequisites: asNullableString(courseRow.enrollment_prerequisites),
    },
    meetings: meetings.map((row) => ({
      sectionClassNumber: asNullableNumber(row.section_class_number),
      sourcePackageId: asString(row.source_package_id),
      meetingIndex: asNullableNumber(row.meeting_index),
      meetingType: asNullableString(row.meeting_type),
      meetingDays: asNullableString(row.meeting_days),
      meetingTimeStart: asNullableString(row.meeting_time_start),
      meetingTimeEnd: asNullableString(row.meeting_time_end),
      startDate: asNullableString(row.start_date),
      endDate: asNullableString(row.end_date),
      examDate: asNullableString(row.exam_date),
      room: asNullableString(row.room),
      buildingCode: asNullableString(row.building_code),
      buildingName: asNullableString(row.building_name),
      streetAddress: asNullableString(row.street_address),
      latitude: asNullableNumber(row.latitude),
      longitude: asNullableNumber(row.longitude),
      locationKnown: asNullableBoolean(row.location_known),
    })),
    prerequisites,
    instructorGrades,
    prerequisite: prerequisiteRow
      ? {
          summaryStatus: asNullableString(prerequisiteRow.summary_status),
          courseGroups: parseCourseGroupsJson(asNullableString(prerequisiteRow.course_groups_json)),
          escapeClauses: parseStringArrayJson(asNullableString(prerequisiteRow.escape_clauses_json)),
          rawText: asNullableString(prerequisiteRow.raw_text),
          unparsedText: asNullableString(prerequisiteRow.unparsed_text),
        }
      : null,
    sections: sections.map((row) => ({
      sectionClassNumber: asNullableNumber(row.section_class_number),
      sectionNumber: asString(row.section_number),
      sectionType: asString(row.section_type),
      instructionMode: asNullableString(row.instruction_mode),
      openSeats: asNullableNumber(row.open_seats),
      waitlistCurrentSize: asNullableNumber(row.waitlist_current_size),
      capacity: asNullableNumber(row.capacity),
      currentlyEnrolled: asNullableNumber(row.currently_enrolled),
      hasOpenSeats: asNullableBoolean(row.has_open_seats),
      hasWaitlist: asNullableBoolean(row.has_waitlist),
      isFull: asNullableBoolean(row.is_full),
    })),
    schedulePackages: schedulePackages.map((row) => ({
      sourcePackageId: asString(row.source_package_id),
      sectionBundleLabel: asString(row.section_bundle_label),
      openSeats: asNullableNumber(row.open_seats),
      isFull: asNullableBoolean(row.is_full),
      hasWaitlist: asNullableBoolean(row.has_waitlist),
      campusDayCount: asNullableNumber(row.campus_day_count),
      meetingSummaryLocal: asNullableString(row.meeting_summary_local),
      restrictionNote: asNullableString(row.restriction_note),
    })),
  };
}

function getInstructorHistory(
  db: Database.Database,
  termCode: string,
  courseId: string,
): InstructorHistoryItem[] {
  if (!supportsInstructorHistoryView(db)) {
    return [];
  }

  const rows = db
    .prepare(
      `
        SELECT
          section_number,
          section_type,
          instructor_display_name,
          same_course_prior_offering_count,
          same_course_student_count,
          same_course_gpa,
          course_historical_gpa,
          instructor_match_status
        FROM current_term_section_instructor_grade_overview_v
        WHERE term_code = ? AND course_id = ?
        ORDER BY same_course_prior_offering_count DESC, same_course_student_count DESC, section_type ASC, section_number ASC
      `,
    )
    .all(termCode, courseId) as Row[];

  return rows.map((row) => ({
    sectionNumber: asString(row.section_number),
    sectionType: asString(row.section_type),
    instructorDisplayName: asNullableString(row.instructor_display_name),
    sameCoursePriorOfferingCount: asNullableNumber(row.same_course_prior_offering_count),
    sameCourseStudentCount: asNullableNumber(row.same_course_student_count),
    sameCourseGpa: asNullableNumber(row.same_course_gpa),
    courseHistoricalGpa: asNullableNumber(row.course_historical_gpa),
    instructorMatchStatus: asNullableString(row.instructor_match_status),
  }));
}

function mapPrerequisiteRule(row: Row): PrerequisiteRule {
  return {
    ruleId: asString(row.rule_id),
    parseStatus: asNullableString(row.parse_status),
    parseConfidence: asNullableNumber(row.parse_confidence),
    summaryStatus: asNullableString(row.summary_status),
    courseGroups: parseCourseGroupsJson(asNullableString(row.course_groups_json)),
    escapeClauses: parseStringArrayJson(asNullableString(row.escape_clauses_json)),
    rawText: asNullableString(row.raw_text),
    unparsedText: asNullableString(row.unparsed_text),
  };
}

function supportsInstructorHistoryView(db: Database.Database): boolean {
  if (hasInstructorHistoryView !== null) {
    return hasInstructorHistoryView;
  }

  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'view' AND name = 'current_term_section_instructor_grade_overview_v'",
    )
    .get() as { name?: string } | undefined;

  hasInstructorHistoryView = row?.name === "current_term_section_instructor_grade_overview_v";
  return hasInstructorHistoryView;
}

function resolveCanonicalCourse(
  db: Database.Database,
  designation: string,
): { termCode: string; courseId: string } | null {
  const canonical = db
    .prepare(
      `
        SELECT term_code, course_id
        FROM course_overview_v
        WHERE course_designation = ?
        LIMIT 1
      `,
    )
    .get(designation) as Row | undefined;

  if (canonical) {
    return {
      termCode: asString(canonical.term_code),
      courseId: asString(canonical.course_id),
    };
  }

  const alias = db
    .prepare(
      `
        SELECT term_code, course_id
        FROM course_cross_listing_overview_v
        WHERE alias_course_designation = ?
        ORDER BY is_primary DESC, canonical_course_designation ASC
        LIMIT 1
      `,
    )
    .get(designation) as Row | undefined;

  if (!alias) {
    return null;
  }

  return {
    termCode: asString(alias.term_code),
    courseId: asString(alias.course_id),
  };
}

function mapCourseListItem(row: Row): CourseListItem {
  return {
    designation: asString(row.course_designation),
    title: asString(row.title),
    minimumCredits: asNullableNumber(row.minimum_credits),
    maximumCredits: asNullableNumber(row.maximum_credits),
    crossListDesignations: parseStringArrayJson(asNullableString(row.cross_list_designations_json)),
    sectionCount: asNullableNumber(row.section_count) ?? 0,
    hasAnyOpenSeats: asNullableBoolean(row.has_any_open_seats),
    hasAnyWaitlist: asNullableBoolean(row.has_any_waitlist),
    hasAnyFullSection: asNullableBoolean(row.has_any_full_section),
  };
}

function clampLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(value)));
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function asString(value: SqlitePrimitive): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function asNullableString(value: SqlitePrimitive): string | null {
  return typeof value === "string" ? value : null;
}

function asNullableNumber(value: SqlitePrimitive): number | null {
  return typeof value === "number" ? value : null;
}

function asNullableBoolean(value: SqlitePrimitive): boolean | null {
  return typeof value === "number" ? value !== 0 : null;
}
