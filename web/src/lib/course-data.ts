import type Database from "better-sqlite3";
import type { Client } from "@libsql/client";
import type { PreferenceRuleId } from "@/app/schedule-builder/preferences";

import { normalizeCourseDesignation } from "./course-designation";
import { getCourseDb, getCourseSqliteDb, getMadgradesDb, getRuntimePostgresDb } from "./db";
import { isSupabaseRuntimeEnabled } from "./env";

type QueryArg = string | number | null;
type Row = Record<string, unknown>;

type CourseSectionRow = CourseSection & {
  sessionCode: string | null;
  sourcePackageId: string;
};

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
  sectionTitle?: string | null;
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
  meetingTimeStart: string | number | null;
  meetingTimeEnd: string | number | null;
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
  sectionTitle?: string | null;
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
  packageSectionMemberships: Array<{ packageId: string; sectionClassNumber: number | null }>;
};

export type CourseSearchParams = {
  query?: string;
  subject?: string;
  limit?: number;
};

type PostgresScheduleCandidate = {
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

type PostgresPackageMeeting = {
  source_package_id: string;
  meeting_days: string | null;
  meeting_time_start: number | null;
  meeting_time_end: number | null;
  start_date: number | null;
  end_date: number | null;
  exam_date: number | null;
  instruction_mode: string | null;
  latitude: number | null;
  longitude: number | null;
  location_known: boolean;
  start_minute_local: number | null;
  end_minute_local: number | null;
};

type GeneratedPostgresSchedule = {
  package_ids: string[];
  packages: PostgresScheduleCandidate[];
  conflict_count: number;
  campus_day_count: number | null;
  earliest_start_minute_local: number | null;
  large_idle_gap_count: number;
  tight_transition_count: number;
  total_walking_distance_meters: number;
  total_open_seats: number;
  latest_end_minute_local: number | null;
};

type PostgresTransition = {
  gap_minutes: number;
  walking_distance_meters: number | null;
  is_tight_transition: number;
};

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;

let hasCourseSearchFtsTable: boolean | null = null;

export const normalizeDesignation = normalizeCourseDesignation;

const SCHEDULE_TIMEZONE = "America/Chicago";
const localTimePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHEDULE_TIMEZONE,
  hour: "numeric",
  minute: "numeric",
  hour12: false,
});

export function __resetCourseDataCachesForTests(): void {
  hasCourseSearchFtsTable = null;
}

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

export function buildPostgresTsquery(query: string): string | null {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return null;
  }

  return normalizedQuery
    .split(" ")
    .filter((token) => token.length > 0)
    .map((token) => `${token}:*`)
    .join(" & ");
}

async function allRows(db: Client, sql: string, args: QueryArg[] = []): Promise<Row[]> {
  const result = await db.execute({ sql, args });
  return result.rows as Row[];
}

async function firstRow(db: Client, sql: string, args: QueryArg[] = []): Promise<Row | undefined> {
  const rows = await allRows(db, sql, args);
  return rows[0];
}

function toPostgresSql(sqlText: string): string {
  let placeholderIndex = 0;

  return sqlText.replace(/\?/g, () => `$${++placeholderIndex}`);
}

async function allRuntimeRows(sqlText: string, args: QueryArg[] = []): Promise<Row[]> {
  const db = getRuntimePostgresDb();
  const rows = await db.unsafe(toPostgresSql(sqlText), args);
  return rows as Row[];
}

async function allCourseRowsRuntime(sqlText: string, args: QueryArg[] = []): Promise<Row[]> {
  if (isSupabaseRuntimeEnabled()) {
    return allRuntimeRows(sqlText, args);
  }

  return allRows(getCourseDb(), sqlText, args);
}

async function firstCourseRowRuntime(sqlText: string, args: QueryArg[] = []): Promise<Row | undefined> {
  if (isSupabaseRuntimeEnabled()) {
    const rows = await allRuntimeRows(sqlText, args);
    return rows[0];
  }

  return firstRow(getCourseDb(), sqlText, args);
}

async function allMadgradesRowsRuntime(sqlText: string, args: QueryArg[] = []): Promise<Row[]> {
  if (isSupabaseRuntimeEnabled()) {
    return allRuntimeRows(sqlText, args);
  }

  return allRows(getMadgradesDb(), sqlText, args);
}

async function firstMadgradesRowRuntime(
  sqlText: string,
  args: QueryArg[] = [],
): Promise<Row | undefined> {
  if (isSupabaseRuntimeEnabled()) {
    const rows = await allRuntimeRows(sqlText, args);
    return rows[0];
  }

  return firstRow(getMadgradesDb(), sqlText, args);
}

function parseSourcePackageSubjectCode(sourcePackageId: string): string | null {
  const parts = sourcePackageId.split(":", 4);
  return parts.length >= 2 ? parts[1] : null;
}

function parseSourcePackageCourseId(sourcePackageId: string): string | null {
  const parts = sourcePackageId.split(":", 4);
  return parts.length >= 3 ? parts[2] : null;
}

function isPreferredSourcePackage(
  candidateSourcePackageId: string,
  currentSourcePackageId: string,
  primarySubjectCode: string,
): boolean {
  const candidateSubjectCode = parseSourcePackageSubjectCode(candidateSourcePackageId);
  const currentSubjectCode = parseSourcePackageSubjectCode(currentSourcePackageId);
  const candidateMatchesPrimary = candidateSubjectCode === primarySubjectCode;
  const currentMatchesPrimary = currentSubjectCode === primarySubjectCode;

  if (candidateMatchesPrimary !== currentMatchesPrimary) {
    return candidateMatchesPrimary;
  }

  return candidateSourcePackageId.localeCompare(currentSourcePackageId) < 0;
}

function mergeRestrictionNotes(...notes: Array<string | null>): string | null {
  const fragments = new Set<string>();

  for (const note of notes) {
    if (!note) {
      continue;
    }

    for (const fragment of note.split(" | ").map((value) => value.trim()).filter(Boolean)) {
      fragments.add(fragment);
    }
  }

  return fragments.size > 0 ? [...fragments].join(" | ") : null;
}

function hasValue(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function hasCompleteMadgradesConfig(): boolean {
  return [
    "TURSO_MADGRADES_DATABASE_URL",
    "TURSO_MADGRADES_AUTH_TOKEN",
    "MADGRADES_MADGRADES_REPLICA_PATH",
  ].every(hasValue);
}

function buildCourseTitleLookup(
  db: Database.Database,
  termCode: string,
  sourcePackageIds: string[],
): Map<string, string> {
  const courseIds = [...new Set(sourcePackageIds.map(parseSourcePackageCourseId).filter(Boolean))];

  if (courseIds.length === 0) {
    return new Map();
  }

  const placeholders = courseIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `
        SELECT DISTINCT course_id, title
        FROM courses
        WHERE term_code = ? AND course_id IN (${placeholders})
      `,
    )
    .all(termCode, ...courseIds) as Row[];

  return new Map(
    rows
      .map((row) => [asString(row.course_id), asString(row.title)] as const)
      .filter((entry) => entry[1].length > 0),
  );
}

async function buildCourseTitleLookupRuntime(
  termCode: string,
  sourcePackageIds: string[],
): Promise<Map<string, string>> {
  const courseIds = [...new Set(sourcePackageIds.map(parseSourcePackageCourseId).filter(Boolean))];

  if (courseIds.length === 0) {
    return new Map();
  }

  const placeholders = courseIds.map(() => "?").join(", ");
  const rows = await allCourseRowsRuntime(
    `
        SELECT DISTINCT course_id, title
        FROM courses
        WHERE term_code = ? AND course_id IN (${placeholders})
      `,
    [termCode, ...courseIds],
  );

  return new Map(
    rows
      .map((row) => [asString(row.course_id), asString(row.title)] as const)
      .filter((entry) => entry[1].length > 0),
  );
}

function buildCourseDetailResult({
  courseRow,
  prerequisiteRow,
  prerequisiteRows,
  sections,
  meetings,
  schedulePackages,
  packageSectionMembershipRows,
  instructorGrades,
  courseTitleLookup,
}: {
  courseRow: Row;
  prerequisiteRow: Row | undefined;
  prerequisiteRows: Row[];
  sections: Row[];
  meetings: Row[];
  schedulePackages: Row[];
  packageSectionMembershipRows: Row[];
  instructorGrades: InstructorHistoryItem[];
  courseTitleLookup: Map<string, string>;
}): CourseDetail {
  const prerequisites = prerequisiteRows.map(mapPrerequisiteRule);
  const mappedSections: CourseSectionRow[] = sections.map((row) => ({
    sectionClassNumber: asNullableNumber(row.section_class_number),
    sectionNumber: asString(row.section_number),
    sectionType: asString(row.section_type),
    sectionTitle: (() => {
      const sourceCourseId = parseSourcePackageCourseId(asString(row.source_package_id));
      const sourceTitle = sourceCourseId ? courseTitleLookup.get(sourceCourseId) ?? null : null;
      return sourceTitle && sourceTitle !== asString(courseRow.title) ? sourceTitle : null;
    })(),
    instructionMode: asNullableString(row.instruction_mode),
    openSeats: asNullableNumber(row.open_seats),
    waitlistCurrentSize: asNullableNumber(row.waitlist_current_size),
    capacity: asNullableNumber(row.capacity),
    currentlyEnrolled: asNullableNumber(row.currently_enrolled),
    hasOpenSeats: asNullableBoolean(row.has_open_seats),
    hasWaitlist: asNullableBoolean(row.has_waitlist),
    isFull: asNullableBoolean(row.is_full),
    sessionCode: asNullableString(row.session_code),
    sourcePackageId: asString(row.source_package_id),
  }));
  const mappedSchedulePackages = schedulePackages.map((row) => ({
    sourcePackageId: asString(row.source_package_id),
    sectionBundleLabel: asString(row.section_bundle_label),
    sectionTitle: (() => {
      const sourceCourseId = parseSourcePackageCourseId(asString(row.source_package_id));
      const sourceTitle = sourceCourseId ? courseTitleLookup.get(sourceCourseId) ?? null : null;
      return sourceTitle && sourceTitle !== asString(courseRow.title) ? sourceTitle : null;
    })(),
    openSeats: asNullableNumber(row.open_seats),
    isFull: asNullableBoolean(row.is_full),
    hasWaitlist: asNullableBoolean(row.has_waitlist),
    campusDayCount: asNullableNumber(row.campus_day_count),
    meetingSummaryLocal: asNullableString(row.meeting_summary_local),
    restrictionNote: asNullableString(row.restriction_note),
  }));
  const dedupedSections = dedupeSections(mappedSections, asString(courseRow.subject_code));
  const dedupedSchedulePackages = dedupeSchedulePackages(
    mappedSchedulePackages,
    asString(courseRow.subject_code),
  );
  const sectionLabelToTitle = new Map(
    dedupedSections
      .filter((section) => section.sectionTitle)
      .map((section) => [
        `${asString(courseRow.course_designation)} ${section.sectionType} ${section.sectionNumber}`,
        section.sectionTitle as string,
      ]),
  );
  const enrichedSchedulePackages = dedupedSchedulePackages.map((schedulePackage) => ({
    ...schedulePackage,
    sectionTitle: schedulePackage.sectionTitle ?? sectionLabelToTitle.get(schedulePackage.sectionBundleLabel) ?? null,
  }));

  return {
    course: {
      ...mapCourseListItem(courseRow),
      description: asNullableString(courseRow.description),
      subjectCode: asString(courseRow.subject_code),
      catalogNumber: asString(courseRow.catalog_number),
      courseId: asString(courseRow.course_id),
      enrollmentPrerequisites: asNullableString(courseRow.enrollment_prerequisites),
      sectionCount: dedupedSections.length,
    },
    meetings: meetings.map((row) => ({
      sectionClassNumber: asNullableNumber(row.section_class_number),
      sourcePackageId: asString(row.source_package_id),
      meetingIndex: asNullableNumber(row.meeting_index),
      meetingType: asNullableString(row.meeting_type),
      meetingDays: asNullableString(row.meeting_days),
      meetingTimeStart: asNullableStringOrNumber(row.meeting_time_start),
      meetingTimeEnd: asNullableStringOrNumber(row.meeting_time_end),
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
    sections: dedupedSections,
    schedulePackages: enrichedSchedulePackages,
    packageSectionMemberships: packageSectionMembershipRows.map((row) => ({
      packageId: asString(row.package_id),
      sectionClassNumber: asNullableNumber(row.section_class_number),
    })),
  };
}

function dedupeSections(sections: CourseSectionRow[], primarySubjectCode: string): CourseSection[] {
  const groupedSections = new Map<string, CourseSectionRow>();

  for (const section of sections) {
    const key = [section.sectionType, section.sectionNumber, section.sessionCode ?? ""].join("|");
    const current = groupedSections.get(key);

    if (!current) {
      groupedSections.set(key, section);
      continue;
    }

    const preferred = isPreferredSourcePackage(
      section.sourcePackageId,
      current.sourcePackageId,
      primarySubjectCode,
    )
      ? section
      : current;
    const fallback = preferred === section ? current : section;

    groupedSections.set(key, {
      ...fallback,
      ...preferred,
      sectionClassNumber: preferred.sectionClassNumber ?? fallback.sectionClassNumber,
      sectionTitle: preferred.sectionTitle ?? fallback.sectionTitle,
      instructionMode: preferred.instructionMode ?? fallback.instructionMode,
      openSeats: preferred.openSeats ?? fallback.openSeats,
      waitlistCurrentSize: preferred.waitlistCurrentSize ?? fallback.waitlistCurrentSize,
      capacity: preferred.capacity ?? fallback.capacity,
      currentlyEnrolled: preferred.currentlyEnrolled ?? fallback.currentlyEnrolled,
      hasOpenSeats: preferred.hasOpenSeats ?? fallback.hasOpenSeats,
      hasWaitlist: preferred.hasWaitlist ?? fallback.hasWaitlist,
      isFull: preferred.isFull ?? fallback.isFull,
    });
  }

  return [...groupedSections.values()].map(({ sessionCode: _sessionCode, sourcePackageId: _sourcePackageId, ...section }) => section);
}

function dedupeSchedulePackages(
  schedulePackages: SchedulePackage[],
  primarySubjectCode: string,
): SchedulePackage[] {
  const groupedPackages = new Map<string, SchedulePackage>();

  for (const schedulePackage of schedulePackages) {
    const key = [schedulePackage.sectionBundleLabel, schedulePackage.meetingSummaryLocal ?? ""].join("|");
    const current = groupedPackages.get(key);

    if (!current) {
      groupedPackages.set(key, schedulePackage);
      continue;
    }

    const preferred = isPreferredSourcePackage(
      schedulePackage.sourcePackageId,
      current.sourcePackageId,
      primarySubjectCode,
    )
      ? schedulePackage
      : current;
    const fallback = preferred === schedulePackage ? current : schedulePackage;

    groupedPackages.set(key, {
      ...fallback,
      ...preferred,
      sourcePackageId: preferred.sourcePackageId,
      sectionTitle: preferred.sectionTitle ?? fallback.sectionTitle,
      openSeats: preferred.openSeats ?? fallback.openSeats,
      isFull: preferred.isFull ?? fallback.isFull,
      hasWaitlist: preferred.hasWaitlist ?? fallback.hasWaitlist,
      campusDayCount: preferred.campusDayCount ?? fallback.campusDayCount,
      meetingSummaryLocal: preferred.meetingSummaryLocal ?? fallback.meetingSummaryLocal,
      restrictionNote: mergeRestrictionNotes(preferred.restrictionNote, fallback.restrictionNote),
    });
  }

  return [...groupedPackages.values()];
}

export async function generateSchedulesFromPostgres(options: {
  courses: string[];
  lockPackages: string[];
  excludePackages: string[];
  limit: number;
  preferenceOrder: PreferenceRuleId[];
  includeWaitlisted: boolean;
  includeClosed: boolean;
}): Promise<unknown[]> {
  if (options.limit === 0 || options.courses.length === 0) {
    return [];
  }

  const coursePlaceholders = options.courses.map(() => "?").join(", ");
  const excludedPackagePlaceholders = options.excludePackages.map(() => "?").join(", ");
  const rows = await allCourseRowsRuntime(
    `
      SELECT
        source_package_id,
        course_designation,
        title,
        section_bundle_label,
        open_seats,
        is_full,
        has_waitlist,
        meeting_count,
        campus_day_count,
        earliest_start_minute_local,
        latest_end_minute_local,
        has_online_meeting,
        has_unknown_location,
        restriction_note,
        has_temporary_restriction,
        meeting_summary_local
      FROM schedule_candidates_v
      WHERE course_designation IN (${coursePlaceholders})
      ${options.excludePackages.length > 0 ? `AND source_package_id NOT IN (${excludedPackagePlaceholders})` : ""}
      ORDER BY course_designation ASC, source_package_id ASC
    `,
    [...options.courses, ...options.excludePackages],
  );
  const candidates = rows.map(mapPostgresScheduleCandidate);
  const meetingRows = candidates.length === 0
    ? []
    : await allCourseRowsRuntime(
        `
          SELECT
            source_package_id,
            meeting_days,
            meeting_time_start,
            meeting_time_end,
            start_date,
            end_date,
            exam_date,
            instruction_mode,
            latitude,
            longitude,
            location_known
          FROM schedule_planning_v
          WHERE source_package_id IN (${candidates.map(() => "?").join(", ")})
            AND meeting_type = 'CLASS'
          ORDER BY source_package_id ASC, meeting_time_start ASC, meeting_time_end ASC
        `,
        candidates.map((candidate) => candidate.source_package_id),
      );
  const candidateMeetingsById = groupPostgresMeetingsByPackage(meetingRows.map(mapPostgresPackageMeeting));
  const candidatesById = new Map(candidates.map((candidate) => [candidate.source_package_id, candidate] as const));
  const transitions = derivePostgresTransitions(
    candidateMeetingsById,
    candidates.map((candidate) => candidate.source_package_id),
  );
  const lockedByCourse = new Map<string, PostgresScheduleCandidate>();

  for (const packageId of options.lockPackages) {
    const candidate = candidatesById.get(packageId);
    if (!candidate) {
      return [];
    }

    const current = lockedByCourse.get(candidate.course_designation);
    if (current && current.source_package_id !== candidate.source_package_id) {
      return [];
    }

    lockedByCourse.set(candidate.course_designation, candidate);
  }

  const groups = options.courses.map((courseDesignation) => {
    const lockedCandidate = lockedByCourse.get(courseDesignation);
    if (lockedCandidate) {
      return [lockedCandidate];
    }

    return candidates.filter((candidate) =>
      candidate.course_designation === courseDesignation &&
      isPostgresCandidateAvailabilityEligible(candidate, options),
    );
  });

  if (groups.some((group) => group.length === 0)) {
    return [];
  }

  const schedules: GeneratedPostgresSchedule[] = [];
  const scheduleIndexByVisibilityKey = new Map<string, number>();
  const selected: PostgresScheduleCandidate[] = [];

  function trimSchedulesToLimit(): void {
    schedules.sort((left, right) => compareGeneratedPostgresSchedules(left, right, options.preferenceOrder));
    if (schedules.length > options.limit) {
      schedules.length = options.limit;
    }

    scheduleIndexByVisibilityKey.clear();
    schedules.forEach((schedule, index) => {
      scheduleIndexByVisibilityKey.set(makeGeneratedPostgresVisibilityKey(schedule.packages), index);
    });
  }

  function visitGroup(groupIndex: number): void {
    if (groupIndex >= groups.length) {
      const schedule = buildGeneratedPostgresSchedule(selected, candidateMeetingsById, transitions);
      const visibilityKey = makeGeneratedPostgresVisibilityKey(schedule.packages);
      const existingIndex = scheduleIndexByVisibilityKey.get(visibilityKey);

      if (existingIndex !== undefined) {
        if (
          compareGeneratedPostgresSchedules(
            schedule,
            schedules[existingIndex],
            options.preferenceOrder,
          ) < 0
        ) {
          schedules[existingIndex] = schedule;
          trimSchedulesToLimit();
        }

        return;
      }

      schedules.push(schedule);
      scheduleIndexByVisibilityKey.set(visibilityKey, schedules.length - 1);
      if (schedules.length > options.limit) {
        trimSchedulesToLimit();
      }

      return;
    }

    for (const candidate of groups[groupIndex]) {
      if (
        selected.some((current) =>
          postgresCandidatesConflict(
            candidateMeetingsById.get(current.source_package_id) ?? [],
            candidateMeetingsById.get(candidate.source_package_id) ?? [],
          ),
        )
      ) {
        continue;
      }

      selected.push(candidate);
      visitGroup(groupIndex + 1);
      selected.pop();
    }
  }

  visitGroup(0);

  trimSchedulesToLimit();
  return schedules.slice(0, options.limit);
}

export async function searchCourses(params: CourseSearchParams = {}): Promise<CourseListItem[]> {
  const db = isSupabaseRuntimeEnabled() ? undefined : getCourseDb();
  const query = params.query?.trim() ?? "";
  const subject = params.subject?.trim() ?? "";
  const limit = clampLimit(params.limit);
  const normalizedSubjectPrefix = subject ? `${escapeLike(subject.toUpperCase())}%` : null;
  const searchContext = buildCourseSearchContext(query);
  let rows: Row[];

  if (searchContext.matchQuery && (await hasCourseSearchTable(db))) {
    const normalizedQueryLike = `${escapeLike(searchContext.normalizedQuery)}%`;
    const compactQueryLike = `${escapeLike(searchContext.compactQuery)}%`;
    const runtimeMatchQuery = isSupabaseRuntimeEnabled()
      ? searchContext.postgresMatchQuery
      : searchContext.matchQuery;

    rows = await allCourseRowsRuntime(
      `
          WITH raw_search_matches AS (
            SELECT
              term_code,
              course_id,
              alias_course_designation_normalized,
              alias_course_designation_compact,
              title_normalized,
              ${isSupabaseRuntimeEnabled() ? "ts_rank(ts, to_tsquery('simple', ?))" : "rank"} AS search_rank
            FROM course_search_fts
            WHERE ${isSupabaseRuntimeEnabled() ? "ts @@ to_tsquery('simple', ?)" : "course_search_fts MATCH ?"}
          ),
          search_matches AS (
            SELECT
              term_code,
              course_id,
              ${isSupabaseRuntimeEnabled() ? "MAX(search_rank)" : "MIN(search_rank)"} AS best_search_rank,
              MAX(CASE WHEN alias_course_designation_normalized = ? THEN 1 ELSE 0 END) AS exact_alias_match,
              MAX(CASE WHEN alias_course_designation_compact = ? THEN 1 ELSE 0 END) AS exact_compact_alias_match,
              MAX(CASE WHEN alias_course_designation_normalized LIKE ? ESCAPE '\\' THEN 1 ELSE 0 END) AS prefix_alias_match,
              MAX(CASE WHEN alias_course_designation_compact LIKE ? ESCAPE '\\' THEN 1 ELSE 0 END) AS prefix_compact_alias_match,
              MAX(CASE WHEN title_normalized = ? THEN 1 ELSE 0 END) AS exact_title_match,
              MAX(CASE WHEN title_normalized LIKE ? ESCAPE '\\' THEN 1 ELSE 0 END) AS prefix_title_match
            FROM raw_search_matches
            GROUP BY term_code, course_id
          ),
          ranked_courses AS (
            SELECT
              co.course_designation,
              co.title,
              co.minimum_credits,
              co.maximum_credits,
              co.cross_list_designations_json,
              co.section_count,
              co.has_any_open_seats,
              co.has_any_waitlist,
              co.has_any_full_section,
              sm.best_search_rank,
              sm.exact_alias_match,
              sm.exact_compact_alias_match,
              sm.prefix_alias_match,
              sm.prefix_compact_alias_match,
              sm.exact_title_match,
              sm.prefix_title_match,
              ROW_NUMBER() OVER (
                PARTITION BY co.course_designation
                ORDER BY
                  sm.exact_alias_match DESC,
                  sm.exact_compact_alias_match DESC,
                  sm.prefix_alias_match DESC,
                  sm.prefix_compact_alias_match DESC,
                  sm.exact_title_match DESC,
                  sm.prefix_title_match DESC,
                  sm.best_search_rank ${isSupabaseRuntimeEnabled() ? "DESC" : "ASC"},
                  COALESCE(co.section_count, 0) DESC,
                  COALESCE(co.has_any_open_seats, 0) DESC,
                  COALESCE(co.has_any_full_section, 0) DESC,
                  co.title ASC,
                  co.course_id ASC
              ) AS designation_rank
            FROM search_matches sm
            JOIN course_overview_v co
              ON co.term_code = sm.term_code AND co.course_id = sm.course_id
            ${normalizedSubjectPrefix ? "WHERE UPPER(co.course_designation) LIKE ? ESCAPE '\\'" : ""}
          )
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
          FROM ranked_courses
          WHERE designation_rank = 1
          ORDER BY
            exact_alias_match DESC,
            exact_compact_alias_match DESC,
            prefix_alias_match DESC,
            prefix_compact_alias_match DESC,
            exact_title_match DESC,
            prefix_title_match DESC,
            best_search_rank ${isSupabaseRuntimeEnabled() ? "DESC" : "ASC"},
            COALESCE(has_any_open_seats, 0) DESC,
            COALESCE(section_count, 0) DESC,
            course_designation ASC
          LIMIT ?
        `,
      [
        ...(isSupabaseRuntimeEnabled() ? [runtimeMatchQuery] : []),
        runtimeMatchQuery,
        searchContext.normalizedQuery,
        searchContext.compactQuery,
        normalizedQueryLike,
        compactQueryLike,
        searchContext.normalizedQuery,
        normalizedQueryLike,
        ...(normalizedSubjectPrefix ? [normalizedSubjectPrefix] : []),
        limit,
      ],
    );
  } else if (searchContext.matchQuery) {
    const normalizedQueryLike = `${escapeLike(searchContext.normalizedQuery)}%`;
    const compactQueryLike = `${escapeLike(searchContext.compactQuery)}%`;
    const queryTokens = searchContext.normalizedQuery.split(" ").filter((token) => token.length > 0);
    const tokenMatchClauses = queryTokens
      .map(
        () => `
              (
                EXISTS (
                  SELECT 1
                  FROM course_cross_listing_overview_v ccl_match
                  WHERE ccl_match.term_code = co.term_code
                    AND ccl_match.course_id = co.course_id
                    AND (
                      LOWER(ccl_match.alias_course_designation) LIKE ? ESCAPE '\\'
                      OR REPLACE(LOWER(ccl_match.alias_course_designation), ' ', '') LIKE ? ESCAPE '\\'
                    )
                )
                OR LOWER(co.title) LIKE ? ESCAPE '\\'
                OR LOWER(c.description) LIKE ? ESCAPE '\\'
              )
            `,
      )
      .join(" AND ");
    const tokenMatchParams = queryTokens.flatMap((token) => {
      const tokenLike = `%${escapeLike(token)}%`;
      return [tokenLike, tokenLike, tokenLike, tokenLike];
    });

    rows = await allCourseRowsRuntime(
      `
          WITH matched_courses AS (
            SELECT
              co.term_code,
              co.course_id,
              MAX(CASE WHEN LOWER(ccl.alias_course_designation) = ? THEN 1 ELSE 0 END) AS exact_alias_match,
              MAX(CASE WHEN LOWER(ccl.alias_course_designation) LIKE ? ESCAPE '\\' THEN 1 ELSE 0 END) AS prefix_alias_match,
              MAX(CASE WHEN REPLACE(LOWER(ccl.alias_course_designation), ' ', '') LIKE REPLACE(?, ' ', '') ESCAPE '\\' THEN 1 ELSE 0 END) AS compact_alias_match,
              MAX(CASE WHEN LOWER(co.title) = ? THEN 1 ELSE 0 END) AS exact_title_match,
              MAX(CASE WHEN LOWER(co.title) LIKE ? ESCAPE '\\' THEN 1 ELSE 0 END) AS prefix_title_match
            FROM course_overview_v co
            JOIN courses c
              ON c.term_code = co.term_code AND c.course_id = co.course_id
            JOIN course_cross_listing_overview_v ccl
              ON ccl.term_code = co.term_code AND ccl.course_id = co.course_id
            WHERE ${tokenMatchClauses}
            GROUP BY co.term_code, co.course_id
          ),
          combined_matches AS (
            SELECT
              co.course_designation,
              co.title,
              co.minimum_credits,
              co.maximum_credits,
              co.cross_list_designations_json,
              co.section_count,
              co.has_any_open_seats,
              co.has_any_waitlist,
              co.has_any_full_section,
              mc.exact_alias_match,
              mc.prefix_alias_match,
              mc.compact_alias_match,
              mc.exact_title_match,
              mc.prefix_title_match,
              ROW_NUMBER() OVER (
                PARTITION BY co.course_designation
                ORDER BY
                  mc.exact_alias_match DESC,
                  mc.compact_alias_match DESC,
                  mc.prefix_alias_match DESC,
                  mc.exact_title_match DESC,
                  mc.prefix_title_match DESC,
                  COALESCE(co.section_count, 0) DESC,
                  COALESCE(co.has_any_open_seats, 0) DESC,
                  COALESCE(co.has_any_full_section, 0) DESC,
                  co.title ASC,
                  co.course_id ASC
              ) AS designation_rank
            FROM course_overview_v co
            JOIN matched_courses mc
              ON mc.term_code = co.term_code AND mc.course_id = co.course_id
            ${normalizedSubjectPrefix ? "WHERE UPPER(co.course_designation) LIKE ? ESCAPE '\\'" : ""}
          )
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
          FROM combined_matches
          WHERE designation_rank = 1
          ORDER BY
            exact_alias_match DESC,
            compact_alias_match DESC,
            prefix_alias_match DESC,
            exact_title_match DESC,
            prefix_title_match DESC,
            COALESCE(has_any_open_seats, 0) DESC,
            COALESCE(section_count, 0) DESC,
            course_designation ASC
          LIMIT ?
        `,
      [
        searchContext.normalizedQuery,
        normalizedQueryLike,
        compactQueryLike,
        searchContext.normalizedQuery,
        normalizedQueryLike,
        ...tokenMatchParams,
        ...(normalizedSubjectPrefix ? [normalizedSubjectPrefix] : []),
        limit,
      ],
    );
  } else {
    if (query && !subject) {
      return [];
    }

    rows = await allCourseRowsRuntime(
      `
          WITH ranked_courses AS (
            SELECT
              course_designation,
              title,
              minimum_credits,
              maximum_credits,
              cross_list_designations_json,
              section_count,
              has_any_open_seats,
              has_any_waitlist,
              has_any_full_section,
              ROW_NUMBER() OVER (
                PARTITION BY course_designation
                ORDER BY
                  COALESCE(section_count, 0) DESC,
                  COALESCE(has_any_open_seats, 0) DESC,
                  COALESCE(has_any_full_section, 0) DESC,
                  title ASC,
                  course_id ASC
              ) AS designation_rank
            FROM course_overview_v
            ${normalizedSubjectPrefix ? "WHERE UPPER(course_designation) LIKE ? ESCAPE '\\'" : ""}
          )
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
          FROM ranked_courses
          WHERE designation_rank = 1
          ORDER BY COALESCE(has_any_open_seats, 0) DESC, COALESCE(section_count, 0) DESC, course_designation ASC
          LIMIT ?
        `,
      [...(normalizedSubjectPrefix ? [normalizedSubjectPrefix] : []), limit],
    );
  }

  return rows.map(mapCourseListItem);
}

export async function getCourseDetail(designation: string): Promise<CourseDetail | null> {
  if (isSupabaseRuntimeEnabled()) {
    return getCourseDetailRuntime(designation);
  }

  const db = await getCourseSqliteDb();
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
          source_package_id,
          section_number,
          section_type,
          instruction_mode,
          session_code,
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

  const packageSectionMembershipRows = db
    .prepare(
      `
        SELECT DISTINCT package_id, section_class_number
        FROM sections
        WHERE term_code = ? AND course_id = ?
        ORDER BY package_id, section_class_number
      `,
    )
    .all(canonical.termCode, canonical.courseId) as Row[];

  const instructorGrades = await getInstructorHistory(db, canonical.termCode, canonical.courseId);
  const courseTitleLookup = buildCourseTitleLookup(
    db,
    canonical.termCode,
    [
      ...sections.map((row) => asString(row.source_package_id)),
      ...schedulePackages.map((row) => asString(row.source_package_id)),
    ],
  );
  return buildCourseDetailResult({
    courseRow,
    prerequisiteRow,
    prerequisiteRows,
    sections,
    meetings,
    schedulePackages,
    packageSectionMembershipRows,
    instructorGrades,
    courseTitleLookup,
  });
}

async function getCourseDetailRuntime(designation: string): Promise<CourseDetail | null> {
  let normalizedDesignation: string;

  try {
    normalizedDesignation = normalizeDesignation(decodeURIComponent(designation));
  } catch {
    return null;
  }

  const canonical = await resolveCanonicalCourseRuntime(normalizedDesignation);

  if (!canonical) {
    return null;
  }

  const courseRow = await firstCourseRowRuntime(
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
    [canonical.termCode, canonical.courseId],
  );

  if (!courseRow) {
    return null;
  }

  const prerequisiteRow = await firstCourseRowRuntime(
    `
      SELECT summary_status, course_groups_json, escape_clauses_json, raw_text, unparsed_text
      FROM prerequisite_course_summary_overview_v
      WHERE term_code = ? AND course_id = ?
      ORDER BY rule_id ASC
      LIMIT 1
    `,
    [canonical.termCode, canonical.courseId],
  );

  const prerequisiteRows = await allCourseRowsRuntime(
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
    [canonical.termCode, canonical.courseId],
  );

  const sections = await allCourseRowsRuntime(
    `
      SELECT
        section_class_number,
        source_package_id,
        section_number,
        section_type,
        instruction_mode,
        session_code,
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
    [canonical.termCode, canonical.courseId],
  );

  const meetings = await allCourseRowsRuntime(
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
    [canonical.termCode, canonical.courseId],
  );

  const schedulePackages = await allCourseRowsRuntime(
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
    [canonical.termCode, canonical.courseId],
  );

  const packageSectionMembershipRows = await allCourseRowsRuntime(
    `
      SELECT DISTINCT package_id, section_class_number
      FROM sections
      WHERE term_code = ? AND course_id = ?
      ORDER BY package_id, section_class_number
    `,
    [canonical.termCode, canonical.courseId],
  );

  const instructorGrades = await getInstructorHistory(undefined, canonical.termCode, canonical.courseId);
  const courseTitleLookup = await buildCourseTitleLookupRuntime(canonical.termCode, [
    ...sections.map((row) => asString(row.source_package_id)),
    ...schedulePackages.map((row) => asString(row.source_package_id)),
  ]);

  return buildCourseDetailResult({
    courseRow,
    prerequisiteRow,
    prerequisiteRows,
    sections,
    meetings,
    schedulePackages,
    packageSectionMembershipRows,
    instructorGrades,
    courseTitleLookup,
  });
}

async function getInstructorHistory(
  db: Database.Database | undefined,
  termCode: string,
  courseId: string,
): Promise<InstructorHistoryItem[]> {
  if (isSupabaseRuntimeEnabled()) {
    return getInstructorHistoryRuntime(termCode, courseId);
  }

  if (!db) {
    throw new Error("SQLite database is required when Supabase runtime is disabled");
  }

  if (!hasCompleteMadgradesConfig()) {
    return getInstructorHistoryFromCompatibilityDb(db, termCode, courseId);
  }

  const currentSectionInstructorRows = db
    .prepare(
      `
        SELECT
          so.section_number,
          so.section_type,
          si.instructor_key,
          TRIM(COALESCE(i.first_name || ' ', '') || COALESCE(i.last_name, '')) AS instructor_display_name
        FROM section_overview_v so
        JOIN section_instructors si
          ON si.package_id = so.source_package_id
         AND si.section_class_number = so.section_class_number
        JOIN instructors i
          ON i.instructor_key = si.instructor_key
        WHERE so.term_code = ? AND so.course_id = ?
        ORDER BY so.section_type ASC, so.section_number ASC, instructor_display_name ASC, si.instructor_key ASC
      `,
    )
    .all(termCode, courseId) as Row[];

  if (currentSectionInstructorRows.length === 0) {
    return [];
  }

  const instructorKeys = [...new Set(currentSectionInstructorRows.map((row) => asString(row.instructor_key)))];

  if (instructorKeys.length === 0) {
    return [];
  }

  const emptyRows = mapCurrentInstructorRows(currentSectionInstructorRows);
  const madgradesDb = getMadgradesDb();

  try {
    const courseMatchRow = await firstRow(
      madgradesDb,
      `
        SELECT madgrades_course_id
        FROM madgrades_course_matches
        WHERE term_code = ? AND course_id = ?
        LIMIT 1
      `,
      [termCode, courseId],
    );
    const madgradesCourseId = asNullableNumeric(courseMatchRow?.madgrades_course_id);

    const gradeByInstructorKey = new Map<string, Row>();

    if (madgradesCourseId !== null) {
      const placeholders = instructorKeys.map(() => "?").join(", ");
      const gradeRows = await allRows(
        madgradesDb,
        `
          WITH course_history AS (
            SELECT
              mco.madgrades_course_id,
              mco.madgrades_instructor_id,
              COUNT(*) AS prior_offering_count,
              COALESCE(SUM(mco.student_count), 0) AS student_count,
              CASE
                WHEN COALESCE(SUM(mco.student_count), 0) = 0 THEN NULL
                ELSE SUM(mco.avg_gpa * mco.student_count) / SUM(mco.student_count)
              END AS same_course_gpa
            FROM madgrades_course_offerings mco
            WHERE mco.madgrades_course_id = ?
            GROUP BY mco.madgrades_course_id, mco.madgrades_instructor_id
          ),
          latest_course_grades AS (
            SELECT
              mcg.*,
              ROW_NUMBER() OVER (
                PARTITION BY mcg.madgrades_course_id, mcg.term_code
                ORDER BY mcg.madgrades_refresh_run_id DESC, mcg.madgrades_course_grade_id DESC
              ) AS refresh_rank
            FROM madgrades_course_grades mcg
            WHERE mcg.madgrades_course_id = ?
          ),
          course_gpa AS (
            SELECT
              lcg.madgrades_course_id,
              CASE
                WHEN COALESCE(SUM(lcg.student_count), 0) = 0 THEN NULL
                ELSE SUM(lcg.avg_gpa * lcg.student_count) / SUM(lcg.student_count)
              END AS historical_gpa
            FROM latest_course_grades lcg
            WHERE lcg.refresh_rank = 1
            GROUP BY lcg.madgrades_course_id
          )
          SELECT
            mim.instructor_key,
            mim.match_status AS instructor_match_status,
            ch.prior_offering_count AS same_course_prior_offering_count,
            ch.student_count AS same_course_student_count,
            ch.same_course_gpa,
            cg.historical_gpa AS course_historical_gpa
          FROM madgrades_instructor_matches mim
          LEFT JOIN course_history ch
            ON ch.madgrades_instructor_id = mim.madgrades_instructor_id
          LEFT JOIN course_gpa cg
            ON cg.madgrades_course_id = ?
          WHERE mim.instructor_key IN (${placeholders})
        `,
        [madgradesCourseId, madgradesCourseId, madgradesCourseId, ...instructorKeys],
      );

      for (const row of gradeRows) {
        gradeByInstructorKey.set(asString(row.instructor_key), row);
      }
    }

    return currentSectionInstructorRows
      .map((row) => {
        const gradeRow = gradeByInstructorKey.get(asString(row.instructor_key));

        return {
          sectionNumber: asString(row.section_number),
          sectionType: asString(row.section_type),
          instructorDisplayName: asNullableString(row.instructor_display_name),
          sameCoursePriorOfferingCount: asNullableNumeric(gradeRow?.same_course_prior_offering_count),
          sameCourseStudentCount: asNullableNumeric(gradeRow?.same_course_student_count),
          sameCourseGpa: asNullableNumeric(gradeRow?.same_course_gpa),
          courseHistoricalGpa: asNullableNumeric(gradeRow?.course_historical_gpa),
          instructorMatchStatus: asNullableString(gradeRow?.instructor_match_status),
        };
      })
      .sort((left, right) => {
        const priorOfferingDiff =
          (right.sameCoursePriorOfferingCount ?? -1) - (left.sameCoursePriorOfferingCount ?? -1);

        if (priorOfferingDiff !== 0) {
          return priorOfferingDiff;
        }

        const studentCountDiff = (right.sameCourseStudentCount ?? -1) - (left.sameCourseStudentCount ?? -1);

        if (studentCountDiff !== 0) {
          return studentCountDiff;
        }

        const sectionTypeDiff = left.sectionType.localeCompare(right.sectionType);
        if (sectionTypeDiff !== 0) {
          return sectionTypeDiff;
        }

        return left.sectionNumber.localeCompare(right.sectionNumber);
      });
  } catch {
    return emptyRows;
  }
}

async function getInstructorHistoryRuntime(
  termCode: string,
  courseId: string,
): Promise<InstructorHistoryItem[]> {
  const currentSectionInstructorRows = await allCourseRowsRuntime(
    `
      SELECT
        so.section_number,
        so.section_type,
        si.instructor_key,
        TRIM(COALESCE(i.first_name || ' ', '') || COALESCE(i.last_name, '')) AS instructor_display_name
      FROM section_overview_v so
      JOIN section_instructors si
        ON si.package_id = so.source_package_id
       AND si.section_class_number = so.section_class_number
      JOIN instructors i
        ON i.instructor_key = si.instructor_key
      WHERE so.term_code = ? AND so.course_id = ?
      ORDER BY so.section_type ASC, so.section_number ASC, instructor_display_name ASC, si.instructor_key ASC
    `,
    [termCode, courseId],
  );

  if (currentSectionInstructorRows.length === 0) {
    return [];
  }

  const instructorKeys = [...new Set(currentSectionInstructorRows.map((row) => asString(row.instructor_key)))];

  if (instructorKeys.length === 0) {
    return [];
  }

  const emptyRows = mapCurrentInstructorRows(currentSectionInstructorRows);

  try {
    const courseMatchRow = await firstMadgradesRowRuntime(
      `
        SELECT madgrades_course_id
        FROM madgrades.madgrades_course_matches
        WHERE term_code = ? AND course_id = ?
        LIMIT 1
      `,
      [termCode, courseId],
    );
    const madgradesCourseId = asNullableNumeric(courseMatchRow?.madgrades_course_id);

    const gradeByInstructorKey = new Map<string, Row>();

    if (madgradesCourseId !== null) {
      const placeholders = instructorKeys.map(() => "?").join(", ");
      const gradeRows = await allMadgradesRowsRuntime(
        `
          WITH course_history AS (
            SELECT
              mco.madgrades_course_id,
              mco.madgrades_instructor_id,
              COUNT(*) AS prior_offering_count,
              COALESCE(SUM(mco.student_count), 0) AS student_count,
              CASE
                WHEN COALESCE(SUM(mco.student_count), 0) = 0 THEN NULL
                ELSE SUM(mco.avg_gpa * mco.student_count) / SUM(mco.student_count)
              END AS same_course_gpa
            FROM madgrades.madgrades_course_offerings mco
            WHERE mco.madgrades_course_id = ?
            GROUP BY mco.madgrades_course_id, mco.madgrades_instructor_id
          ),
          latest_course_grades AS (
            SELECT
              mcg.*,
              ROW_NUMBER() OVER (
                PARTITION BY mcg.madgrades_course_id, mcg.term_code
                ORDER BY mcg.madgrades_refresh_run_id DESC, mcg.madgrades_course_grade_id DESC
              ) AS refresh_rank
            FROM madgrades.madgrades_course_grades mcg
            WHERE mcg.madgrades_course_id = ?
          ),
          course_gpa AS (
            SELECT
              lcg.madgrades_course_id,
              CASE
                WHEN COALESCE(SUM(lcg.student_count), 0) = 0 THEN NULL
                ELSE SUM(lcg.avg_gpa * lcg.student_count) / SUM(lcg.student_count)
              END AS historical_gpa
            FROM latest_course_grades lcg
            WHERE lcg.refresh_rank = 1
            GROUP BY lcg.madgrades_course_id
          )
          SELECT
            mim.instructor_key,
            mim.match_status AS instructor_match_status,
            ch.prior_offering_count AS same_course_prior_offering_count,
            ch.student_count AS same_course_student_count,
            ch.same_course_gpa,
            cg.historical_gpa AS course_historical_gpa
          FROM madgrades.madgrades_instructor_matches mim
          LEFT JOIN course_history ch
            ON ch.madgrades_instructor_id = mim.madgrades_instructor_id
          LEFT JOIN course_gpa cg
            ON cg.madgrades_course_id = ?
          WHERE mim.instructor_key IN (${placeholders})
        `,
        [madgradesCourseId, madgradesCourseId, madgradesCourseId, ...instructorKeys],
      );

      for (const row of gradeRows) {
        gradeByInstructorKey.set(asString(row.instructor_key), row);
      }
    }

    return currentSectionInstructorRows
      .map((row) => {
        const gradeRow = gradeByInstructorKey.get(asString(row.instructor_key));

        return {
          sectionNumber: asString(row.section_number),
          sectionType: asString(row.section_type),
          instructorDisplayName: asNullableString(row.instructor_display_name),
          sameCoursePriorOfferingCount: asNullableNumeric(gradeRow?.same_course_prior_offering_count),
          sameCourseStudentCount: asNullableNumeric(gradeRow?.same_course_student_count),
          sameCourseGpa: asNullableNumeric(gradeRow?.same_course_gpa),
          courseHistoricalGpa: asNullableNumeric(gradeRow?.course_historical_gpa),
          instructorMatchStatus: asNullableString(gradeRow?.instructor_match_status),
        };
      })
      .sort((left, right) => {
        const priorOfferingDiff =
          (right.sameCoursePriorOfferingCount ?? -1) - (left.sameCoursePriorOfferingCount ?? -1);

        if (priorOfferingDiff !== 0) {
          return priorOfferingDiff;
        }

        const studentCountDiff = (right.sameCourseStudentCount ?? -1) - (left.sameCourseStudentCount ?? -1);

        if (studentCountDiff !== 0) {
          return studentCountDiff;
        }

        const sectionTypeDiff = left.sectionType.localeCompare(right.sectionType);
        if (sectionTypeDiff !== 0) {
          return sectionTypeDiff;
        }

        return left.sectionNumber.localeCompare(right.sectionNumber);
      });
  } catch {
    return emptyRows;
  }
}

function getInstructorHistoryFromCompatibilityDb(
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

function mapCurrentInstructorRows(rows: Row[]): InstructorHistoryItem[] {
  return rows
    .map((row) => ({
      sectionNumber: asString(row.section_number),
      sectionType: asString(row.section_type),
      instructorDisplayName: asNullableString(row.instructor_display_name),
      sameCoursePriorOfferingCount: null,
      sameCourseStudentCount: null,
      sameCourseGpa: null,
      courseHistoricalGpa: null,
      instructorMatchStatus: null,
    }))
    .sort((left, right) => {
      const sectionTypeDiff = left.sectionType.localeCompare(right.sectionType);
      if (sectionTypeDiff !== 0) {
        return sectionTypeDiff;
      }

      return left.sectionNumber.localeCompare(right.sectionNumber);
    });
}

function supportsInstructorHistoryView(db: Database.Database): boolean {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'view' AND name = 'current_term_section_instructor_grade_overview_v'",
    )
    .get() as { name?: string } | undefined;

  return row?.name === "current_term_section_instructor_grade_overview_v";
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

async function hasCourseSearchTable(db: Client | undefined): Promise<boolean> {
  if (hasCourseSearchFtsTable !== null) {
    return hasCourseSearchFtsTable;
  }

  const row = isSupabaseRuntimeEnabled()
    ? await firstCourseRowRuntime("SELECT to_regclass('public.course_search_fts')::text AS name")
    : await firstRow(db!, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'course_search_fts'");

  hasCourseSearchFtsTable = row?.name === "course_search_fts" || row?.name === "public.course_search_fts";
  return hasCourseSearchFtsTable;
}

async function resolveCanonicalCourseRuntime(
  designation: string,
): Promise<{ termCode: string; courseId: string } | null> {
  const canonical = await firstCourseRowRuntime(
    `
      SELECT term_code, course_id
      FROM course_overview_v
      WHERE course_designation = ?
      ORDER BY
        COALESCE(section_count, 0) DESC,
        COALESCE(has_any_open_seats, 0) DESC,
        COALESCE(has_any_full_section, 0) DESC,
        title ASC,
        course_id ASC
      LIMIT 1
    `,
    [designation],
  );

  if (canonical) {
    return {
      termCode: asString(canonical.term_code),
      courseId: asString(canonical.course_id),
    };
  }

  const alias = await firstCourseRowRuntime(
    `
      SELECT term_code, course_id
      FROM course_cross_listing_overview_v
      WHERE alias_course_designation = ?
      ORDER BY is_primary DESC, canonical_course_designation ASC
      LIMIT 1
    `,
    [designation],
  );

  if (!alias) {
    return null;
  }

  return {
    termCode: asString(alias.term_code),
    courseId: asString(alias.course_id),
  };
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
        ORDER BY
          COALESCE(section_count, 0) DESC,
          COALESCE(has_any_open_seats, 0) DESC,
          COALESCE(has_any_full_section, 0) DESC,
          title ASC,
          course_id ASC
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

function buildCourseSearchContext(query: string): {
  normalizedQuery: string;
  compactQuery: string;
  matchQuery: string | null;
  postgresMatchQuery: string | null;
} {
  const normalizedQuery = normalizeSearchText(query);
  const compactQuery = makeCompactCourseDesignation(query);

  if (!normalizedQuery) {
    return {
      normalizedQuery,
      compactQuery,
      matchQuery: null,
      postgresMatchQuery: null,
    };
  }

  return {
    normalizedQuery,
    compactQuery,
    matchQuery: normalizedQuery
      .split(" ")
      .filter((token) => token.length > 0)
      .map((token) => `${token}*`)
      .join(" "),
    postgresMatchQuery: buildPostgresTsquery(normalizedQuery),
  };
}

function normalizeSearchText(value: string): string {
  return tokenizeSearchText(value).join(" ");
}

function tokenizeSearchText(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function makeCompactCourseDesignation(value: string): string {
  const tokens = tokenizeSearchText(value);

  if (tokens.length === 0) {
    return "";
  }

  const numericTokenIndex = tokens.findIndex((token) => /\d/.test(token));
  if (numericTokenIndex <= 0) {
    return tokens.join(" ");
  }

  return [tokens.slice(0, numericTokenIndex).join(""), ...tokens.slice(numericTokenIndex)].join(" ");
}

function mapPostgresScheduleCandidate(row: Row): PostgresScheduleCandidate {
  return {
    source_package_id: asString(row.source_package_id),
    course_designation: asString(row.course_designation),
    title: asString(row.title),
    section_bundle_label: asString(row.section_bundle_label),
    open_seats: asNullableNumber(row.open_seats),
    is_full: asNullableNumber(row.is_full),
    has_waitlist: asNullableNumber(row.has_waitlist),
    meeting_count: asNullableNumber(row.meeting_count),
    campus_day_count: asNullableNumber(row.campus_day_count),
    earliest_start_minute_local: asNullableNumber(row.earliest_start_minute_local),
    latest_end_minute_local: asNullableNumber(row.latest_end_minute_local),
    has_online_meeting: asNullableNumber(row.has_online_meeting),
    has_unknown_location: asNullableNumber(row.has_unknown_location),
    restriction_note: asNullableString(row.restriction_note),
    has_temporary_restriction: asNullableNumber(row.has_temporary_restriction),
    meeting_summary_local: asNullableString(row.meeting_summary_local),
  };
}

function mapPostgresPackageMeeting(row: Row): PostgresPackageMeeting {
  const meetingTimeStart = asNullableNumber(row.meeting_time_start);
  const meetingTimeEnd = asNullableNumber(row.meeting_time_end);

  return {
    source_package_id: asString(row.source_package_id),
    meeting_days: asNullableString(row.meeting_days),
    meeting_time_start: meetingTimeStart,
    meeting_time_end: meetingTimeEnd,
    start_date: asNullableNumeric(row.start_date),
    end_date: asNullableNumeric(row.end_date),
    exam_date: asNullableNumeric(row.exam_date),
    instruction_mode: asNullableString(row.instruction_mode),
    latitude: asNullableNumber(row.latitude),
    longitude: asNullableNumber(row.longitude),
    location_known: asNullableBoolean(row.location_known) ?? false,
    start_minute_local: normalizeMeetingTimeToMinutes(meetingTimeStart),
    end_minute_local: normalizeMeetingTimeToMinutes(meetingTimeEnd),
  };
}

function groupPostgresMeetingsByPackage(
  meetings: PostgresPackageMeeting[],
): Map<string, PostgresPackageMeeting[]> {
  const grouped = new Map<string, PostgresPackageMeeting[]>();

  for (const meeting of meetings) {
    const packageMeetings = grouped.get(meeting.source_package_id) ?? [];
    packageMeetings.push(meeting);
    grouped.set(meeting.source_package_id, packageMeetings);
  }

  return grouped;
}

function buildGeneratedPostgresSchedule(
  candidates: PostgresScheduleCandidate[],
  candidateMeetingsById: Map<string, PostgresPackageMeeting[]>,
  transitions: Map<string, PostgresTransition>,
): GeneratedPostgresSchedule {
  let earliestStartMinuteLocal: number | null = null;
  let latestEndMinuteLocal: number | null = null;
  let totalOpenSeats = 0;
  let tightTransitionCount = 0;
  let totalWalkingDistanceMeters = 0;

  for (const candidate of candidates) {
    totalOpenSeats += candidate.open_seats ?? 0;
    earliestStartMinuteLocal = minNullableNumber(
      earliestStartMinuteLocal,
      candidate.earliest_start_minute_local,
    );
    latestEndMinuteLocal = maxNullableNumber(
      latestEndMinuteLocal,
      candidate.latest_end_minute_local,
    );
  }

  for (const fromCandidate of candidates) {
    for (const toCandidate of candidates) {
      if (fromCandidate.source_package_id === toCandidate.source_package_id) {
        continue;
      }

      const transition = transitions.get(`${fromCandidate.source_package_id}:${toCandidate.source_package_id}`);
      if (!transition) {
        continue;
      }

      tightTransitionCount += transition.is_tight_transition;
      totalWalkingDistanceMeters += transition.walking_distance_meters ?? 0;
    }
  }

  const uniqueCampusDayCount = countUniqueCampusMeetingDays(candidates, candidateMeetingsById);
  const sortedCandidates = [...candidates].sort((left, right) =>
    left.source_package_id.localeCompare(right.source_package_id),
  );

  return {
    package_ids: sortedCandidates.map((candidate) => candidate.source_package_id),
    packages: sortedCandidates,
    conflict_count: 0,
    campus_day_count: uniqueCampusDayCount,
    earliest_start_minute_local: earliestStartMinuteLocal,
    large_idle_gap_count: countLargeIdleGapsFromCandidates(candidates, candidateMeetingsById),
    tight_transition_count: tightTransitionCount,
    total_walking_distance_meters: totalWalkingDistanceMeters,
    total_open_seats: totalOpenSeats,
    latest_end_minute_local: latestEndMinuteLocal,
  };
}

function postgresCandidatesConflict(
  leftMeetings: PostgresPackageMeeting[],
  rightMeetings: PostgresPackageMeeting[],
): boolean {
  for (const left of leftMeetings) {
    const leftDays = expandMeetingDays(left.meeting_days);

      if (leftDays.length === 0 || left.start_minute_local === null || left.end_minute_local === null) {
        continue;
      }

    for (const right of rightMeetings) {
      const rightDays = expandMeetingDays(right.meeting_days);

      if (rightDays.length === 0 || right.start_minute_local === null || right.end_minute_local === null) {
        continue;
      }

      if (!leftDays.some((day) => rightDays.includes(day))) {
        continue;
      }

      if (!postgresMeetingsShareDateRange(left, right)) {
        continue;
      }

      if (left.start_minute_local < right.end_minute_local && right.start_minute_local < left.end_minute_local) {
        return true;
      }
    }
  }

  return false;
}

function countUniqueCampusMeetingDays(
  candidates: PostgresScheduleCandidate[],
  candidateMeetingsById: Map<string, PostgresPackageMeeting[]>,
): number {
  const days = new Set<string>();

  for (const candidate of candidates) {
    for (const meeting of candidateMeetingsById.get(candidate.source_package_id) ?? []) {
      if (isPostgresMeetingOnline(meeting)) {
        continue;
      }

      for (const day of expandMeetingDays(meeting.meeting_days)) {
        days.add(day);
      }
    }
  }

  return days.size;
}

function countLargeIdleGapsFromCandidates(
  candidates: PostgresScheduleCandidate[],
  candidateMeetingsById: Map<string, PostgresPackageMeeting[]>,
): number {
  const meetingsByDay = new Map<string, PostgresPackageMeeting[]>();

  for (const candidate of candidates) {
    for (const meeting of candidateMeetingsById.get(candidate.source_package_id) ?? []) {
      if (meeting.start_minute_local === null || meeting.end_minute_local === null) {
        continue;
      }

      for (const day of expandMeetingDays(meeting.meeting_days)) {
        const dayMeetings = meetingsByDay.get(day) ?? [];
        dayMeetings.push(meeting);
        meetingsByDay.set(day, dayMeetings);
      }
    }
  }

  let gapCount = 0;

  for (const dayMeetings of meetingsByDay.values()) {
    dayMeetings.sort(
      (left, right) =>
        (left.start_minute_local ?? Number.POSITIVE_INFINITY) - (right.start_minute_local ?? Number.POSITIVE_INFINITY) ||
        (left.end_minute_local ?? Number.POSITIVE_INFINITY) - (right.end_minute_local ?? Number.POSITIVE_INFINITY),
    );

    for (let index = 1; index < dayMeetings.length; index += 1) {
      if (!postgresMeetingsShareDateRange(dayMeetings[index], dayMeetings[index - 1])) {
        continue;
      }

      if ((dayMeetings[index].start_minute_local ?? 0) - (dayMeetings[index - 1].end_minute_local ?? 0) >= 90) {
        gapCount += 1;
      }
    }
  }

  return gapCount;
}

function derivePostgresTransitions(
  candidateMeetingsById: Map<string, PostgresPackageMeeting[]>,
  packageIds: string[],
): Map<string, PostgresTransition> {
  const meetingsByDay = new Map<string, PostgresPackageMeeting[]>();

  for (const packageId of packageIds) {
    for (const meeting of candidateMeetingsById.get(packageId) ?? []) {
      if (
        isPostgresMeetingOnline(meeting) ||
        !meeting.location_known ||
        meeting.start_minute_local === null ||
        meeting.end_minute_local === null
      ) {
        continue;
      }

      for (const day of expandMeetingDays(meeting.meeting_days)) {
        const dayMeetings = meetingsByDay.get(day) ?? [];
        dayMeetings.push(meeting);
        meetingsByDay.set(day, dayMeetings);
      }
    }
  }

  const transitions = new Map<string, PostgresTransition>();

  for (const dayMeetings of meetingsByDay.values()) {
    dayMeetings.sort(
      (left, right) =>
        (left.start_minute_local ?? Number.POSITIVE_INFINITY) -
          (right.start_minute_local ?? Number.POSITIVE_INFINITY) ||
        (left.end_minute_local ?? Number.POSITIVE_INFINITY) -
          (right.end_minute_local ?? Number.POSITIVE_INFINITY) ||
        left.source_package_id.localeCompare(right.source_package_id),
    );

    let windowStart = 0;

    for (let index = 0; index < dayMeetings.length; index += 1) {
      const current = dayMeetings[index];

      while (
        windowStart < index &&
        (dayMeetings[windowStart].end_minute_local ?? Number.NEGATIVE_INFINITY) <
          (current.start_minute_local ?? Number.POSITIVE_INFINITY) - 45
      ) {
        windowStart += 1;
      }

      for (let previousIndex = windowStart; previousIndex < index; previousIndex += 1) {
        const previous = dayMeetings[previousIndex];
        if (previous.source_package_id === current.source_package_id) {
          continue;
        }
        if (!postgresMeetingsShareDateRange(previous, current)) {
          continue;
        }
        if ((previous.end_minute_local ?? Number.POSITIVE_INFINITY) > (current.start_minute_local ?? 0)) {
          continue;
        }

        const gapMinutes = (current.start_minute_local ?? 0) - (previous.end_minute_local ?? 0);
        if (gapMinutes < 0 || gapMinutes > 45) {
          continue;
        }

        const walkingDistanceMeters = haversineMeters(previous, current);
        const key = `${previous.source_package_id}:${current.source_package_id}`;
        const existing = transitions.get(key);
        const existingDistance = existing?.walking_distance_meters ?? Number.MAX_SAFE_INTEGER;
        const nextDistance = walkingDistanceMeters ?? Number.MAX_SAFE_INTEGER;

        if (
          !existing ||
          gapMinutes < existing.gap_minutes ||
          (gapMinutes === existing.gap_minutes && nextDistance < existingDistance)
        ) {
          transitions.set(key, {
            gap_minutes: gapMinutes,
            walking_distance_meters: walkingDistanceMeters,
            is_tight_transition: Number(
              gapMinutes < 10 || (gapMinutes < 15 && (walkingDistanceMeters ?? 0) > 200),
            ),
          });
        }
      }
    }
  }

  return transitions;
}

function compareGeneratedPostgresSchedules(
  left: GeneratedPostgresSchedule,
  right: GeneratedPostgresSchedule,
  preferenceOrder: PreferenceRuleId[],
): number {
  for (const ruleId of preferenceOrder) {
    const comparison = compareGeneratedPostgresSchedulesByPreference(left, right, ruleId);
    if (comparison !== 0) {
      return comparison;
    }
  }

  return (
    left.tight_transition_count - right.tight_transition_count ||
    left.total_walking_distance_meters - right.total_walking_distance_meters ||
    right.total_open_seats - left.total_open_seats ||
    left.package_ids.join("\u0000").localeCompare(right.package_ids.join("\u0000"))
  );
}

function compareGeneratedPostgresSchedulesByPreference(
  left: GeneratedPostgresSchedule,
  right: GeneratedPostgresSchedule,
  preference: PreferenceRuleId,
): number {
  switch (preference) {
    case "later-starts":
      return compareNullableDescending(
        left.earliest_start_minute_local,
        right.earliest_start_minute_local,
        Number.POSITIVE_INFINITY,
      );
    case "fewer-campus-days":
      return (left.campus_day_count ?? Number.POSITIVE_INFINITY) - (right.campus_day_count ?? Number.POSITIVE_INFINITY);
    case "fewer-long-gaps":
      return left.large_idle_gap_count - right.large_idle_gap_count;
    case "earlier-finishes":
      return compareNullableAscending(
        left.latest_end_minute_local,
        right.latest_end_minute_local,
        Number.NEGATIVE_INFINITY,
      );
  }
}

function expandMeetingDays(meetingDays: string | null): string[] {
  return meetingDays?.toUpperCase().split("").filter(Boolean) ?? [];
}

function makeVisiblePostgresPackageKey(pkg: PostgresScheduleCandidate): string {
  return [
    pkg.course_designation,
    pkg.section_bundle_label,
    pkg.meeting_summary_local ?? "",
  ].join("\u0000");
}

function makeGeneratedPostgresVisibilityKey(packages: PostgresScheduleCandidate[]): string {
  return [...packages]
    .map((pkg) => makeVisiblePostgresPackageKey(pkg))
    .sort()
    .join("\u0001");
}

function isPostgresMeetingOnline(meeting: PostgresPackageMeeting): boolean {
  return /online|asynchronous|distance/i.test(meeting.instruction_mode ?? "");
}

function haversineMeters(
  from: Pick<PostgresPackageMeeting, "latitude" | "longitude">,
  to: Pick<PostgresPackageMeeting, "latitude" | "longitude">,
): number | null {
  if (
    from.latitude === null ||
    from.longitude === null ||
    to.latitude === null ||
    to.longitude === null
  ) {
    return null;
  }

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const a =
    (Math.sin(deltaLatitude / 2) ** 2) +
    (Math.cos(fromLatitude) * Math.cos(toLatitude) * (Math.sin(deltaLongitude / 2) ** 2));

  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function isPostgresCandidateAvailabilityEligible(
  candidate: PostgresScheduleCandidate,
  options: {
    includeWaitlisted: boolean;
    includeClosed: boolean;
  },
): boolean {
  if ((candidate.open_seats ?? 0) > 0) {
    return true;
  }

  if (candidate.has_waitlist) {
    return options.includeWaitlisted;
  }

  return options.includeClosed;
}

function postgresMeetingsShareDateRange(
  left: Pick<PostgresPackageMeeting, "start_date" | "end_date" | "exam_date">,
  right: Pick<PostgresPackageMeeting, "start_date" | "end_date" | "exam_date">,
): boolean {
  const leftStart = left.start_date ?? Number.NEGATIVE_INFINITY;
  const leftEnd = left.end_date ?? left.exam_date ?? Number.POSITIVE_INFINITY;
  const rightStart = right.start_date ?? Number.NEGATIVE_INFINITY;
  const rightEnd = right.end_date ?? right.exam_date ?? Number.POSITIVE_INFINITY;

  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function normalizeMeetingTimeToMinutes(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  if (value >= 0 && value <= 1440) {
    return value;
  }

  const parts = localTimePartsFormatter.formatToParts(new Date(value));
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "", 10);
  const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "", 10);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  return (hour * 60) + minute;
}

function minNullableNumber(left: number | null, right: number | null): number | null {
  if (left === null) {
    return right;
  }

  if (right === null) {
    return left;
  }

  return Math.min(left, right);
}

function maxNullableNumber(left: number | null, right: number | null): number | null {
  if (left === null) {
    return right;
  }

  if (right === null) {
    return left;
  }

  return Math.max(left, right);
}

function compareNullableAscending(
  left: number | null,
  right: number | null,
  nullValue: number,
): number {
  const resolvedLeft = left ?? nullValue;
  const resolvedRight = right ?? nullValue;

  return resolvedLeft - resolvedRight;
}

function compareNullableDescending(
  left: number | null,
  right: number | null,
  nullValue: number,
): number {
  const resolvedLeft = left ?? nullValue;
  const resolvedRight = right ?? nullValue;

  return resolvedRight - resolvedLeft;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asNullableNumeric(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asNullableStringOrNumber(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function asNullableBoolean(value: unknown): boolean | null {
  return typeof value === "number" ? value !== 0 : null;
}
