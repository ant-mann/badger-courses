import { after, afterEach, test } from "node:test";
import assert from "node:assert/strict";

import { buildCourseDbFixture, makeCourse } from "../../../../../tests/helpers/madgrades-db-fixture.mjs";
import { __resetDbsForTests, getRuntimePostgresDb } from "@/lib/db";
import { __resetCourseDataCachesForTests } from "@/lib/course-data";

import { GET as getCourseDetail } from "./[designation]/route";
import { DEFAULT_PREFERENCE_ORDER } from "@/app/schedule-builder/preferences";
import { POST as buildSchedules } from "../schedules/route";
import {
  normalizeBooleanInput,
  normalizeNullableIntegerField,
  normalizeNullableIntegerInput,
  normalizePreferenceOrderInput,
  normalizeScheduleGenerationResult,
} from "../schedules/normalize";
import { GET as searchCourses } from "./search/route";

function seedCourseDetailRows(db: import("better-sqlite3").Database) {
  const instructorKey = db.prepare(`
    SELECT instructor_key
    FROM instructors
    WHERE email = ?
  `).pluck().get("ada@example.edu");

  db.prepare(`
    INSERT INTO madgrades_courses (
      madgrades_course_id,
      subject_code,
      catalog_number,
      course_designation
    ) VALUES (?, ?, ?, ?)
  `).run(11, "302", "577", "COMP SCI 577");

  db.prepare(`
    INSERT INTO madgrades_instructors (
      madgrades_instructor_id,
      display_name
    ) VALUES (?, ?)
  `).run(11, "Ada Lovelace");

  db.prepare(`
    INSERT INTO madgrades_course_matches (
      term_code,
      course_id,
      madgrades_course_id,
      match_status,
      matched_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run("1272", "005770", 11, "matched", "2024-01-16T00:00:00Z");

  db.prepare(`
    INSERT INTO madgrades_instructor_matches (
      instructor_key,
      madgrades_instructor_id,
      match_status,
      matched_at
    ) VALUES (?, ?, ?, ?)
  `).run(instructorKey, 11, "matched", "2024-01-16T00:00:00Z");

  db.prepare(`
    INSERT INTO madgrades_refresh_runs (
      madgrades_refresh_run_id,
      snapshot_run_at,
      last_refreshed_at,
      source_term_code,
      notes
    ) VALUES (?, ?, ?, ?, ?)
  `).run(11, "2024-01-15T00:00:00Z", "2024-01-16T00:00:00Z", "1272", "routes test");

  db.prepare(`
    INSERT INTO madgrades_course_grades (
      madgrades_course_grade_id,
      madgrades_refresh_run_id,
      madgrades_course_id,
      term_code,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(11, 11, 11, "1264", 20, 3.7);

  db.prepare(`
    INSERT INTO madgrades_instructor_grades (
      madgrades_instructor_grade_id,
      madgrades_refresh_run_id,
      madgrades_instructor_id,
      term_code,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(11, 11, 11, "1264", 20, 3.7);

  db.prepare(`
    INSERT INTO madgrades_course_offerings (
      madgrades_course_offering_id,
      madgrades_course_id,
      madgrades_instructor_id,
      term_code,
      section_type,
      student_count,
      avg_gpa
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(11, 11, 11, "1264", "LEC", 20, 3.7);
}

const fixture = buildCourseDbFixture({
  courses: [
    makeCourse({
      termCode: "1272",
      courseId: "003210",
      subjectCode: "220",
      catalogNumber: "340",
      courseDesignation: "STAT 340",
      title: "Data Science Modeling",
    }),
    makeCourse({
      termCode: "1272",
      courseId: "005770",
      subjectCode: "302",
      catalogNumber: "577",
      courseDesignation: "COMP SCI 577",
      title: "Algorithms for Large Data",
    }),
  ],
  packageSnapshot: {
    termCode: "1272",
    results: [
      {
        course: {
          termCode: "1272",
          subjectCode: "220",
          courseId: "003210",
        },
        packages: [
          {
            id: "stat340-early",
            termCode: "1272",
            subjectCode: "220",
            courseId: "003210",
            enrollmentClassNumber: 33210,
            lastUpdated: 2000,
            onlineOnly: false,
            isAsynchronous: false,
            packageEnrollmentStatus: {
              status: "OPEN",
              availableSeats: 4,
              waitlistTotal: 0,
            },
            enrollmentStatus: {
              openSeats: 4,
              waitlistCurrentSize: 0,
              capacity: 30,
              currentlyEnrolled: 26,
            },
            sections: [
              {
                classUniqueId: { termCode: "1272", classNumber: 33211 },
                sectionNumber: "001",
                type: "LEC",
                instructionMode: "Classroom Instruction",
                sessionCode: "A1",
                published: true,
                enrollmentStatus: {
                  openSeats: 4,
                  waitlistCurrentSize: 0,
                  capacity: 30,
                  currentlyEnrolled: 26,
                },
                classMeetings: [
                  {
                    meetingType: "CLASS",
                    meetingTimeStart: 28800000,
                    meetingTimeEnd: 32400000,
                    meetingDays: "MW",
                    startDate: 1788325200000,
                    endDate: 1796796000000,
                    room: "140",
                    building: {
                      buildingCode: "0140",
                      buildingName: "Grainger Hall",
                      streetAddress: "975 University Ave.",
                      latitude: 43.0727,
                      longitude: -89.4015,
                    },
                  },
                ],
              },
            ],
          },
          {
            id: "stat340-late",
            termCode: "1272",
            subjectCode: "220",
            courseId: "003210",
            enrollmentClassNumber: 33220,
            lastUpdated: 2000,
            onlineOnly: false,
            isAsynchronous: false,
            packageEnrollmentStatus: {
              status: "OPEN",
              availableSeats: 6,
              waitlistTotal: 0,
            },
            enrollmentStatus: {
              openSeats: 6,
              waitlistCurrentSize: 0,
              capacity: 30,
              currentlyEnrolled: 24,
            },
            sections: [
              {
                classUniqueId: { termCode: "1272", classNumber: 33221 },
                sectionNumber: "002",
                type: "LEC",
                instructionMode: "Classroom Instruction",
                sessionCode: "A1",
                published: true,
                enrollmentStatus: {
                  openSeats: 6,
                  waitlistCurrentSize: 0,
                  capacity: 30,
                  currentlyEnrolled: 24,
                },
                classMeetings: [
                  {
                    meetingType: "CLASS",
                    meetingTimeStart: 57600000,
                    meetingTimeEnd: 61200000,
                    meetingDays: "MW",
                    startDate: 1788325200000,
                    endDate: 1796796000000,
                    room: "141",
                    building: {
                      buildingCode: "0140",
                      buildingName: "Grainger Hall",
                      streetAddress: "975 University Ave.",
                      latitude: 43.0727,
                      longitude: -89.4015,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        course: {
          termCode: "1272",
          subjectCode: "302",
          courseId: "005770",
        },
        packages: [
          {
            id: "cs577-main",
            termCode: "1272",
            subjectCode: "302",
            courseId: "005770",
            enrollmentClassNumber: 55770,
            lastUpdated: 2000,
            onlineOnly: false,
            isAsynchronous: false,
            packageEnrollmentStatus: {
              status: "OPEN",
              availableSeats: 2,
              waitlistTotal: 0,
            },
            enrollmentStatus: {
              openSeats: 2,
              waitlistCurrentSize: 0,
              capacity: 20,
              currentlyEnrolled: 18,
            },
            sections: [
              {
                classUniqueId: { termCode: "1272", classNumber: 55771 },
                sectionNumber: "001",
                type: "LEC",
                instructionMode: "Classroom Instruction",
                sessionCode: "A1",
                published: true,
                instructors: [
                  {
                    name: { first: "Ada", last: "Lovelace" },
                    email: "ada@example.edu",
                  },
                ],
                enrollmentStatus: {
                  openSeats: 2,
                  waitlistCurrentSize: 0,
                  capacity: 20,
                  currentlyEnrolled: 18,
                },
                classMeetings: [
                  {
                    meetingType: "CLASS",
                    meetingTimeStart: 64800000,
                    meetingTimeEnd: 68400000,
                    meetingDays: "T",
                    startDate: 1788325200000,
                    endDate: 1796796000000,
                    room: "1240",
                    building: {
                      buildingCode: "0231",
                      buildingName: "Computer Sciences",
                      streetAddress: "1210 W Dayton St.",
                      latitude: 43.0715,
                      longitude: -89.4066,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
});
seedCourseDetailRows(fixture.db);

const originalSupabaseDatabaseUrl = process.env.SUPABASE_DATABASE_URL;
process.env.MADGRADES_DB_PATH = fixture.dbPath;
process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
afterEach(() => {
  process.env.MADGRADES_DB_PATH = fixture.dbPath;
  process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
  process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
  process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
  process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
  process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
  process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
  if (originalSupabaseDatabaseUrl === undefined) {
    delete process.env.SUPABASE_DATABASE_URL;
  } else {
    process.env.SUPABASE_DATABASE_URL = originalSupabaseDatabaseUrl;
  }
  __resetDbsForTests();
  __resetCourseDataCachesForTests();
});

after(() => {
  __resetDbsForTests();
  __resetCourseDataCachesForTests();
  fixture.cleanup();
});

function makeRuntimeSearchRows(): Record<string, unknown>[] {
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

function makeRuntimeCourseDetailRows(sqlText: string): Record<string, unknown>[] {
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
        summary_status: null,
        course_groups_json: null,
        escape_clauses_json: null,
        raw_text: null,
        unparsed_text: null,
      },
    ];
  }

  if (sqlText.includes("FROM prerequisite_rule_overview_v p")) {
    return [];
  }

  if (sqlText.includes("FROM section_overview_v") && sqlText.includes("ORDER BY section_type ASC")) {
    return [
      {
        section_class_number: 55771,
        source_package_id: "1272:302:005770:cs577-main",
        section_number: "001",
        section_type: "LEC",
        instruction_mode: "Classroom Instruction",
        session_code: "A1",
        open_seats: 2,
        waitlist_current_size: 0,
        capacity: 20,
        currently_enrolled: 18,
        has_open_seats: 1,
        has_waitlist: 0,
        is_full: 0,
      },
    ];
  }

  if (sqlText.includes("FROM schedule_planning_v")) {
    return [
      {
        section_class_number: 55771,
        source_package_id: "1272:302:005770:cs577-main",
        meeting_index: 0,
        meeting_type: "CLASS",
        meeting_days: "T",
        meeting_time_start: 64800000,
        meeting_time_end: 68400000,
        start_date: null,
        end_date: null,
        exam_date: null,
        room: "1240",
        building_code: "0231",
        building_name: "Computer Sciences",
        street_address: "1210 W Dayton St.",
        latitude: 43.0715,
        longitude: -89.4066,
        location_known: 1,
      },
    ];
  }

  if (sqlText.includes("FROM schedule_candidates_v")) {
    return [
      {
        source_package_id: "1272:302:005770:cs577-main",
        section_bundle_label: "COMP SCI 577 LEC 001",
        open_seats: 2,
        is_full: 0,
        has_waitlist: 0,
        campus_day_count: 1,
        meeting_summary_local: "T 12:00 PM-1:00 PM @ Computer Sciences",
        restriction_note: null,
      },
    ];
  }

  if (sqlText.includes("SELECT DISTINCT package_id, section_class_number")) {
    return [{ package_id: "1272:302:005770:cs577-main", section_class_number: 55771 }];
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

  throw new Error(`Unexpected runtime query in routes test: ${sqlText}`);
}

async function withSupabaseRuntimeRows<T>(
  rowsForQuery: (sqlText: string, args: unknown[], rawArgs: unknown[]) => Record<string, unknown>[],
  run: (queries: string[]) => Promise<T>,
): Promise<T> {
  process.env.SUPABASE_DATABASE_URL = "postgres://example.test/madgrades";
  process.env.MADGRADES_DB_PATH = `${fixture.dbPath}.missing`;
  process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}.missing`;
  process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
  process.env.MADGRADES_COURSE_REPLICA_PATH = `${fixture.dbPath}.missing`;
  process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}.missing`;
  process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
  process.env.MADGRADES_MADGRADES_REPLICA_PATH = `${fixture.dbPath}.missing`;
  __resetDbsForTests();
  __resetCourseDataCachesForTests();

  const runtimeDb = getRuntimePostgresDb();
  const queries: string[] = [];
  const originalUnsafe = runtimeDb.unsafe;
  runtimeDb.unsafe = (async (...rawArgs: unknown[]) => {
    const [sqlText, maybeArgs] = rawArgs as [string, unknown[]?];
    const args = Array.isArray(maybeArgs) ? maybeArgs : [];
    queries.push(sqlText);
    return rowsForQuery(sqlText, args, rawArgs);
  }) as typeof runtimeDb.unsafe;

  try {
    return await run(queries);
  } finally {
    runtimeDb.unsafe = originalUnsafe;
  }
}

function makeRuntimeScheduleRows(sqlText: string): Record<string, unknown>[] {
  if (sqlText.includes("FROM schedule_candidates_v")) {
    return [
      {
        course_designation: "STAT 340",
        title: "Data Science Modeling",
        source_package_id: "1272:220:003210:stat340-early",
        section_bundle_label: "STAT 340 LEC 001",
        open_seats: 4,
        is_full: 0,
        has_waitlist: 0,
        meeting_count: 1,
        campus_day_count: 2,
        earliest_start_minute_local: 480,
        latest_end_minute_local: 540,
        has_online_meeting: 0,
        has_unknown_location: 0,
        restriction_note: null,
        has_temporary_restriction: 0,
        meeting_summary_local: "MW 8:00 AM-9:00 AM @ Grainger Hall",
      },
      {
        course_designation: "COMP SCI 577",
        title: "Algorithms for Large Data",
        source_package_id: "1272:302:005770:cs577-main",
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
        meeting_summary_local: "T 12:00 PM-1:00 PM @ Computer Sciences",
      },
    ];
  }

  if (sqlText.includes("FROM canonical_meetings")) {
    return [
      {
        source_package_id: "1272:220:003210:stat340-early",
        meeting_days: "MW",
        meeting_time_start: 480,
        meeting_time_end: 540,
      },
      {
        source_package_id: "1272:302:005770:cs577-main",
        meeting_days: "T",
        meeting_time_start: 720,
        meeting_time_end: 780,
      },
    ];
  }

  throw new Error(`Unexpected schedule runtime query in routes test: ${sqlText}`);
}

test("course search route requires q or subject", async () => {
  const response = await searchCourses(new Request("https://example.test/api/courses/search"));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "At least one of q or subject is required.",
  });
});

test("course search route returns FTS-backed matches", async () => {
  const response = await searchCourses(new Request("https://example.test/api/courses/search?q=algorithms"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    courses: [
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
    ],
  });
});

test("course search route preserves its response shape when SUPABASE_DATABASE_URL is set", async () => {
  const expectedResponse = await searchCourses(
    new Request("https://example.test/api/courses/search?q=algorithms"),
  );
  const expectedBody = await expectedResponse.json();

  const response = await withSupabaseRuntimeRows(
    (sqlText) => {
      if (sqlText.includes("to_regclass('public.course_search_fts')")) {
        return [{ name: "course_search_fts" }];
      }

      if (sqlText.includes("FROM course_search_fts")) {
        return makeRuntimeSearchRows();
      }

      throw new Error(`Unexpected search runtime query in routes test: ${sqlText}`);
    },
    async (queries) => {
      const runtimeResponse = await searchCourses(
        new Request("https://example.test/api/courses/search?q=algorithms"),
      );
      assert.ok(queries.length > 0);
      return runtimeResponse;
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expectedBody);
});

test("course search route sends valid Postgres tsquery text when SUPABASE_DATABASE_URL is set", async () => {
  const response = await withSupabaseRuntimeRows(
    (sqlText, args) => {
      if (sqlText.includes("to_regclass('public.course_search_fts')")) {
        return [{ name: "course_search_fts" }];
      }

      if (sqlText.includes("FROM course_search_fts")) {
        assert.match(sqlText, /to_tsquery\('simple', \$1\)/);
        assert.match(sqlText, /ts @@ to_tsquery\('simple', \$2\)/);
        assert.match(sqlText, /MAX\(search_rank\) AS best_search_rank/);
        assert.match(sqlText, /best_search_rank DESC/);
        assert.equal(args[0], "algorithms:* & data:*");
        assert.equal(args[1], "algorithms:* & data:*");
        return makeRuntimeSearchRows();
      }

      throw new Error(`Unexpected search runtime query in routes test: ${sqlText}`);
    },
    async () => searchCourses(new Request("https://example.test/api/courses/search?q=algorithms%20data")),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    courses: [
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
    ],
  });
});

test("course search route returns a controlled empty list for punctuation-only queries", async () => {
  const response = await searchCourses(new Request("https://example.test/api/courses/search?q=%28%28%28"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    courses: [],
  });
});

test("course detail route returns 404 json for missing courses", async () => {
  const response = await getCourseDetail(new Request("https://example.test/api/courses/NOPE"), {
    params: Promise.resolve({ designation: "NOPE 999" }),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: "Course not found.",
  });
});

test("course detail route returns instructor grades for an existing course", async () => {
  const response = await getCourseDetail(
    new Request("https://example.test/api/courses/COMP%20SCI%20577"),
    {
      params: Promise.resolve({ designation: "COMP SCI 577" }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).instructor_grades, [
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

test("course detail route qualifies Madgrades tables on the Supabase runtime path", async () => {
  const response = await withSupabaseRuntimeRows(
    (sqlText) => {
      if (sqlText.includes("FROM madgrades_course_matches")) {
        assert.match(sqlText, /FROM madgrades\.madgrades_course_matches/);
      }

      if (sqlText.includes("WITH course_history AS")) {
        assert.match(sqlText, /FROM madgrades\.madgrades_course_offerings mco/);
        assert.match(sqlText, /FROM madgrades\.madgrades_course_grades mcg/);
        assert.match(sqlText, /FROM madgrades\.madgrades_instructor_matches mim/);
      }

      return makeRuntimeCourseDetailRows(sqlText);
    },
    async () => getCourseDetail(
      new Request("https://example.test/api/courses/COMP%20SCI%20577"),
      {
        params: Promise.resolve({ designation: "COMP SCI 577" }),
      },
    ),
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).instructor_grades[0]?.sameCourseGpa, 3.7);
});

test("schedule route uses the course database without requiring the compatibility db path", async () => {
  process.env.MADGRADES_DB_PATH = "/tmp/does-not-exist.sqlite";
  process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
  process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
  process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
  __resetDbsForTests();

  try {
    const response = await buildSchedules(
      new Request("https://example.test/api/schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courses: ["STAT 340", "COMP SCI 577"],
          limit: 1,
        }),
      }),
    );

    assert.equal(response.status, 200);
  } finally {
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    __resetDbsForTests();
  }
});

test("schedule route uses the production Postgres path when SUPABASE_DATABASE_URL is set", async () => {
  const response = await withSupabaseRuntimeRows(
    (sqlText) => makeRuntimeScheduleRows(sqlText),
    async (queries) => {
      const runtimeResponse = await buildSchedules(
        new Request("https://example.test/api/schedules", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            courses: ["STAT 340", "COMP SCI 577"],
            limit: 1,
          }),
        }),
      );
      assert.ok(queries.length > 0);
      assert.ok(queries.some((sqlText) => sqlText.includes("FROM schedule_candidates_v")));
      return runtimeResponse;
    },
  );

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.ok(Array.isArray(body.schedules));
  assert.equal(body.schedules.length, 1);
  assert.deepEqual(body.schedules[0].package_ids, [
    "1272:220:003210:stat340-early",
    "1272:302:005770:cs577-main",
  ]);
  assert.equal(body.schedules[0].packages.length, 2);
  assert.deepEqual(body.schedules[0].packages.map((pkg: { source_package_id: string }) => pkg.source_package_id), [
    "1272:220:003210:stat340-early",
    "1272:302:005770:cs577-main",
  ]);
  assert.equal(body.schedules[0].conflict_count, 0);
  assert.equal(body.schedules[0].campus_day_count, 3);
  assert.equal(body.schedules[0].earliest_start_minute_local, 480);
  assert.equal(body.schedules[0].latest_end_minute_local, 780);
  assert.equal(body.schedules[0].large_idle_gap_count, 0);
  assert.equal(body.schedules[0].tight_transition_count, 0);
  assert.equal(body.schedules[0].total_walking_distance_meters, 0);
  assert.equal(body.schedules[0].total_open_seats, 6);
  assert.equal(body.empty_state_reason, null);
});

test("schedule route ignores online-only meeting days in Postgres campus day counts and ordering", async () => {
  const response = await withSupabaseRuntimeRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling",
            source_package_id: "1272:220:003210:stat340-anchor",
            section_bundle_label: "STAT 340 LEC 001",
            open_seats: 4,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 600,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM @ Grainger Hall",
          },
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "1272:302:005770:cs577-z-online-extra-day",
            section_bundle_label: "COMP SCI 577 LEC 001",
            open_seats: 2,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 2,
            campus_day_count: 2,
            earliest_start_minute_local: 720,
            latest_end_minute_local: 780,
            has_online_meeting: 1,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "T 12:00 PM-1:00 PM @ Computer Sciences; F 12:00 PM-1:00 PM Online",
          },
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "1272:302:005770:cs577-a-three-campus-days",
            section_bundle_label: "COMP SCI 577 LEC 002",
            open_seats: 2,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 2,
            campus_day_count: 2,
            earliest_start_minute_local: 720,
            latest_end_minute_local: 780,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "TR 12:00 PM-1:00 PM @ Computer Sciences",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [
          {
            source_package_id: "1272:220:003210:stat340-anchor",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
            start_date: null,
            end_date: null,
            exam_date: null,
            instruction_mode: "IN PERSON",
            latitude: 43.0727,
            longitude: -89.4015,
            location_known: 1,
          },
          {
            source_package_id: "1272:302:005770:cs577-z-online-extra-day",
            meeting_days: "T",
            meeting_time_start: 720,
            meeting_time_end: 780,
            start_date: null,
            end_date: null,
            exam_date: null,
            instruction_mode: "IN PERSON",
            latitude: 43.0719,
            longitude: -89.4082,
            location_known: 1,
          },
          {
            source_package_id: "1272:302:005770:cs577-z-online-extra-day",
            meeting_days: "F",
            meeting_time_start: 720,
            meeting_time_end: 780,
            start_date: null,
            end_date: null,
            exam_date: null,
            instruction_mode: "ONLINE",
            latitude: null,
            longitude: null,
            location_known: 0,
          },
          {
            source_package_id: "1272:302:005770:cs577-a-three-campus-days",
            meeting_days: "TR",
            meeting_time_start: 720,
            meeting_time_end: 780,
            start_date: null,
            end_date: null,
            exam_date: null,
            instruction_mode: "IN PERSON",
            latitude: 43.0719,
            longitude: -89.4082,
            location_known: 1,
          },
        ];
      }

      throw new Error(`Unexpected schedule runtime query in routes test: ${sqlText}`);
    },
    async () => buildSchedules(
      new Request("https://example.test/api/schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courses: ["STAT 340", "COMP SCI 577"],
          limit: 2,
          preference_order: ["fewer-campus-days"],
        }),
      }),
    ),
  );

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.deepEqual(body.schedules[0].package_ids, [
    "1272:220:003210:stat340-anchor",
    "1272:302:005770:cs577-z-online-extra-day",
  ]);
  assert.equal(body.schedules[0].campus_day_count, 2);
  assert.deepEqual(body.schedules[1].package_ids, [
    "1272:220:003210:stat340-anchor",
    "1272:302:005770:cs577-a-three-campus-days",
  ]);
  assert.equal(body.schedules[1].campus_day_count, 3);
});

test("schedule route computes Postgres transition tie-breakers from meeting locations", async () => {
  const response = await withSupabaseRuntimeRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling",
            source_package_id: "1272:220:003210:stat340-anchor",
            section_bundle_label: "STAT 340 LEC 001",
            open_seats: 4,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 600,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM @ Grainger Hall",
          },
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "1272:302:005770:cs577-a-far-walk",
            section_bundle_label: "COMP SCI 577 LEC 001",
            open_seats: 2,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 614,
            latest_end_minute_local: 674,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 10:14 AM-11:14 AM @ Van Vleck Hall",
          },
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "1272:302:005770:cs577-z-short-walk",
            section_bundle_label: "COMP SCI 577 LEC 002",
            open_seats: 2,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 614,
            latest_end_minute_local: 674,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 10:14 AM-11:14 AM @ Grainger Hall",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [
          {
            source_package_id: "1272:220:003210:stat340-anchor",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
            start_date: null,
            end_date: null,
            exam_date: null,
            instruction_mode: "IN PERSON",
            latitude: 43.0727,
            longitude: -89.4015,
            location_known: 1,
          },
          {
            source_package_id: "1272:302:005770:cs577-a-far-walk",
            meeting_days: "M",
            meeting_time_start: 614,
            meeting_time_end: 674,
            start_date: null,
            end_date: null,
            exam_date: null,
            instruction_mode: "IN PERSON",
            latitude: 43.076,
            longitude: -89.412,
            location_known: 1,
          },
          {
            source_package_id: "1272:302:005770:cs577-z-short-walk",
            meeting_days: "M",
            meeting_time_start: 614,
            meeting_time_end: 674,
            start_date: null,
            end_date: null,
            exam_date: null,
            instruction_mode: "IN PERSON",
            latitude: 43.0727,
            longitude: -89.4015,
            location_known: 1,
          },
        ];
      }

      throw new Error(`Unexpected schedule runtime query in routes test: ${sqlText}`);
    },
    async () => buildSchedules(
      new Request("https://example.test/api/schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courses: ["STAT 340", "COMP SCI 577"],
          limit: 2,
        }),
      }),
    ),
  );

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.deepEqual(body.schedules[0].package_ids, [
    "1272:220:003210:stat340-anchor",
    "1272:302:005770:cs577-z-short-walk",
  ]);
  assert.equal(body.schedules[0].tight_transition_count, 0);
  assert.equal(body.schedules[0].total_walking_distance_meters, 0);
  assert.deepEqual(body.schedules[1].package_ids, [
    "1272:220:003210:stat340-anchor",
    "1272:302:005770:cs577-a-far-walk",
  ]);
  assert.equal(body.schedules[1].tight_transition_count, 1);
  assert(body.schedules[1].total_walking_distance_meters > 200);
});

test("schedule route dedupes equivalent visible Postgres schedules", async () => {
  const response = await withSupabaseRuntimeRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "1272:302:005770:cs577-z-duplicate",
            section_bundle_label: "COMP SCI 577 LEC 001",
            open_seats: 1,
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
            meeting_summary_local: "T 12:00 PM-1:00 PM @ Computer Sciences",
          },
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "1272:302:005770:cs577-a-duplicate",
            section_bundle_label: "COMP SCI 577 LEC 001",
            open_seats: 4,
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
            meeting_summary_local: "T 12:00 PM-1:00 PM @ Computer Sciences",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [
          {
            source_package_id: "1272:302:005770:cs577-z-duplicate",
            meeting_days: "T",
            meeting_time_start: 720,
            meeting_time_end: 780,
            start_date: null,
            end_date: null,
            exam_date: null,
            instruction_mode: "IN PERSON",
            latitude: 43.0719,
            longitude: -89.4082,
            location_known: 1,
          },
          {
            source_package_id: "1272:302:005770:cs577-a-duplicate",
            meeting_days: "T",
            meeting_time_start: 720,
            meeting_time_end: 780,
            start_date: null,
            end_date: null,
            exam_date: null,
            instruction_mode: "IN PERSON",
            latitude: 43.0719,
            longitude: -89.4082,
            location_known: 1,
          },
        ];
      }

      throw new Error(`Unexpected schedule runtime query in routes test: ${sqlText}`);
    },
    async () => buildSchedules(
      new Request("https://example.test/api/schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courses: ["COMP SCI 577"],
          limit: 2,
        }),
      }),
    ),
  );

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.schedules.length, 1);
  assert.deepEqual(body.schedules[0].package_ids, ["1272:302:005770:cs577-a-duplicate"]);
});

test("schedule route rejects overlapping Postgres packages using canonical meeting rows", async () => {
  const response = await withSupabaseRuntimeRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling",
            source_package_id: "1272:220:003210:stat340-overlap",
            section_bundle_label: "STAT 340 LEC 001",
            open_seats: 4,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 600,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM @ Grainger Hall",
          },
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "1272:302:005770:cs577-overlap",
            section_bundle_label: "COMP SCI 577 LEC 001",
            open_seats: 2,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 570,
            latest_end_minute_local: 630,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:30 AM-10:30 AM @ Computer Sciences",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [
          {
            source_package_id: "1272:220:003210:stat340-overlap",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
          },
          {
            source_package_id: "1272:302:005770:cs577-overlap",
            meeting_days: "M",
            meeting_time_start: 570,
            meeting_time_end: 630,
          },
        ];
      }

      throw new Error(`Unexpected schedule runtime query in routes test: ${sqlText}`);
    },
    async (queries) => {
      const runtimeResponse = await buildSchedules(
        new Request("https://example.test/api/schedules", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            courses: ["STAT 340", "COMP SCI 577"],
            limit: 5,
          }),
        }),
      );
      assert.ok(queries.some((sqlText) => sqlText.includes("FROM schedule_candidates_v")));
      assert.ok(queries.some((sqlText) => sqlText.includes("FROM canonical_meetings")));
      return runtimeResponse;
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    schedules: [],
    empty_state_reason: "constraints",
  });
});

test("schedule route ignores timed non-class Postgres rows when checking conflicts", async () => {
  const response = await withSupabaseRuntimeRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling",
            source_package_id: "1272:220:003210:stat340-class",
            section_bundle_label: "STAT 340 LEC 001",
            open_seats: 4,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 600,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM @ Grainger Hall",
          },
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "1272:302:005770:cs577-class-with-exam",
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
            meeting_summary_local: "W 12:00 PM-1:00 PM @ Computer Sciences",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        const classOnlyQuery = sqlText.includes("meeting_type = 'CLASS'");

        return [
          {
            source_package_id: "1272:220:003210:stat340-class",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
            start_date: null,
            end_date: null,
            exam_date: null,
          },
          {
            source_package_id: "1272:302:005770:cs577-class-with-exam",
            meeting_days: "W",
            meeting_time_start: 720,
            meeting_time_end: 780,
            start_date: null,
            end_date: null,
            exam_date: null,
          },
          ...(!classOnlyQuery
            ? [
                {
                  source_package_id: "1272:302:005770:cs577-class-with-exam",
                  meeting_days: "M",
                  meeting_time_start: 570,
                  meeting_time_end: 630,
                  start_date: null,
                  end_date: null,
                  exam_date: 1733702400000,
                },
              ]
            : []),
        ];
      }

      throw new Error(`Unexpected schedule runtime query in routes test: ${sqlText}`);
    },
    async (queries) => {
      const runtimeResponse = await buildSchedules(
        new Request("https://example.test/api/schedules", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            courses: ["STAT 340", "COMP SCI 577"],
            limit: 5,
          }),
        }),
      );
      assert.ok(queries.some((sqlText) => sqlText.includes("FROM canonical_meetings")));
      return runtimeResponse;
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).schedules[0].package_ids, [
    "1272:220:003210:stat340-class",
    "1272:302:005770:cs577-class-with-exam",
  ]);
});

test("schedule route keeps locked Postgres packages even when they are closed or waitlisted", async () => {
  const response = await withSupabaseRuntimeRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        if (sqlText.includes("COALESCE(is_full, 0) = 0") || sqlText.includes("COALESCE(has_waitlist, 0) = 0")) {
          return [
            {
              course_designation: "COMP SCI 577",
              title: "Algorithms for Large Data",
              source_package_id: "1272:302:005770:cs577-open",
              section_bundle_label: "COMP SCI 577 LEC 002",
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
              meeting_summary_local: "W 12:00 PM-1:00 PM @ Computer Sciences",
            },
          ];
        }

        return [
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling",
            source_package_id: "1272:220:003210:stat340-open",
            section_bundle_label: "STAT 340 LEC 001",
            open_seats: 5,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 600,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM @ Grainger Hall",
          },
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "1272:302:005770:cs577-locked-closed",
            section_bundle_label: "COMP SCI 577 LEC 001",
            open_seats: 0,
            is_full: 1,
            has_waitlist: 1,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 720,
            latest_end_minute_local: 780,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "W 12:00 PM-1:00 PM @ Computer Sciences",
          },
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "1272:302:005770:cs577-open",
            section_bundle_label: "COMP SCI 577 LEC 002",
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
            meeting_summary_local: "W 12:00 PM-1:00 PM @ Computer Sciences",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [
          {
            source_package_id: "1272:220:003210:stat340-open",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
            start_date: null,
            end_date: null,
            exam_date: null,
          },
          {
            source_package_id: "1272:302:005770:cs577-locked-closed",
            meeting_days: "W",
            meeting_time_start: 720,
            meeting_time_end: 780,
            start_date: null,
            end_date: null,
            exam_date: null,
          },
          {
            source_package_id: "1272:302:005770:cs577-open",
            meeting_days: "W",
            meeting_time_start: 720,
            meeting_time_end: 780,
            start_date: null,
            end_date: null,
            exam_date: null,
          },
        ];
      }

      throw new Error(`Unexpected schedule runtime query in routes test: ${sqlText}`);
    },
    async () => buildSchedules(
      new Request("https://example.test/api/schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courses: ["STAT 340", "COMP SCI 577"],
          lock_packages: ["1272:302:005770:cs577-locked-closed"],
          limit: 5,
        }),
      }),
    ),
  );

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).schedules[0].package_ids, [
    "1272:220:003210:stat340-open",
    "1272:302:005770:cs577-locked-closed",
  ]);
});

test("schedule route allows overlapping Postgres meeting times when date ranges do not overlap", async () => {
  const response = await withSupabaseRuntimeRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling",
            source_package_id: "1272:220:003210:stat340-first-half",
            section_bundle_label: "STAT 340 LEC 001",
            open_seats: 4,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 600,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM @ Grainger Hall",
          },
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "1272:302:005770:cs577-second-half",
            section_bundle_label: "COMP SCI 577 LEC 001",
            open_seats: 2,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 570,
            latest_end_minute_local: 630,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:30 AM-10:30 AM @ Computer Sciences",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [
          {
            source_package_id: "1272:220:003210:stat340-first-half",
            meeting_days: "M",
            meeting_time_start: 540,
            meeting_time_end: 600,
            start_date: 10,
            end_date: 20,
            exam_date: null,
          },
          {
            source_package_id: "1272:302:005770:cs577-second-half",
            meeting_days: "M",
            meeting_time_start: 570,
            meeting_time_end: 630,
            start_date: 30,
            end_date: 40,
            exam_date: null,
          },
        ];
      }

      throw new Error(`Unexpected schedule runtime query in routes test: ${sqlText}`);
    },
    async () => buildSchedules(
      new Request("https://example.test/api/schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courses: ["STAT 340", "COMP SCI 577"],
          limit: 5,
        }),
      }),
    ),
  );

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).schedules[0].package_ids, [
    "1272:220:003210:stat340-first-half",
    "1272:302:005770:cs577-second-half",
  ]);
});

test("schedule route computes fewer-long-gaps from normalized meeting minutes on the Postgres path", async () => {
  const response = await withSupabaseRuntimeRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "STAT 340",
            title: "Data Science Modeling",
            source_package_id: "1272:220:003210:stat340-anchor",
            section_bundle_label: "STAT 340 LEC 001",
            open_seats: 4,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 2,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 870,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 9:00 AM-10:00 AM and 1:30 PM-2:30 PM @ Grainger Hall",
          },
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "1272:302:005770:cs577-a-worse-gap",
            section_bundle_label: "COMP SCI 577 LEC 001",
            open_seats: 2,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 600,
            latest_end_minute_local: 630,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 10:00 AM-10:30 AM @ Computer Sciences",
          },
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "1272:302:005770:cs577-z-better-gap",
            section_bundle_label: "COMP SCI 577 LEC 002",
            open_seats: 2,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 630,
            latest_end_minute_local: 730,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "M 10:30 AM-12:10 PM @ Computer Sciences",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [
          {
            source_package_id: "1272:220:003210:stat340-anchor",
            meeting_days: "M",
            meeting_time_start: 54000000,
            meeting_time_end: 57600000,
            start_date: null,
            end_date: null,
            exam_date: null,
          },
          {
            source_package_id: "1272:220:003210:stat340-anchor",
            meeting_days: "M",
            meeting_time_start: 66600000,
            meeting_time_end: 70200000,
            start_date: null,
            end_date: null,
            exam_date: null,
          },
          {
            source_package_id: "1272:302:005770:cs577-a-worse-gap",
            meeting_days: "M",
            meeting_time_start: 57600000,
            meeting_time_end: 59400000,
            start_date: null,
            end_date: null,
            exam_date: null,
          },
          {
            source_package_id: "1272:302:005770:cs577-z-better-gap",
            meeting_days: "M",
            meeting_time_start: 59400000,
            meeting_time_end: 65400000,
            start_date: null,
            end_date: null,
            exam_date: null,
          },
        ];
      }

      throw new Error(`Unexpected schedule runtime query in routes test: ${sqlText}`);
    },
    async () => buildSchedules(
      new Request("https://example.test/api/schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courses: ["STAT 340", "COMP SCI 577"],
          limit: 2,
          preference_order: ["fewer-long-gaps"],
        }),
      }),
    ),
  );

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.deepEqual(body.schedules[0].package_ids, [
    "1272:220:003210:stat340-anchor",
    "1272:302:005770:cs577-z-better-gap",
  ]);
  assert.equal(body.schedules[0].large_idle_gap_count, 0);
  assert.deepEqual(body.schedules[1].package_ids, [
    "1272:220:003210:stat340-anchor",
    "1272:302:005770:cs577-a-worse-gap",
  ]);
  assert.equal(body.schedules[1].large_idle_gap_count, 1);
});

test("schedule route rejects blank course strings with 400 json", async () => {
  const response = await buildSchedules(
    new Request("https://example.test/api/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courses: ["   "],
      }),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "courses must be a non-empty array of up to 8 course strings.",
  });
});

test("schedule route returns hard-filter empty-state metadata when schedule limits remove all valid schedules", async () => {
  const response = await withSupabaseRuntimeRows(
    (sqlText) => {
      if (sqlText.includes("FROM schedule_candidates_v")) {
        return [
          {
            course_designation: "COMP SCI 577",
            title: "Algorithms for Large Data",
            source_package_id: "1272:302:005770:cs577-midday",
            section_bundle_label: "COMP SCI 577 LEC 001",
            open_seats: 2,
            is_full: 0,
            has_waitlist: 0,
            meeting_count: 1,
            campus_day_count: 1,
            earliest_start_minute_local: 540,
            latest_end_minute_local: 600,
            has_online_meeting: 0,
            has_unknown_location: 0,
            restriction_note: null,
            has_temporary_restriction: 0,
            meeting_summary_local: "T 9:00 AM-10:00 AM @ Computer Sciences",
          },
        ];
      }

      if (sqlText.includes("FROM canonical_meetings")) {
        return [
          {
            source_package_id: "1272:302:005770:cs577-midday",
            meeting_days: "T",
            meeting_time_start: 540,
            meeting_time_end: 600,
          },
        ];
      }

      throw new Error(`Unexpected schedule runtime query in routes test: ${sqlText}`);
    },
    async () => buildSchedules(
      new Request("https://example.test/api/schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courses: ["COMP SCI 577"],
          limit: 5,
          start_after_minute_local: 600,
          preference_order: ["later-starts"],
        }),
      }),
    ),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    schedules: [],
    empty_state_reason: "hard-filters",
  });
});

test("schedule route forwards hard-filter fields through the SQLite schedule path", async () => {
  delete process.env.SUPABASE_DATABASE_URL;
  __resetDbsForTests();

  const response = await buildSchedules(
    new Request("https://example.test/api/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courses: ["STAT 340", "COMP SCI 577"],
        limit: 1,
        preference_order: ["earlier-finishes"],
        start_after_minute_local: 600,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).schedules[0].package_ids, [
    "1272:220:003210:stat340-late",
    "1272:302:005770:cs577-main",
  ]);
});

test("schedule route forwards max_campus_days through the SQLite schedule path", async () => {
  delete process.env.SUPABASE_DATABASE_URL;
  __resetDbsForTests();

  const response = await buildSchedules(
    new Request("https://example.test/api/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courses: ["STAT 340", "COMP SCI 577"],
        limit: 5,
        max_campus_days: 2,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    schedules: [],
    empty_state_reason: "hard-filters",
  });
});

test("schedule route forwards end_before_minute_local through the SQLite schedule path", async () => {
  delete process.env.SUPABASE_DATABASE_URL;
  __resetDbsForTests();

  const response = await buildSchedules(
    new Request("https://example.test/api/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courses: ["STAT 340"],
        limit: 1,
        preference_order: ["later-starts"],
        end_before_minute_local: 600,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).schedules[0].package_ids, ["1272:220:003210:stat340-early"]);
});

test("course detail route preserves its response shape when SUPABASE_DATABASE_URL is set", async () => {
  const expectedResponse = await getCourseDetail(
    new Request("https://example.test/api/courses/COMP%20SCI%20577"),
    {
      params: Promise.resolve({ designation: "COMP SCI 577" }),
    },
  );
  const expectedBody = await expectedResponse.json();

  const response = await withSupabaseRuntimeRows(
    (sqlText) => makeRuntimeCourseDetailRows(sqlText),
    async (queries) => {
      const runtimeResponse = await getCourseDetail(
        new Request("https://example.test/api/courses/COMP%20SCI%20577"),
        {
          params: Promise.resolve({ designation: "COMP SCI 577" }),
        },
      );
      assert.ok(queries.length > 0);
      return runtimeResponse;
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expectedBody);
});

test("course detail route still returns Madgrades-backed instructor history when SUPABASE_DATABASE_URL is set", async () => {
  const response = await withSupabaseRuntimeRows(
    (sqlText) => makeRuntimeCourseDetailRows(sqlText),
    async (queries) => {
      const runtimeResponse = await getCourseDetail(
        new Request("https://example.test/api/courses/COMP%20SCI%20577"),
        {
          params: Promise.resolve({ designation: "COMP SCI 577" }),
        },
      );
      assert.ok(queries.some((sqlText) => sqlText.includes("WITH course_history AS")));
      return runtimeResponse;
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).instructor_grades, [
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

test("schedule route rejects non-object json bodies with 400 json", async () => {
  const response = await buildSchedules(
    new Request("https://example.test/api/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "null",
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid schedule request body.",
  });
});

test("schedule route accepts limit zero and returns no schedules", async () => {
  const response = await buildSchedules(
    new Request("https://example.test/api/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courses: ["COMP SCI 577"],
        limit: 0,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    schedules: [],
    empty_state_reason: "constraints",
  });
});

test("normalizePreferenceOrderInput fills defaults and filters invalid values", () => {
  assert.deepEqual(normalizePreferenceOrderInput(undefined), DEFAULT_PREFERENCE_ORDER);
  assert.deepEqual(normalizePreferenceOrderInput([]), []);
  assert.deepEqual(
    normalizePreferenceOrderInput(["fewer-long-gaps", "invalid", "fewer-long-gaps"]),
    ["less-time-between-classes"],
  );
  assert.equal(normalizePreferenceOrderInput(123), null);
});

test("normalizeBooleanInput defaults undefined to false", () => {
  assert.equal(normalizeBooleanInput(undefined), false);
});

test("normalizeBooleanInput accepts true and false", () => {
  assert.equal(normalizeBooleanInput(true), true);
  assert.equal(normalizeBooleanInput(false), false);
});

test("normalizeBooleanInput rejects non-booleans", () => {
  assert.equal(normalizeBooleanInput("true"), null);
  assert.equal(normalizeBooleanInput(1), null);
});

test("normalizeNullableIntegerInput accepts undefined and null but rejects strings", () => {
  assert.equal(normalizeNullableIntegerInput(undefined), null);
  assert.equal(normalizeNullableIntegerInput(null), null);
  assert.equal(normalizeNullableIntegerInput(540), 540);
  assert.equal(normalizeNullableIntegerInput("540"), null);
});

test("normalizeNullableIntegerField reports validity alongside the normalized value", () => {
  assert.deepEqual(normalizeNullableIntegerField(undefined), { value: null, isValid: true });
  assert.deepEqual(normalizeNullableIntegerField(null), { value: null, isValid: true });
  assert.deepEqual(normalizeNullableIntegerField(540), { value: 540, isValid: true });
  assert.deepEqual(normalizeNullableIntegerField(-1), { value: null, isValid: false });
  assert.deepEqual(normalizeNullableIntegerField("540"), { value: null, isValid: false });
});

const validNormalizedSchedulePackage = {
  source_package_id: "1272:302:005770:cs577-main",
  course_designation: "COMP SCI 577",
  title: "Algorithms for Large Data",
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
  meeting_summary_local: "T 12:00 PM-1:00 PM @ Computer Sciences",
};

test("normalizeScheduleGenerationResult preserves valid results and rejects malformed ones", () => {
  const schedules = [
    {
      package_ids: ["1272:302:005770:cs577-main"],
      packages: [
        validNormalizedSchedulePackage,
      ],
      conflict_count: 0,
      campus_day_count: 3,
      earliest_start_minute_local: 480,
      large_idle_gap_count: 0,
      total_between_class_minutes: 0,
      tight_transition_count: 0,
      total_walking_distance_meters: 0,
      total_open_seats: 6,
      latest_end_minute_local: 780,
    },
  ];

  assert.throws(
    () => normalizeScheduleGenerationResult(schedules),
    /Invalid schedule generation result/,
  );
  assert.deepEqual(
    normalizeScheduleGenerationResult({
      schedules,
      emptyStateReason: "hard-filters",
    }),
    {
      schedules,
      emptyStateReason: "hard-filters",
    },
  );
});

test("normalizeScheduleGenerationResult rejects malformed schedule entries inside a valid wrapper", () => {
  assert.throws(
    () =>
      normalizeScheduleGenerationResult({
        schedules: [
          {
            packages: [],
            conflict_count: 0,
            campus_day_count: 3,
            earliest_start_minute_local: 480,
            large_idle_gap_count: 0,
            total_between_class_minutes: 0,
            tight_transition_count: 0,
            total_walking_distance_meters: 0,
            total_open_seats: 6,
            latest_end_minute_local: 780,
          },
        ],
        emptyStateReason: null,
      }),
    /Invalid schedule generation result/,
  );
});

test("normalizeScheduleGenerationResult rejects malformed nested package entries inside a valid wrapper", () => {
  assert.throws(
    () =>
      normalizeScheduleGenerationResult({
        schedules: [
          {
            package_ids: ["1272:302:005770:cs577-main"],
            packages: [
              {
                source_package_id: "1272:302:005770:cs577-main",
              },
            ],
            conflict_count: 0,
            campus_day_count: 3,
            earliest_start_minute_local: 480,
            large_idle_gap_count: 0,
            total_between_class_minutes: 0,
            tight_transition_count: 0,
            total_walking_distance_meters: 0,
            total_open_seats: 6,
            latest_end_minute_local: 780,
          },
        ],
        emptyStateReason: null,
      }),
    /Invalid schedule generation result/,
  );
});

test("normalizeScheduleGenerationResult rejects mismatched package_ids and nested source_package_id values", () => {
  assert.throws(
    () =>
      normalizeScheduleGenerationResult({
        schedules: [
          {
            package_ids: ["1272:302:005770:cs577-main"],
            packages: [
              {
                ...validNormalizedSchedulePackage,
                source_package_id: "1272:302:005770:cs577-other",
              },
            ],
            conflict_count: 0,
            campus_day_count: 3,
            earliest_start_minute_local: 480,
            large_idle_gap_count: 0,
            total_between_class_minutes: 0,
            tight_transition_count: 0,
            total_walking_distance_meters: 0,
            total_open_seats: 6,
            latest_end_minute_local: 780,
          },
        ],
        emptyStateReason: null,
      }),
    /Invalid schedule generation result/,
  );
});

test("normalizeScheduleGenerationResult rejects package entries that omit required nested fields", () => {
  assert.throws(
    () =>
      normalizeScheduleGenerationResult({
        schedules: [
          {
            package_ids: ["1272:302:005770:cs577-main"],
            packages: [
              {
                source_package_id: "1272:302:005770:cs577-main",
                course_designation: "COMP SCI 577",
              },
            ],
            conflict_count: 0,
            campus_day_count: 3,
            earliest_start_minute_local: 480,
            large_idle_gap_count: 0,
            total_between_class_minutes: 0,
            tight_transition_count: 0,
            total_walking_distance_meters: 0,
            total_open_seats: 6,
            latest_end_minute_local: 780,
          },
        ],
        emptyStateReason: null,
      }),
    /Invalid schedule generation result/,
  );
});

test("normalizeScheduleGenerationResult rejects non-finite numeric schedule metrics", () => {
  assert.throws(
    () =>
      normalizeScheduleGenerationResult({
        schedules: [
          {
            package_ids: ["1272:302:005770:cs577-main"],
            packages: [validNormalizedSchedulePackage],
            conflict_count: NaN,
            campus_day_count: 3,
            earliest_start_minute_local: 480,
            large_idle_gap_count: 0,
            total_between_class_minutes: 0,
            tight_transition_count: 0,
            total_walking_distance_meters: 0,
            total_open_seats: 6,
            latest_end_minute_local: 780,
          },
        ],
        emptyStateReason: null,
      }),
    /Invalid schedule generation result/,
  );
});

test("schedule route accepts a valid preference_order array", async () => {
  const response = await buildSchedules(
    new Request("https://example.test/api/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courses: ["COMP SCI 577"],
        limit: 0,
        preference_order: ["earlier-finishes", "later-starts"],
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    schedules: [],
    empty_state_reason: "constraints",
  });
});

test("schedule route accepts valid include_waitlisted and include_closed booleans", async () => {
  const response = await buildSchedules(
    new Request("https://example.test/api/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courses: ["COMP SCI 577"],
        limit: 0,
        include_waitlisted: true,
        include_closed: false,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    schedules: [],
    empty_state_reason: "constraints",
  });
});

test("schedule route rejects invalid non-boolean availability values", async () => {
  const response = await buildSchedules(
    new Request("https://example.test/api/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courses: ["COMP SCI 577"],
        include_waitlisted: "true",
        include_closed: 1,
      }),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid schedule request body.",
  });
});

test("schedule route rejects invalid numeric hard-filter values", async () => {
  const response = await buildSchedules(
    new Request("https://example.test/api/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courses: ["COMP SCI 577"],
        max_campus_days: -1,
        end_before_minute_local: "660",
      }),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid schedule request body.",
  });
});

test("schedule route accepts non-negative integer hard-filter values outside UI presets", async () => {
  const response = await buildSchedules(
    new Request("https://example.test/api/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courses: ["COMP SCI 577"],
        limit: 0,
        max_campus_days: 99,
        start_after_minute_local: 5000,
        end_before_minute_local: 9999,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    schedules: [],
    empty_state_reason: "constraints",
  });
});

test("schedule route accepts explicit null hard-filter values", async () => {
  const response = await buildSchedules(
    new Request("https://example.test/api/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courses: ["COMP SCI 577"],
        limit: 0,
        max_campus_days: null,
        start_after_minute_local: null,
        end_before_minute_local: null,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    schedules: [],
    empty_state_reason: "constraints",
  });
});

test("schedule route forwards normalized preference_order into non-empty generation", async () => {
  const response = await buildSchedules(
    new Request("https://example.test/api/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courses: ["STAT 340"],
        limit: 1,
        preference_order: ["earlier-finishes", "invalid"],
      }),
    }),
  );

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.schedules.length, 1);
  assert.deepEqual(body.schedules[0].package_ids, ["1272:220:003210:stat340-early"]);
  assert.equal(body.empty_state_reason, null);
});
