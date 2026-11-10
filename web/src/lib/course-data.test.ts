import { after, test } from "node:test";
import assert from "node:assert/strict";

import { __resetDbForTests, getDb } from "./db";
import { withDbRows } from "./db-test-helpers";
import {
  buildPostgresTsquery,
  generateSchedulesFromPostgres,
  generateSchedulesFromPostgresWithMetadata,
  getCourseDetail,
  normalizeDesignation,
  parseCourseGroupsJson,
  parseStringArrayJson,
  searchCourses,
} from "./course-data";

test("normalizeDesignation uppercases and trims values", () => {
  assert.equal(normalizeDesignation("  Comp Sci 577  "), "COMP SCI 577");
});

test("normalizeDesignation rejects empty designations", () => {
  assert.throws(() => normalizeDesignation("   "), /non-empty/);
});

test("parseStringArrayJson returns string arrays only", () => {
  assert.deepEqual(parseStringArrayJson('["COMP SCI 577","MATH 240"]'), [
    "COMP SCI 577",
    "MATH 240",
  ]);
  assert.deepEqual(parseStringArrayJson(null), []);
  assert.deepEqual(parseStringArrayJson('{"bad":true}'), []);
});

test("parseCourseGroupsJson returns nested course groups only", () => {
  assert.deepEqual(
    parseCourseGroupsJson('[["COMP SCI 240","MATH 240"],["COMP SCI 367"]]'),
    [["COMP SCI 240", "MATH 240"], ["COMP SCI 367"]],
  );
  assert.deepEqual(parseCourseGroupsJson('["bad"]'), []);
  assert.deepEqual(parseCourseGroupsJson(null), []);
});

test("searchCourses returns a controlled empty list for punctuation-only queries", async () => {
  assert.deepEqual(await searchCourses({ query: "((( )))", limit: 99 }), []);
});

after(() => {
  __resetDbForTests();
});

test("getDb returns a Postgres client when SUPABASE_DATABASE_URL is set", () => {
  process.env.SUPABASE_DATABASE_URL = "postgres://example";
  __resetDbForTests();

  assert.ok(getDb());
});

test("getDb throws when SUPABASE_DATABASE_URL is missing", () => {
  delete process.env.SUPABASE_DATABASE_URL;
  __resetDbForTests();

  assert.throws(() => getDb(), /SUPABASE_DATABASE_URL/);
});

function makeCourseDetailRows(sqlText: string): Record<string, unknown>[] {
  if (sqlText.includes("FROM course_search_fts")) {
    return [
      {
        course_designation: "COMP SCI 577",
        title: "Algorithms for Large Data",
        minimum_credits: 3,
        maximum_credits: 3,
        cross_list_designations_json: '["COMP SCI 577"]',
        section_count: 1,
        has_any_open_seats: 1,
        has_any_waitlist: 0,
        has_any_full_section: 0,
      },
    ];
  }

  if (sqlText.includes("FROM course_overview_v") && sqlText.includes("WHERE course_designation =")) {
    return [{ term_code: "1272", course_id: "005770" }];
  }

  if (sqlText.includes("FROM course_cross_listing_overview_v")) {
    return [];
  }

  if (sqlText.includes("FROM courses c") && sqlText.includes("JOIN course_overview_v co")) {
    return [
      {
        course_designation: "COMP SCI 577",
        title: "Algorithms for Large Data",
        description: "Algorithms for Large Data description",
        subject_code: "302",
        catalog_number: "577",
        course_id: "005770",
        minimum_credits: 3,
        maximum_credits: 3,
        enrollment_prerequisites: null,
        cross_list_designations_json: '["COMP SCI 577"]',
        section_count: 1,
        has_any_open_seats: 1,
        has_any_waitlist: 0,
        has_any_full_section: 0,
      },
    ];
  }

  if (
    sqlText.includes("FROM prerequisite_course_summary_overview_v") &&
    sqlText.includes("LIMIT 1")
  ) {
    return [
      {
        summary_status: "partial",
        course_groups_json: '[["COMP SCI 400"]]',
        escape_clauses_json: '["graduate/professional standing"]',
        raw_text: "COMP SCI 400 and graduate/professional standing",
        unparsed_text: "graduate/professional standing",
      },
    ];
  }

  if (sqlText.includes("FROM prerequisite_rule_overview_v p")) {
    return [
      {
        rule_id: "rule:comp-sci-577",
        parse_status: "partial",
        parse_confidence: 0.75,
        summary_status: "partial",
        course_groups_json: '[["COMP SCI 400"]]',
        escape_clauses_json: '["graduate/professional standing"]',
        raw_text: "COMP SCI 400 and graduate/professional standing",
        unparsed_text: "graduate/professional standing",
      },
    ];
  }

  if (sqlText.includes("FROM section_overview_v") && sqlText.includes("ORDER BY section_type ASC")) {
    return [
      {
        section_class_number: 57701,
        source_package_id: "1272:302:005770:comp-sci-577-main",
        section_number: "001",
        section_type: "LEC",
        instruction_mode: "IN PERSON",
        session_code: "1",
        open_seats: 3,
        waitlist_current_size: 0,
        capacity: 30,
        currently_enrolled: 27,
        has_open_seats: 1,
        has_waitlist: 0,
        is_full: 0,
      },
    ];
  }

  if (sqlText.includes("FROM schedule_planning_v")) {
    return [
      {
        section_class_number: 57701,
        source_package_id: "1272:302:005770:comp-sci-577-main",
        meeting_index: 0,
        meeting_type: "CLASS",
        meeting_days: "MW",
        meeting_time_start: 54000000,
        meeting_time_end: 59400000,
        start_date: null,
        end_date: null,
        exam_date: null,
        room: "140",
        building_code: "0140",
        building_name: "Grainger Hall",
        street_address: "975 University Ave.",
        latitude: 43.0727,
        longitude: -89.4015,
        location_known: 1,
      },
    ];
  }

  if (sqlText.includes("FROM schedule_candidates_v")) {
    return [
      {
        source_package_id: "1272:302:005770:comp-sci-577-main",
        section_bundle_label: "COMP SCI 577 LEC 001",
        open_seats: 3,
        is_full: 0,
        has_waitlist: 0,
        campus_day_count: 2,
        meeting_summary_local: "MW 3:00 PM-4:30 PM @ Grainger Hall",
        restriction_note: null,
      },
    ];
  }

  if (sqlText.includes("SELECT DISTINCT package_id, section_class_number")) {
    return [{ package_id: "1272:302:005770:comp-sci-577-main", section_class_number: 57701 }];
  }

  if (sqlText.includes("SELECT DISTINCT course_id, title")) {
    return [{ course_id: "005770", title: "Algorithms for Large Data" }];
  }

  if (sqlText.includes("JOIN section_instructors si")) {
    return [
      {
        section_number: "001",
        section_type: "LEC",
        instructor_key: "ada@example.edu",
        instructor_display_name: "Ada Lovelace",
      },
    ];
  }

  if (sqlText.includes("madgrades_course_matches")) {
    return [{ madgrades_course_id: 11 }];
  }

  if (sqlText.includes("WITH course_history AS")) {
    return [
      {
        instructor_key: "ada@example.edu",
        instructor_match_status: "matched",
        same_course_prior_offering_count: 1,
        same_course_student_count: 20,
        same_course_gpa: 3.7,
        course_historical_gpa: 3.7,
      },
    ];
  }

  throw new Error(`Unexpected query in course-data test: ${sqlText}`);
}

test("searchCourses maps full-text search rows into course list items", async () => {
  const courses = await withDbRows(
    (sqlText) => makeCourseDetailRows(sqlText),
    async (queries) => {
      const results = await searchCourses({ query: "algorithms", limit: 99 });
      assert.ok(queries.some((sqlText) => sqlText.includes("course_search_fts")));
      return results;
    },
  );

  assert.deepEqual(courses, [
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
  ]);
});

test("buildPostgresTsquery converts tokenized search text into valid prefix tsquery syntax", () => {
  assert.equal(buildPostgresTsquery("engl 462"), "engl:* & 462:*");
  assert.equal(buildPostgresTsquery("Algorithms   Data"), "algorithms:* & data:*");
  assert.equal(buildPostgresTsquery("((( )))"), null);
});

test("searchCourses orders higher Postgres ts_rank matches first", async () => {
  const results = await withDbRows(
    (sqlText) => {
      if (sqlText.includes("FROM course_search_fts")) {
        assert.match(sqlText, /MAX\(search_rank\) AS best_search_rank/);
        assert.match(sqlText, /sm\.best_search_rank DESC/);
        assert.match(sqlText, /best_search_rank DESC/);
        return [
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            minimum_credits: 3,
            maximum_credits: 3,
            cross_list_designations_json: '["COMP SCI 577"]',
            section_count: 1,
            has_any_open_seats: 1,
            has_any_waitlist: 0,
            has_any_full_section: 0,
          },
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling",
            minimum_credits: 3,
            maximum_credits: 3,
            cross_list_designations_json: '["STAT 340"]',
            section_count: 2,
            has_any_open_seats: 1,
            has_any_waitlist: 0,
            has_any_full_section: 0,
          },
        ];
      }

      throw new Error(`Unexpected query in course-data test: ${sqlText}`);
    },
    async () => searchCourses({ query: "data", limit: 99 }),
  );

  assert.deepEqual(
    results.map((course) => course.designation),
    ["COMP SCI 577", "STAT 340"],
  );
});

test("generateSchedulesFromPostgres rejects hidden canonical meeting conflicts", async () => {
  const results = await withDbRows(
    (sqlText, args) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "1272:302:005770:cs577-bundle",
            section_bundle_label: "COMP SCI 577 LEC 002 + DIS 321",
            open_seats: 2,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 2,
            campus_day_count: 2,
            earliest_start_minute_local: 725,
            latest_end_minute_local: 855,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "TR 1:00 PM-2:15 PM; W 12:05 PM-12:55 PM",
          },
          {
            course_designation: "ASIAN AM 462",
            title: "Topic in Asian American Literature",
            source_package_id: "1272:184:024200:asianam462-lec2",
            section_bundle_label: "ASIAN AM 462 LEC 002",
            open_seats: 1,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 800,
            latest_end_minute_local: 915,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "T 1:20 PM-3:15 PM @ LEVY HALL",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        assert.equal(args.length, 2);
        assert.equal((sqlText.match(/\$\d+/g) ?? []).length, 2);
        return [
          {
            source_package_id: "1272:302:005770:cs577-bundle",
            meeting_days: "TR",
            meeting_time_start: 780,
            meeting_time_end: 855,
            start_date: null,
            end_date: null,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
          },
          {
            source_package_id: "1272:302:005770:cs577-bundle",
            meeting_days: "W",
            meeting_time_start: 725,
            meeting_time_end: 775,
            start_date: null,
            end_date: null,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
          },
          {
            source_package_id: "1272:184:024200:asianam462-lec2",
            meeting_days: "T",
            meeting_time_start: 800,
            meeting_time_end: 915,
            start_date: null,
            end_date: null,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.073,
            longitude: -89.402,
            location_known: 1,
          },
        ];
      }

      throw new Error(`Unexpected query in course-data test: ${sqlText}`);
    },
    async (queries) => {
      const schedules = await generateSchedulesFromPostgres({
        courses: ["COMP SCI 577", "ASIAN AM 462"],
        lockPackages: [],
        excludePackages: [],
        limit: 5,
        preferenceOrder: ["earlier-finishes", "later-starts", "fewer-campus-days", "less-time-between-classes"],
        includeWaitlisted: false,
        includeClosed: false,
      });
      assert.ok(queries.some((sqlText) => sqlText.includes("FROM schedule_candidates_v")));
      assert.ok(queries.some((sqlText) => sqlText.includes("FROM canonical_meetings")));
      return schedules;
    },
  );

  assert.deepEqual(results, []);
});

test("generateSchedulesFromPostgresWithMetadata prefers the compact schedule for less-time-between-classes", async () => {
  const result = await withDbRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling I",
            source_package_id: "stat340-zcompact",
            section_bundle_label: "STAT 340 LEC 001",
            open_seats: 10,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 2,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 660,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM; M 10:10 AM-11:00 AM",
          },
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling I",
            source_package_id: "stat340-aspread",
            section_bundle_label: "STAT 340 LEC 002",
            open_seats: 10,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 2,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 710,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM; M 10:50 AM-11:50 AM",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [
          {
            source_package_id: "stat340-zcompact",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
            start_date: 20260902,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 540,
            end_minute_local: 600,
          },
          {
            source_package_id: "stat340-zcompact",
            meeting_days: "M",
            meeting_time_start: 610,
            meeting_time_end: 660,
            start_date: 20260902,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 610,
            end_minute_local: 660,
          },
          {
            source_package_id: "stat340-aspread",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
            start_date: 20260902,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 540,
            end_minute_local: 600,
          },
          {
            source_package_id: "stat340-aspread",
            meeting_days: "M",
            meeting_time_start: 650,
            meeting_time_end: 710,
            start_date: 20260902,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 650,
            end_minute_local: 710,
          },
        ];
      }

      throw new Error(`Unexpected query in course-data test: ${sqlText}`);
    },
    async () =>
      generateSchedulesFromPostgresWithMetadata({
        courses: ["STAT 340"],
        lockPackages: [],
        excludePackages: [],
        limit: 5,
        maxCampusDays: null,
        startAfterMinuteLocal: null,
        endBeforeMinuteLocal: null,
        preferenceOrder: ["less-time-between-classes"],
        includeWaitlisted: false,
        includeClosed: false,
      }),
  );

  assert.equal(result.schedules[0]?.package_ids[0], "stat340-zcompact");
});

test("generateSchedulesFromPostgresWithMetadata prefers the spread schedule for more-time-between-classes", async () => {
  const result = await withDbRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling I",
            source_package_id: "stat340-zcompact",
            section_bundle_label: "STAT 340 LEC 001",
            open_seats: 10,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 2,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 660,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM; M 10:10 AM-11:00 AM",
          },
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling I",
            source_package_id: "stat340-aspread",
            section_bundle_label: "STAT 340 LEC 002",
            open_seats: 10,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 2,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 710,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM; M 10:50 AM-11:50 AM",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [
          {
            source_package_id: "stat340-zcompact",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
            start_date: 20260902,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 540,
            end_minute_local: 600,
          },
          {
            source_package_id: "stat340-zcompact",
            meeting_days: "M",
            meeting_time_start: 610,
            meeting_time_end: 660,
            start_date: 20260902,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 610,
            end_minute_local: 660,
          },
          {
            source_package_id: "stat340-aspread",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
            start_date: 20260902,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 540,
            end_minute_local: 600,
          },
          {
            source_package_id: "stat340-aspread",
            meeting_days: "M",
            meeting_time_start: 650,
            meeting_time_end: 710,
            start_date: 20260902,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 650,
            end_minute_local: 710,
          },
        ];
      }

      throw new Error(`Unexpected query in course-data test: ${sqlText}`);
    },
    async () =>
      generateSchedulesFromPostgresWithMetadata({
        courses: ["STAT 340"],
        lockPackages: [],
        excludePackages: [],
        limit: 5,
        maxCampusDays: null,
        startAfterMinuteLocal: null,
        endBeforeMinuteLocal: null,
        preferenceOrder: ["more-time-between-classes"],
        includeWaitlisted: false,
        includeClosed: false,
      }),
  );

  assert.deepEqual(
    result.schedules.map((schedule) => schedule.package_ids),
    [["stat340-aspread"], ["stat340-zcompact"]],
  );
});

test("generateSchedulesFromPostgresWithMetadata keeps source ordering when preferenceOrder is explicitly empty", async () => {
  const result = await withDbRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling I",
            source_package_id: "stat340-zcompact",
            section_bundle_label: "STAT 340 LEC 001",
            open_seats: 10,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 2,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 660,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM; M 10:10 AM-11:00 AM",
          },
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling I",
            source_package_id: "stat340-aspread",
            section_bundle_label: "STAT 340 LEC 002",
            open_seats: 10,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 2,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 710,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM; M 10:50 AM-11:50 AM",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [
          {
            source_package_id: "stat340-zcompact",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
            start_date: 20260902,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 540,
            end_minute_local: 600,
          },
          {
            source_package_id: "stat340-zcompact",
            meeting_days: "M",
            meeting_time_start: 610,
            meeting_time_end: 660,
            start_date: 20260902,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 610,
            end_minute_local: 660,
          },
          {
            source_package_id: "stat340-aspread",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
            start_date: 20260902,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 540,
            end_minute_local: 600,
          },
          {
            source_package_id: "stat340-aspread",
            meeting_days: "M",
            meeting_time_start: 650,
            meeting_time_end: 710,
            start_date: 20260902,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 650,
            end_minute_local: 710,
          },
        ];
      }

      throw new Error(`Unexpected query in course-data test: ${sqlText}`);
    },
    async () =>
      generateSchedulesFromPostgresWithMetadata({
        courses: ["STAT 340"],
        lockPackages: [],
        excludePackages: [],
        limit: 5,
        maxCampusDays: null,
        startAfterMinuteLocal: null,
        endBeforeMinuteLocal: null,
        preferenceOrder: [],
        includeWaitlisted: false,
        includeClosed: false,
      }),
  );

  assert.deepEqual(
    result.schedules.map((schedule) => schedule.package_ids),
    [["stat340-aspread"], ["stat340-zcompact"]],
  );
});

test("generateSchedulesFromPostgresWithMetadata reports hard-filter empty state", async () => {
  const result = await withDbRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "cs577-main",
            section_bundle_label: "COMP SCI 577 LEC 001",
            open_seats: 2,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 720,
            latest_end_minute_local: 780,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "T 12:00 PM-1:00 PM",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [
          {
            source_package_id: "cs577-main",
            meeting_days: "T",
            meeting_time_start: 720,
            meeting_time_end: 780,
            start_date: 20260902,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 720,
            end_minute_local: 780,
          },
        ];
      }

      throw new Error(`Unexpected query in course-data test: ${sqlText}`);
    },
    async () =>
      generateSchedulesFromPostgresWithMetadata({
        courses: ["COMP SCI 577"],
        lockPackages: [],
        excludePackages: [],
        limit: 5,
        maxCampusDays: 0,
        startAfterMinuteLocal: null,
        endBeforeMinuteLocal: null,
        preferenceOrder: ["later-starts"],
        includeWaitlisted: false,
        includeClosed: false,
      }),
  );

  assert.deepEqual(result.schedules, []);
  assert.equal(result.emptyStateReason, "hard-filters");
});

test("generateSchedulesFromPostgresWithMetadata applies hard filters using package fallbacks when canonical rows are missing", async () => {
  const result = await withDbRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "cs577-partial-canonical",
            section_bundle_label: "COMP SCI 577 LEC 001",
            open_seats: 3,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 2,
            earliest_start_minute_local: 600,
            latest_end_minute_local: 900,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "MW 10:00 AM-3:00 PM",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [];
      }

      throw new Error(`Unexpected query in course-data test: ${sqlText}`);
    },
    async () =>
      generateSchedulesFromPostgresWithMetadata({
        courses: ["COMP SCI 577"],
        lockPackages: [],
        excludePackages: [],
        limit: 5,
        maxCampusDays: 1,
        startAfterMinuteLocal: 660,
        endBeforeMinuteLocal: 840,
        preferenceOrder: ["later-starts"],
        includeWaitlisted: false,
        includeClosed: false,
      }),
  );

  assert.deepEqual(result.schedules, []);
  assert.equal(result.emptyStateReason, "hard-filters");
});

test("generateSchedulesFromPostgresWithMetadata applies time hard filters from canonical meetings", async () => {
  const result = await withDbRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "cs577-hidden-early",
            section_bundle_label: "COMP SCI 577 LEC 001 + DIS 301",
            open_seats: 3,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 720,
            latest_end_minute_local: 780,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "T 12:00 PM-1:00 PM",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [
          {
            source_package_id: "cs577-hidden-early",
            meeting_days: "T",
            meeting_time_start: 600,
            meeting_time_end: 660,
            start_date: 20260902,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 600,
            end_minute_local: 660,
          },
          {
            source_package_id: "cs577-hidden-early",
            meeting_days: "T",
            meeting_time_start: 720,
            meeting_time_end: 780,
            start_date: 20260902,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 720,
            end_minute_local: 780,
          },
        ];
      }

      throw new Error(`Unexpected query in course-data test: ${sqlText}`);
    },
    async () =>
      generateSchedulesFromPostgresWithMetadata({
        courses: ["COMP SCI 577"],
        lockPackages: [],
        excludePackages: [],
        limit: 5,
        maxCampusDays: null,
        startAfterMinuteLocal: 660,
        endBeforeMinuteLocal: null,
        preferenceOrder: ["later-starts"],
        includeWaitlisted: false,
        includeClosed: false,
      }),
  );

  assert.deepEqual(result.schedules, []);
  assert.equal(result.emptyStateReason, "hard-filters");
});

test("generateSchedulesFromPostgresWithMetadata counts gaps past non-overlapping intervening meetings", async () => {
  const result = await withDbRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling I",
            source_package_id: "stat340-compact-gap",
            section_bundle_label: "STAT 340 LEC 001",
            open_seats: 10,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 2,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 660,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM; M 10:10 AM-11:00 AM",
          },
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling I",
            source_package_id: "stat340-split-gap",
            section_bundle_label: "STAT 340 LEC 002",
            open_seats: 10,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 3,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 840,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM; M 10:10 AM-11:00 AM; M 1:00 PM-2:00 PM",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [
          {
            source_package_id: "stat340-compact-gap",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
            start_date: 20261020,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 540,
            end_minute_local: 600,
          },
          {
            source_package_id: "stat340-compact-gap",
            meeting_days: "M",
            meeting_time_start: 610,
            meeting_time_end: 660,
            start_date: 20261020,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 610,
            end_minute_local: 660,
          },
          {
            source_package_id: "stat340-split-gap",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
            start_date: 20261020,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 540,
            end_minute_local: 600,
          },
          {
            source_package_id: "stat340-split-gap",
            meeting_days: "M",
            meeting_time_start: 610,
            meeting_time_end: 660,
            start_date: 20260902,
            end_date: 20261019,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 610,
            end_minute_local: 660,
          },
          {
            source_package_id: "stat340-split-gap",
            meeting_days: "M",
            meeting_time_start: 780,
            meeting_time_end: 840,
            start_date: 20261020,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 780,
            end_minute_local: 840,
          },
        ];
      }

      throw new Error(`Unexpected query in course-data test: ${sqlText}`);
    },
    async () =>
      generateSchedulesFromPostgresWithMetadata({
        courses: ["STAT 340"],
        lockPackages: [],
        excludePackages: [],
        limit: 5,
        maxCampusDays: null,
        startAfterMinuteLocal: null,
        endBeforeMinuteLocal: null,
        preferenceOrder: ["more-time-between-classes"],
        includeWaitlisted: false,
        includeClosed: false,
      }),
  );

  assert.equal(result.schedules[0]?.package_ids[0], "stat340-split-gap");
});

test("generateSchedulesFromPostgresWithMetadata counts long gaps past non-overlapping intervening meetings", async () => {
  const result = await withDbRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling I",
            source_package_id: "stat340-zcompact-long-gap",
            section_bundle_label: "STAT 340 LEC 001",
            open_seats: 10,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 2,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 660,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM; M 10:10 AM-11:00 AM",
          },
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling I",
            source_package_id: "stat340-asplit-long-gap",
            section_bundle_label: "STAT 340 LEC 002",
            open_seats: 10,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 3,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 840,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM; M 10:10 AM-11:00 AM; M 1:00 PM-2:00 PM",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [
          {
            source_package_id: "stat340-zcompact-long-gap",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
            start_date: 20261020,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 540,
            end_minute_local: 600,
          },
          {
            source_package_id: "stat340-zcompact-long-gap",
            meeting_days: "M",
            meeting_time_start: 610,
            meeting_time_end: 660,
            start_date: 20261020,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 610,
            end_minute_local: 660,
          },
          {
            source_package_id: "stat340-asplit-long-gap",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
            start_date: 20261020,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 540,
            end_minute_local: 600,
          },
          {
            source_package_id: "stat340-asplit-long-gap",
            meeting_days: "M",
            meeting_time_start: 610,
            meeting_time_end: 660,
            start_date: 20260902,
            end_date: 20261019,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 610,
            end_minute_local: 660,
          },
          {
            source_package_id: "stat340-asplit-long-gap",
            meeting_days: "M",
            meeting_time_start: 780,
            meeting_time_end: 840,
            start_date: 20261020,
            end_date: 20261212,
            exam_date: null,
            instruction_mode: null,
            latitude: 43.072,
            longitude: -89.401,
            location_known: 1,
            start_minute_local: 780,
            end_minute_local: 840,
          },
        ];
      }

      throw new Error(`Unexpected query in course-data test: ${sqlText}`);
    },
    async () =>
      generateSchedulesFromPostgresWithMetadata({
        courses: ["STAT 340"],
        lockPackages: [],
        excludePackages: [],
        limit: 5,
        maxCampusDays: null,
        startAfterMinuteLocal: null,
        endBeforeMinuteLocal: null,
        preferenceOrder: ["fewer-long-gaps" as never], // legacy id, normalized by the generator
        includeWaitlisted: false,
        includeClosed: false,
      }),
  );

  assert.equal(result.schedules[0]?.package_ids[0], "stat340-zcompact-long-gap");
});

test("getCourseDetail returns Madgrades-backed instructor history", async () => {
  const detail = await withDbRows(
    (sqlText) => makeCourseDetailRows(sqlText),
    async (queries) => {
      const courseDetail = await getCourseDetail("COMP SCI 577");
      assert.ok(queries.some((sqlText) => sqlText.includes("WITH course_history AS")));
      return courseDetail;
    },
  );

  assert.ok(detail);
  assert.deepEqual(detail.instructorGrades, [
    {
      sectionNumber: "001",
      sectionType: "LEC",
      instructorDisplayName: "Ada Lovelace",
      sameCoursePriorOfferingCount: 1,
      sameCourseStudentCount: 20,
      sameCourseGpa: 3.7,
      courseHistoricalGpa: 3.7,
      instructorMatchStatus: "matched",
    },
  ]);
});

test("getCourseDetail qualifies Madgrades tables with the madgrades schema", async () => {
  const detail = await withDbRows(
    (sqlText) => {
      if (sqlText.includes("JOIN section_instructors si")) {
        return [
          {
            section_number: "001",
            section_type: "LEC",
            instructor_key: "ada@example.edu",
            instructor_display_name: "Ada Lovelace",
          },
        ];
      }

      if (sqlText.includes("FROM madgrades_course_matches")) {
        assert.match(sqlText, /FROM madgrades\.madgrades_course_matches/);
        return [{ madgrades_course_id: 11 }];
      }

      if (sqlText.includes("WITH course_history AS")) {
        assert.match(sqlText, /FROM madgrades\.madgrades_course_offerings mco/);
        assert.match(sqlText, /FROM madgrades\.madgrades_course_grades mcg/);
        assert.match(sqlText, /FROM madgrades\.madgrades_instructor_matches mim/);
        return [
          {
            instructor_key: "ada@example.edu",
            instructor_match_status: "matched",
            same_course_prior_offering_count: 1,
            same_course_student_count: 20,
            same_course_gpa: 3.7,
            course_historical_gpa: 3.7,
          },
        ];
      }

      return makeCourseDetailRows(sqlText);
    },
    async () => getCourseDetail("COMP SCI 577"),
  );

  assert.ok(detail);
  assert.equal(detail.instructorGrades[0]?.sameCourseGpa, 3.7);
});

test("getCourseDetail returns sections meetings prerequisites grades and schedule packages", async () => {
  const detail = await withDbRows(
    (sqlText) => makeCourseDetailRows(sqlText),
    async () => getCourseDetail(" comp sci 577 "),
  );

  assert.ok(detail);
  assert.equal(detail.course.designation, "COMP SCI 577");
  assert.equal(detail.sections.length, 1);
  assert.equal(detail.meetings.length, 1);
  assert.equal(detail.prerequisites.length, 1);
  assert.equal(detail.instructorGrades.length, 1);
  assert.equal(detail.schedulePackages.length, 1);
  assert.equal(detail.meetings[0].meetingTimeStart, 54000000);
  assert.equal(detail.meetings[0].meetingTimeEnd, 59400000);
  assert.deepEqual(detail.prerequisites[0], {
    ruleId: "rule:comp-sci-577",
    parseStatus: "partial",
    parseConfidence: 0.75,
    summaryStatus: "partial",
    courseGroups: [["COMP SCI 400"]],
    escapeClauses: ["graduate/professional standing"],
    rawText: "COMP SCI 400 and graduate/professional standing",
    unparsedText: "graduate/professional standing",
  });
  assert.equal(detail.schedulePackages[0].sourcePackageId, "1272:302:005770:comp-sci-577-main");
});

test("getCourseDetail returns null when the designation matches no course or alias", async () => {
  const detail = await withDbRows(
    () => [],
    async () => getCourseDetail("NOPE 999"),
  );

  assert.equal(detail, null);
});

test("getCourseDetail keeps current instructors with null grade fields when Madgrades queries fail", async () => {
  const detail = await withDbRows(
    (sqlText) => {
      if (sqlText.includes("madgrades_course_matches")) {
        throw new Error("relation madgrades.madgrades_course_matches does not exist");
      }

      return makeCourseDetailRows(sqlText);
    },
    async () => getCourseDetail("COMP SCI 577"),
  );

  assert.ok(detail);
  assert.deepEqual(detail.instructorGrades, [
    {
      sectionNumber: "001",
      sectionType: "LEC",
      instructorDisplayName: "Ada Lovelace",
      sameCoursePriorOfferingCount: null,
      sameCourseStudentCount: null,
      sameCourseGpa: null,
      courseHistoricalGpa: null,
      instructorMatchStatus: null,
    },
  ]);
});

test("getCourseDetail keeps instructors with null grade fields when the course has no Madgrades match", async () => {
  const detail = await withDbRows(
    (sqlText) => {
      if (sqlText.includes("madgrades_course_matches")) {
        return [];
      }

      return makeCourseDetailRows(sqlText);
    },
    async (queries) => {
      const courseDetail = await getCourseDetail("COMP SCI 577");
      assert.ok(!queries.some((sqlText) => sqlText.includes("WITH course_history AS")));
      return courseDetail;
    },
  );

  assert.ok(detail);
  assert.equal(detail.instructorGrades.length, 1);
  assert.equal(detail.instructorGrades[0].instructorDisplayName, "Ada Lovelace");
  assert.equal(detail.instructorGrades[0].sameCourseGpa, null);
});

test("getCourseDetail collapses cross-listed duplicate lecture rows on the course page", async () => {
  const primaryPackageId = "1272:302:023191:comp-sci-102-main";
  const crossListedPackageId = "1272:544:023191:l-i-s-102-main";
  const section = {
    section_number: "001",
    section_type: "LEC",
    instruction_mode: "IN PERSON",
    session_code: "1",
    waitlist_current_size: 0,
    capacity: 40,
    has_open_seats: 1,
    has_waitlist: 0,
    is_full: 0,
  };
  const schedulePackage = {
    section_bundle_label: "COMP SCI 102 LEC 001",
    is_full: 0,
    has_waitlist: 0,
    campus_day_count: 2,
    meeting_summary_local: "TR 9:30 AM-10:45 AM @ Computer Sciences",
  };

  const detail = await withDbRows(
    (sqlText) => {
      if (sqlText.includes("FROM courses c") && sqlText.includes("JOIN course_overview_v co")) {
        return [
          {
            course_designation: "COMP SCI 102",
            title: "Introduction to Computing",
            description: null,
            subject_code: "302",
            catalog_number: "102",
            course_id: "023191",
            minimum_credits: 3,
            maximum_credits: 3,
            enrollment_prerequisites: null,
            cross_list_designations_json: '["COMP SCI 102","L I S 102"]',
            section_count: 2,
            has_any_open_seats: 1,
            has_any_waitlist: 0,
            has_any_full_section: 0,
          },
        ];
      }

      if (sqlText.includes("FROM section_overview_v") && sqlText.includes("ORDER BY section_type ASC")) {
        return [
          {
            ...section,
            section_class_number: 27345,
            source_package_id: crossListedPackageId,
            open_seats: 5,
            currently_enrolled: 35,
          },
          {
            ...section,
            section_class_number: 27344,
            source_package_id: primaryPackageId,
            open_seats: 20,
            currently_enrolled: 20,
          },
        ];
      }

      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            ...schedulePackage,
            source_package_id: crossListedPackageId,
            open_seats: 5,
            restriction_note: "Reserved for Information School majors.",
          },
          {
            ...schedulePackage,
            source_package_id: primaryPackageId,
            open_seats: 20,
            restriction_note: null,
          },
        ];
      }

      if (sqlText.includes("SELECT DISTINCT course_id, title")) {
        return [{ course_id: "023191", title: "Introduction to Computing" }];
      }

      return makeCourseDetailRows(sqlText);
    },
    async () => getCourseDetail("COMP SCI 102"),
  );

  assert.ok(detail);
  assert.equal(detail.course.sectionCount, 1);
  assert.equal(detail.sections.length, 1);
  assert.equal(detail.schedulePackages.length, 1);
  assert.equal(detail.sections[0].sectionType, "LEC");
  assert.equal(detail.sections[0].sectionNumber, "001");
  assert.equal(detail.sections[0].sectionClassNumber, 27344);
  assert.equal(detail.sections[0].openSeats, 20);
  assert.equal(detail.schedulePackages[0].sourcePackageId, primaryPackageId);
  assert.equal(detail.schedulePackages[0].openSeats, 20);
  assert.equal(detail.schedulePackages[0].restrictionNote, "Reserved for Information School majors.");
});

test("getCourseDetail preserves topic-specific titles for live sections on umbrella topic courses", async () => {
  const section = {
    section_type: "LEC",
    instruction_mode: "IN PERSON",
    session_code: "1",
    open_seats: 4,
    waitlist_current_size: 0,
    capacity: 20,
    currently_enrolled: 16,
    has_open_seats: 1,
    has_waitlist: 0,
    is_full: 0,
  };
  const schedulePackage = {
    open_seats: 4,
    is_full: 0,
    has_waitlist: 0,
    campus_day_count: 1,
    restriction_note: null,
  };

  const detail = await withDbRows(
    (sqlText) => {
      if (sqlText.includes("FROM courses c") && sqlText.includes("JOIN course_overview_v co")) {
        return [
          {
            course_designation: "ASIAN AM 462",
            title: "Topic in Asian American Literature",
            description: null,
            subject_code: "184",
            catalog_number: "462",
            course_id: "024200",
            minimum_credits: 3,
            maximum_credits: 3,
            enrollment_prerequisites: null,
            cross_list_designations_json: '["ASIAN AM 462","ENGL 462"]',
            section_count: 2,
            has_any_open_seats: 1,
            has_any_waitlist: 0,
            has_any_full_section: 0,
          },
        ];
      }

      if (sqlText.includes("FROM section_overview_v") && sqlText.includes("ORDER BY section_type ASC")) {
        return [
          {
            ...section,
            section_class_number: 46201,
            source_package_id: "1272:184:024201:asianam462-lec1",
            section_number: "001",
          },
          {
            ...section,
            section_class_number: 46202,
            source_package_id: "1272:184:024202:asianam462-lec2",
            section_number: "002",
          },
        ];
      }

      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            ...schedulePackage,
            source_package_id: "1272:184:024202:asianam462-lec2",
            section_bundle_label: "ASIAN AM 462 LEC 002",
            meeting_summary_local: "T 1:20 PM-3:15 PM @ LEVY HALL",
          },
          {
            ...schedulePackage,
            source_package_id: "1272:184:024200:asianam462-both",
            section_bundle_label: "ASIAN AM 462 LEC 001 + LEC 002",
            meeting_summary_local: "TR 1:20 PM-3:15 PM @ LEVY HALL",
          },
          {
            ...schedulePackage,
            source_package_id: "1272:184:024201:asianam462-lec1",
            section_bundle_label: "ASIAN AM 462 LEC 001",
            meeting_summary_local: "R 1:20 PM-3:15 PM @ LEVY HALL",
          },
        ];
      }

      if (sqlText.includes("SELECT DISTINCT course_id, title")) {
        return [
          { course_id: "024200", title: "Topic in Asian American Literature" },
          { course_id: "024201", title: "Asian Americans and Sci Fi" },
          { course_id: "024202", title: "Asian Am Creative Writing Wrk" },
        ];
      }

      return makeCourseDetailRows(sqlText);
    },
    async () => getCourseDetail("ASIAN AM 462"),
  );

  assert.ok(detail);
  assert.equal(detail.course.title, "Topic in Asian American Literature");
  assert.deepEqual(
    detail.sections.map((section) => ({
      sectionNumber: section.sectionNumber,
      sectionTitle: section.sectionTitle,
    })),
    [
      { sectionNumber: "001", sectionTitle: "Asian Americans and Sci Fi" },
      { sectionNumber: "002", sectionTitle: "Asian Am Creative Writing Wrk" },
    ],
  );
  assert.deepEqual(
    detail.schedulePackages.map((schedulePackage) => ({
      label: schedulePackage.sectionBundleLabel,
      sectionTitle: schedulePackage.sectionTitle,
    })),
    [
      { label: "ASIAN AM 462 LEC 002", sectionTitle: "Asian Am Creative Writing Wrk" },
      { label: "ASIAN AM 462 LEC 001 + LEC 002", sectionTitle: null },
      { label: "ASIAN AM 462 LEC 001", sectionTitle: "Asian Americans and Sci Fi" },
    ],
  );
});

test("searchCourses reads section_count when Postgres returns the bigint count as a string", async () => {
  const courses = await withDbRows(
    (sqlText) => {
      if (sqlText.includes("FROM course_search_fts")) {
        return [
          {
            course_designation: "COMP SCI 577",
            title: "Introduction to Algorithms",
            minimum_credits: 4,
            maximum_credits: 4,
            cross_list_designations_json: '["COMP SCI 577"]',
            section_count: "11",
            has_any_open_seats: 1,
            has_any_waitlist: 0,
            has_any_full_section: 1,
          },
        ];
      }

      throw new Error(`Unexpected query in course-data test: ${sqlText}`);
    },
    async () => searchCourses({ query: "algorithms" }),
  );

  assert.equal(courses[0].sectionCount, 11);
});

test("generateSchedulesFromPostgres loads meetings by owning package, not canonical source package", async () => {
  await withDbRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "MATH 222",
            title: "Calculus and Analytic Geometry 2",
            source_package_id: "pkg-lec-dis-2",
            section_bundle_label: "MATH 222 LEC 001 + DIS 302",
            open_seats: 5,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 2,
            campus_day_count: 5,
            earliest_start_minute_local: 595,
            latest_end_minute_local: 915,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "MWF 9:55 AM-10:45 AM; TR 2:25 PM-3:15 PM",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        // A shared lecture row has package_id = this package but source_package_id = another one,
        // so the query has to select and filter on package_id.
        assert.match(sqlText, /package_id AS source_package_id/);
        assert.match(sqlText, /WHERE package_id IN \(\$1\)/);
        assert.doesNotMatch(sqlText, /WHERE source_package_id IN/);
        return [];
      }

      throw new Error(`Unexpected query in course-data test: ${sqlText}`);
    },
    async () =>
      generateSchedulesFromPostgres({
        courses: ["MATH 222"],
        lockPackages: [],
        excludePackages: [],
        limit: 5,
        preferenceOrder: [],
        includeWaitlisted: false,
        includeClosed: false,
      }),
  );
});
