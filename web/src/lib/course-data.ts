import type Database from "better-sqlite3";
import type { Client } from "@libsql/client";

import { normalizeCourseDesignation } from "./course-designation";
import { getCourseDb, getDb, getMadgradesDb } from "./db";

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

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;

let hasCourseSearchFtsTable: boolean | null = null;

export const normalizeDesignation = normalizeCourseDesignation;

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

async function allRows(db: Client, sql: string, args: QueryArg[] = []): Promise<Row[]> {
  const result = await db.execute({ sql, args });
  return result.rows as Row[];
}

async function firstRow(db: Client, sql: string, args: QueryArg[] = []): Promise<Row | undefined> {
  const rows = await allRows(db, sql, args);
  return rows[0];
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

function hasAnyMadgradesConfig(): boolean {
  return [
    "TURSO_MADGRADES_DATABASE_URL",
    "TURSO_MADGRADES_AUTH_TOKEN",
    "MADGRADES_MADGRADES_REPLICA_PATH",
  ].some(hasValue);
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

export async function searchCourses(params: CourseSearchParams = {}): Promise<CourseListItem[]> {
  const db = getCourseDb();
  const query = params.query?.trim() ?? "";
  const subject = params.subject?.trim() ?? "";
  const limit = clampLimit(params.limit);
  const normalizedSubjectPrefix = subject ? `${escapeLike(subject.toUpperCase())}%` : null;
  const searchContext = buildCourseSearchContext(query);
  let rows: Row[];

  if (searchContext.matchQuery && (await hasCourseSearchTable(db))) {
    const normalizedQueryLike = `${escapeLike(searchContext.normalizedQuery)}%`;
    const compactQueryLike = `${escapeLike(searchContext.compactQuery)}%`;

    rows = await allRows(
      db,
      `
          WITH raw_search_matches AS (
            SELECT
              term_code,
              course_id,
              alias_course_designation_normalized,
              alias_course_designation_compact,
              title_normalized,
              rank AS search_rank
            FROM course_search_fts
            WHERE course_search_fts MATCH ?
          ),
          search_matches AS (
            SELECT
              term_code,
              course_id,
              MIN(search_rank) AS best_search_rank,
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
                  sm.best_search_rank ASC,
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
            best_search_rank ASC,
            COALESCE(has_any_open_seats, 0) DESC,
            COALESCE(section_count, 0) DESC,
            course_designation ASC
          LIMIT ?
        `,
      [
        searchContext.matchQuery,
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

    rows = await allRows(
      db,
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

    rows = await allRows(
      db,
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
  const prerequisites = prerequisiteRows.map(mapPrerequisiteRule);
  const courseTitleLookup = buildCourseTitleLookup(
    db,
    canonical.termCode,
    [
      ...sections.map((row) => asString(row.source_package_id)),
      ...schedulePackages.map((row) => asString(row.source_package_id)),
    ],
  );
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

async function getInstructorHistory(
  db: Database.Database,
  termCode: string,
  courseId: string,
): Promise<InstructorHistoryItem[]> {
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
    const madgradesCourseId = asNullableNumber(courseMatchRow?.madgrades_course_id);

    const gradeByInstructorKey = new Map<string, Row>();

    if (madgradesCourseId !== null) {
      const placeholders = instructorKeys.map(() => "?").join(", ");
      const gradeRows = await allRows(
        madgradesDb,
        `
          SELECT
            mim.instructor_key,
            mim.match_status AS instructor_match_status,
            ich.prior_offering_count AS same_course_prior_offering_count,
            ich.student_count AS same_course_student_count,
            ich.same_course_gpa,
            cgo.historical_gpa AS course_historical_gpa
          FROM madgrades_instructor_matches mim
          LEFT JOIN instructor_course_history_overview_v ich
            ON ich.madgrades_instructor_id = mim.madgrades_instructor_id
           AND ich.madgrades_course_id = ?
          LEFT JOIN course_grade_overview_v cgo
            ON cgo.madgrades_course_id = ?
          WHERE mim.instructor_key IN (${placeholders})
        `,
        [madgradesCourseId, madgradesCourseId, ...instructorKeys],
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
          sameCoursePriorOfferingCount: asNullableNumber(gradeRow?.same_course_prior_offering_count),
          sameCourseStudentCount: asNullableNumber(gradeRow?.same_course_student_count),
          sameCourseGpa: asNullableNumber(gradeRow?.same_course_gpa),
          courseHistoricalGpa: asNullableNumber(gradeRow?.course_historical_gpa),
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

async function hasCourseSearchTable(db: Client): Promise<boolean> {
  if (hasCourseSearchFtsTable !== null) {
    return hasCourseSearchFtsTable;
  }

  const row = await firstRow(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'course_search_fts'",
  );

  hasCourseSearchFtsTable = row?.name === "course_search_fts";
  return hasCourseSearchFtsTable;
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
} {
  const normalizedQuery = normalizeSearchText(query);
  const compactQuery = makeCompactCourseDesignation(query);

  if (!normalizedQuery) {
    return {
      normalizedQuery,
      compactQuery,
      matchQuery: null,
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

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asNullableStringOrNumber(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function asNullableBoolean(value: unknown): boolean | null {
  return typeof value === "number" ? value !== 0 : null;
}
