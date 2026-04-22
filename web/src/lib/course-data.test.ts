import { after, afterEach, test } from "node:test";
import assert from "node:assert/strict";

import { buildCourseDbFixture, makeCourse } from "../../../tests/helpers/madgrades-db-fixture.mjs";
import { __resetDbsForTests, getRuntimePostgresDb } from "./db";
import {
  __resetCourseDataCachesForTests,
  buildPostgresTsquery,
  generateSchedulesFromPostgres,
  generateSchedulesFromPostgresWithMetadata,
  getCourseDetail,
  normalizeDesignation,
  parseCourseGroupsJson,
  parseStringArrayJson,
  searchCourses,
} from "./course-data";

function buildCourseDataFixture() {
  return buildCourseDbFixture({
    courses: [
      {
        ...makeCourse({
          termCode: "1272",
          courseId: "005770",
          subjectCode: "302",
          catalogNumber: "577",
          courseDesignation: "COMP SCI 577",
          title: "Algorithms for Large Data",
        }),
        description: "Covers petabyte-scale systems and external-memory techniques.",
      },
      makeCourse({
        termCode: "1272",
        courseId: "023191",
        subjectCode: "302",
        catalogNumber: "102",
        courseDesignation: "COMP SCI 102",
        title: "Computing Ideas",
      }),
      makeCourse({
        termCode: "1272",
        courseId: "023191",
        subjectCode: "544",
        catalogNumber: "102",
        courseDesignation: "L I S 102",
        title: "Computing Ideas",
      }),
      makeCourse({
        termCode: "1272",
        courseId: "024200",
        subjectCode: "184",
        catalogNumber: "462",
        courseDesignation: "ASIAN AM 462",
        title: "Topic in Asian American Literature",
      }),
      makeCourse({
        termCode: "1272",
        courseId: "024200.2",
        subjectCode: "184",
        catalogNumber: "462",
        courseDesignation: "ASIAN AM 462",
        title: "Asian Americans and Sci Fi",
      }),
      makeCourse({
        termCode: "1272",
        courseId: "024200.5",
        subjectCode: "184",
        catalogNumber: "462",
        courseDesignation: "ASIAN AM 462",
        title: "Asian Am Creative Writing Wrk",
      }),
      makeCourse({
        termCode: "1272",
        courseId: "024200",
        subjectCode: "352",
        catalogNumber: "462",
        courseDesignation: "ENGL 462",
        title: "Topic in Asian American Literature",
      }),
    ],
    packageSnapshot: {
      termCode: "1272",
      results: [
        {
          course: {
            termCode: "1272",
            subjectCode: "302",
            courseId: "005770",
          },
          packages: [
            {
              id: "comp-sci-577-main",
              termCode: "1272",
              subjectCode: "302",
              courseId: "005770",
              enrollmentClassNumber: 57701,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: "OPEN",
                availableSeats: 3,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 3,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 27,
              },
              sections: [
                {
                  classUniqueId: { termCode: "1272", classNumber: 57701 },
                  sectionNumber: "001",
                  type: "LEC",
                  instructionMode: "IN PERSON",
                  sessionCode: "1",
                  published: true,
                  enrollmentStatus: {
                    openSeats: 3,
                    waitlistCurrentSize: 0,
                    capacity: 30,
                    currentlyEnrolled: 27,
                  },
                  instructors: [
                    {
                      name: { first: "Ada", last: "Lovelace" },
                      email: "ada@example.edu",
                    },
                  ],
                  classMeetings: [
                    {
                      meetingType: "CLASS",
                      meetingTimeStart: 54000000,
                      meetingTimeEnd: 59400000,
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
          ],
        },
        {
          course: {
            termCode: "1272",
            subjectCode: "184",
            courseId: "024200",
            catalogNumber: "462",
            courseDesignation: "ASIAN AM 462",
            title: "Topic in Asian American Literature",
          },
          packages: [
            {
              id: "asian-am-462-main",
              termCode: "1272",
              subjectCode: "184",
              courseId: "024200",
              enrollmentClassNumber: 46201,
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
                capacity: 15,
                currentlyEnrolled: 11,
              },
              sections: [
                {
                  classUniqueId: { termCode: "1272", classNumber: 46201 },
                  sectionNumber: "002",
                  type: "LEC",
                  instructionMode: "IN PERSON",
                  sessionCode: "1",
                  published: true,
                  enrollmentStatus: {
                    openSeats: 4,
                    waitlistCurrentSize: 0,
                    capacity: 15,
                    currentlyEnrolled: 11,
                  },
                  classMeetings: [
                    {
                      meetingType: "CLASS",
                      meetingTimeStart: 48000000,
                      meetingTimeEnd: 55200000,
                      meetingDays: "T",
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: "101",
                      building: {
                        buildingCode: "0101",
                        buildingName: "Levy Hall",
                        streetAddress: "425 Henry Mall",
                        latitude: 43.075,
                        longitude: -89.404,
                      },
                    },
                  ],
                },
                {
                  classUniqueId: { termCode: "1272", classNumber: 46202 },
                  sectionNumber: "001",
                  type: "LEC",
                  instructionMode: "IN PERSON",
                  sessionCode: "1",
                  published: true,
                  enrollmentStatus: {
                    openSeats: 0,
                    waitlistCurrentSize: 0,
                    capacity: 35,
                    currentlyEnrolled: 19,
                  },
                  classMeetings: [
                    {
                      meetingType: "CLASS",
                      meetingTimeStart: 39600000,
                      meetingTimeEnd: 44100000,
                      meetingDays: "TR",
                      startDate: 1788325200000,
                      endDate: 1796796000000,
                      room: "101",
                      building: {
                        buildingCode: "0101",
                        buildingName: "Levy Hall",
                        streetAddress: "425 Henry Mall",
                        latitude: 43.075,
                        longitude: -89.404,
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
            courseId: "023191",
            catalogNumber: "102",
            courseDesignation: "COMP SCI 102",
            title: "Computing Ideas",
          },
          packages: [
            {
              id: "comp-sci-102-main",
              termCode: "1272",
              subjectCode: "302",
              courseId: "023191",
              enrollmentClassNumber: 27344,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: "OPEN",
                availableSeats: 20,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 20,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 20,
              },
              sections: [
                {
                  classUniqueId: { termCode: "1272", classNumber: 27344 },
                  sectionNumber: "001",
                  type: "LEC",
                  instructionMode: "IN PERSON",
                  sessionCode: "1",
                  published: true,
                  enrollmentStatus: {
                    openSeats: 20,
                    waitlistCurrentSize: 0,
                    capacity: 30,
                    currentlyEnrolled: 20,
                  },
                  classMeetings: [
                    {
                      meetingType: "CLASS",
                      meetingTimeStart: 54000000,
                      meetingTimeEnd: 59400000,
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
          ],
        },
        {
          course: {
            termCode: "1272",
            subjectCode: "544",
            courseId: "023191",
            catalogNumber: "102",
            courseDesignation: "L I S 102",
            title: "Computing Ideas",
          },
          packages: [
            {
              id: "lis-102-main",
              termCode: "1272",
              subjectCode: "544",
              courseId: "023191",
              enrollmentClassNumber: 27534,
              lastUpdated: 2001,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: {
                status: "OPEN",
                availableSeats: 5,
                waitlistTotal: 0,
              },
              enrollmentStatus: {
                openSeats: 5,
                waitlistCurrentSize: 0,
                capacity: 30,
                currentlyEnrolled: 5,
              },
              enrollmentRequirementGroups: {
                classAssociationRequirementGroups: [
                  {
                    description: "Reserved for Information School majors.",
                  },
                ],
              },
              sections: [
                {
                  classUniqueId: { termCode: "1272", classNumber: 27534 },
                  sectionNumber: "001",
                  type: "LEC",
                  instructionMode: "IN PERSON",
                  sessionCode: "1",
                  published: true,
                  enrollmentStatus: {
                    openSeats: 5,
                    waitlistCurrentSize: 0,
                    capacity: 30,
                    currentlyEnrolled: 5,
                  },
                  classMeetings: [
                    {
                      meetingType: "CLASS",
                      meetingTimeStart: 54000000,
                      meetingTimeEnd: 59400000,
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
          ],
        },
      ],
    },
  });
}

function seedCourseDetailRows(db: import("better-sqlite3").Database) {
  const instructorKey = db.prepare(`
    SELECT instructor_key
    FROM instructors
    WHERE email = ?
  `).pluck().get("ada@example.edu");

  db.prepare(`
    INSERT INTO prerequisite_rules (
      rule_id,
      term_code,
      course_id,
      raw_text,
      parse_status,
      parse_confidence,
      root_node_id,
      unparsed_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "rule:comp-sci-577",
    "1272",
    "005770",
    "COMP SCI 400 and graduate/professional standing",
    "partial",
    0.75,
    null,
    "graduate/professional standing",
  );

  db.prepare(`
    INSERT INTO prerequisite_course_summaries (
      rule_id,
      term_code,
      course_id,
      summary_status,
      course_groups_json,
      escape_clauses_json
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    "rule:comp-sci-577",
    "1272",
    "005770",
    "partial",
    '[["COMP SCI 400"]]',
    '["graduate/professional standing"]',
  );

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
  `).run(11, "2024-01-15T00:00:00Z", "2024-01-16T00:00:00Z", "1272", "web course data test");

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

function seedTopicVariantRows(db: import("better-sqlite3").Database) {
  const insertPackage = db.prepare(`
    INSERT INTO packages (
      package_id,
      term_code,
      subject_code,
      course_id,
      package_last_updated,
      enrollment_class_number,
      package_status,
      package_available_seats,
      package_waitlist_total,
      online_only,
      is_asynchronous,
      open_seats,
      waitlist_current_size,
      capacity,
      currently_enrolled,
      has_open_seats,
      has_waitlist,
      is_full
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPackage.run(
    "1272:184:024200.2:46201",
    "1272",
    "184",
    "024200.2",
    3000,
    46201,
    "CLOSED",
    0,
    0,
    0,
    0,
    0,
    0,
    35,
    19,
    0,
    0,
    1,
  );
  insertPackage.run(
    "1272:184:024200.5:46202",
    "1272",
    "184",
    "024200.5",
    3001,
    46202,
    "OPEN",
    4,
    0,
    0,
    0,
    4,
    0,
    15,
    11,
    1,
    0,
    0,
  );

  const insertSection = db.prepare(`
    INSERT INTO sections (
      package_id,
      section_class_number,
      term_code,
      course_id,
      section_number,
      section_type,
      instruction_mode,
      session_code,
      published,
      open_seats,
      waitlist_current_size,
      capacity,
      currently_enrolled,
      has_open_seats,
      has_waitlist,
      is_full
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSection.run(
    "1272:184:024200.2:46201",
    46201,
    "1272",
    "024200",
    "001",
    "LEC",
    "IN PERSON",
    "1",
    1,
    0,
    0,
    35,
    19,
    0,
    0,
    1,
  );
  insertSection.run(
    "1272:184:024200.5:46202",
    46202,
    "1272",
    "024200",
    "002",
    "LEC",
    "IN PERSON",
    "1",
    1,
    4,
    0,
    15,
    11,
    1,
    0,
    0,
  );

  const insertSchedulablePackage = db.prepare(`
    INSERT INTO schedulable_packages (
      source_package_id,
      term_code,
      course_id,
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSchedulablePackage.run(
    "1272:184:024200.2:46201",
    "1272",
    "024200",
    "ASIAN AM 462",
    "Topic in Asian American Literature",
    "ASIAN AM 462 LEC 001",
    0,
    1,
    0,
    1,
    2,
    660,
    735,
    0,
    0,
    null,
    0,
    "TR 11:00 AM-12:15 PM @ LEVY HALL",
  );
  insertSchedulablePackage.run(
    "1272:184:024200.5:46202",
    "1272",
    "024200",
    "ASIAN AM 462",
    "Topic in Asian American Literature",
    "ASIAN AM 462 LEC 002",
    4,
    0,
    0,
    1,
    1,
    800,
    915,
    0,
    0,
    null,
    0,
    "T 1:20 PM-3:15 PM @ LEVY HALL",
  );
}

const fixture = buildCourseDataFixture();
seedCourseDetailRows(fixture.db);
seedTopicVariantRows(fixture.db);
const originalSupabaseDatabaseUrl = process.env.SUPABASE_DATABASE_URL;
process.env.MADGRADES_DB_PATH = fixture.dbPath;
process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
afterEach(() => {
  if (originalSupabaseDatabaseUrl === undefined) {
    delete process.env.SUPABASE_DATABASE_URL;
  } else {
    process.env.SUPABASE_DATABASE_URL = originalSupabaseDatabaseUrl;
  }
});

after(() => {
  __resetDbsForTests();
  __resetCourseDataCachesForTests();
  fixture.cleanup();
});

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

test("searchCourses queries the shared course overview data", async () => {
  const results = await searchCourses({ query: "algorithms", subject: "comp sci", limit: 99 });

  assert.equal(results.length, 1);
  assert.deepEqual(results[0], {
    designation: "COMP SCI 577",
    title: "Algorithms for Large Data",
    minimumCredits: 3,
    maximumCredits: 3,
    crossListDesignations: ["COMP SCI 577"],
    sectionCount: 1,
    hasAnyOpenSeats: true,
    hasAnyWaitlist: false,
    hasAnyFullSection: false,
  });
});

test("searchCourses collapses duplicate designations and keeps the live offering", async () => {
  const results = await searchCourses({ query: "asian am 462", limit: 99 });

  assert.equal(results.length, 1);
  assert.deepEqual(results[0], {
    designation: "ASIAN AM 462",
    title: "Topic in Asian American Literature",
    minimumCredits: 3,
    maximumCredits: 3,
    crossListDesignations: ["ASIAN AM 462", "ENGL 462"],
    sectionCount: 2,
    hasAnyOpenSeats: true,
    hasAnyWaitlist: false,
    hasAnyFullSection: true,
  });
});

test("searchCourses matches cross-listed alias designations through the FTS index", async () => {
  const results = await searchCourses({ query: "engl 462", limit: 99 });

  assert.equal(results.length, 1);
  assert.deepEqual(results[0], {
    designation: "ASIAN AM 462",
    title: "Topic in Asian American Literature",
    minimumCredits: 3,
    maximumCredits: 3,
    crossListDesignations: ["ASIAN AM 462", "ENGL 462"],
    sectionCount: 2,
    hasAnyOpenSeats: true,
    hasAnyWaitlist: false,
    hasAnyFullSection: true,
  });
});

test("searchCourses falls back when the FTS table is missing", async () => {
  const compatibilityFixture = buildCourseDataFixture();

  try {
    compatibilityFixture.db.exec("DROP TABLE course_search_fts");
    compatibilityFixture.db.close();
    process.env.MADGRADES_DB_PATH = compatibilityFixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = compatibilityFixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = compatibilityFixture.dbPath;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();

    const results = await searchCourses({ query: "engl 462", limit: 99 });

    assert.equal(results.length, 1);
    assert.deepEqual(results[0], {
      designation: "ASIAN AM 462",
      title: "Topic in Asian American Literature",
      minimumCredits: 3,
      maximumCredits: 3,
      crossListDesignations: ["ASIAN AM 462", "ENGL 462"],
      sectionCount: 2,
      hasAnyOpenSeats: true,
      hasAnyWaitlist: false,
      hasAnyFullSection: true,
    });
  } finally {
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
    compatibilityFixture.cleanup();
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
  }
});

test("searchCourses fallback matches reordered alias tokens when the FTS table is missing", async () => {
  const compatibilityFixture = buildCourseDataFixture();

  try {
    compatibilityFixture.db.exec("DROP TABLE course_search_fts");
    compatibilityFixture.db.close();
    process.env.MADGRADES_DB_PATH = compatibilityFixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = compatibilityFixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = compatibilityFixture.dbPath;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();

    const results = await searchCourses({ query: "462 engl", limit: 99 });

    assert.equal(results.length, 1);
    assert.deepEqual(results[0], {
      designation: "ASIAN AM 462",
      title: "Topic in Asian American Literature",
      minimumCredits: 3,
      maximumCredits: 3,
      crossListDesignations: ["ASIAN AM 462", "ENGL 462"],
      sectionCount: 2,
      hasAnyOpenSeats: true,
      hasAnyWaitlist: false,
      hasAnyFullSection: true,
    });
  } finally {
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
    compatibilityFixture.cleanup();
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
  }
});

test("searchCourses fallback matches tokens split across alias and title when the FTS table is missing", async () => {
  const compatibilityFixture = buildCourseDataFixture();

  try {
    compatibilityFixture.db.exec("DROP TABLE course_search_fts");
    compatibilityFixture.db.close();
    process.env.MADGRADES_DB_PATH = compatibilityFixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = compatibilityFixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = compatibilityFixture.dbPath;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();

    const results = await searchCourses({ query: "engl literature", limit: 99 });

    assert.equal(results.length, 1);
    assert.deepEqual(results[0], {
      designation: "ASIAN AM 462",
      title: "Topic in Asian American Literature",
      minimumCredits: 3,
      maximumCredits: 3,
      crossListDesignations: ["ASIAN AM 462", "ENGL 462"],
      sectionCount: 2,
      hasAnyOpenSeats: true,
      hasAnyWaitlist: false,
      hasAnyFullSection: true,
    });
  } finally {
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
    compatibilityFixture.cleanup();
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
  }
});

test("searchCourses fallback matches description-only queries when the FTS table is missing", async () => {
  const compatibilityFixture = buildCourseDataFixture();

  try {
    compatibilityFixture.db.exec("DROP TABLE course_search_fts");
    compatibilityFixture.db.close();
    process.env.MADGRADES_DB_PATH = compatibilityFixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = compatibilityFixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = compatibilityFixture.dbPath;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();

    const results = await searchCourses({ query: "petabyte", limit: 99 });

    assert.equal(results.length, 1);
    assert.deepEqual(results[0], {
      designation: "COMP SCI 577",
      title: "Algorithms for Large Data",
      minimumCredits: 3,
      maximumCredits: 3,
      crossListDesignations: ["COMP SCI 577"],
      sectionCount: 1,
      hasAnyOpenSeats: true,
      hasAnyWaitlist: false,
      hasAnyFullSection: false,
    });
  } finally {
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
    compatibilityFixture.cleanup();
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
  }
});

test("searchCourses fallback does not return false positives from token precedence when the FTS table is missing", async () => {
  const compatibilityFixture = buildCourseDataFixture();

  try {
    compatibilityFixture.db.exec("DROP TABLE course_search_fts");
    compatibilityFixture.db.close();
    process.env.MADGRADES_DB_PATH = compatibilityFixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = compatibilityFixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = compatibilityFixture.dbPath;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();

    assert.deepEqual(await searchCourses({ query: "engl data", limit: 99 }), []);
  } finally {
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
    compatibilityFixture.cleanup();
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
  }
});

test("searchCourses fallback applies subject filtering when the FTS table is missing", async () => {
  const compatibilityFixture = buildCourseDataFixture();

  try {
    compatibilityFixture.db.exec("DROP TABLE course_search_fts");
    compatibilityFixture.db.close();
    process.env.MADGRADES_DB_PATH = compatibilityFixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = compatibilityFixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = compatibilityFixture.dbPath;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();

    const results = await searchCourses({ query: "literature", subject: "comp sci", limit: 99 });

    assert.deepEqual(results, []);
  } finally {
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
    compatibilityFixture.cleanup();
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
  }
});

test("searchCourses matches compact subject queries for spaced-letter aliases", async () => {
  const results = await searchCourses({ query: "lis 102", limit: 99 });

  assert.equal(results.length, 1);
  assert.deepEqual(results[0], {
    designation: "COMP SCI 102",
    title: "Computing Ideas",
    minimumCredits: 3,
    maximumCredits: 3,
    crossListDesignations: ["COMP SCI 102", "L I S 102"],
    sectionCount: 2,
    hasAnyOpenSeats: true,
    hasAnyWaitlist: false,
    hasAnyFullSection: false,
  });
});

test("searchCourses returns a controlled empty list for punctuation-only queries", async () => {
  assert.deepEqual(await searchCourses({ query: "((( )))", limit: 99 }), []);
});

test("searchCourses uses the course database without requiring the compatibility db path", async () => {
  process.env.MADGRADES_DB_PATH = "/tmp/does-not-exist.sqlite";
  process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
  process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
  process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
  __resetDbsForTests();
  __resetCourseDataCachesForTests();

  try {
    const results = await searchCourses({ query: "algorithms", limit: 99 });

    assert.equal(results.length, 1);
    assert.equal(results[0]?.designation, "COMP SCI 577");
  } finally {
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
  }
});

test("getRuntimePostgresDb returns a Postgres client when SUPABASE_DATABASE_URL is set", () => {
  process.env.SUPABASE_DATABASE_URL = "postgres://example";
  __resetDbsForTests();

  const db = getRuntimePostgresDb();

  assert.ok(db);
});

test("getRuntimePostgresDb tests restore SUPABASE_DATABASE_URL for later cases", () => {
  assert.equal(process.env.SUPABASE_DATABASE_URL, originalSupabaseDatabaseUrl);
});

test("getRuntimePostgresDb throws when SUPABASE_DATABASE_URL is missing", () => {
  delete process.env.SUPABASE_DATABASE_URL;
  __resetDbsForTests();

  assert.throws(() => getRuntimePostgresDb(), /SUPABASE_DATABASE_URL/);
});

test("searchCourses still works with only the compatibility sqlite path", async () => {
  delete process.env.TURSO_COURSE_DATABASE_URL;
  delete process.env.TURSO_COURSE_AUTH_TOKEN;
  delete process.env.MADGRADES_COURSE_REPLICA_PATH;
  process.env.MADGRADES_DB_PATH = fixture.dbPath;
  __resetDbsForTests();
  __resetCourseDataCachesForTests();

  try {
    const results = await searchCourses({ query: "algorithms", limit: 99 });

    assert.equal(results.length, 1);
    assert.equal(results[0]?.designation, "COMP SCI 577");
  } finally {
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
  }
});

test("searchCourses does not hide incomplete Turso course config", async () => {
  process.env.MADGRADES_DB_PATH = fixture.dbPath;
  process.env.TURSO_COURSE_DATABASE_URL = "libsql://course-db.example.turso.io";
  delete process.env.TURSO_COURSE_AUTH_TOKEN;
  process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
  __resetDbsForTests();
  __resetCourseDataCachesForTests();

  try {
    await assert.rejects(searchCourses({ query: "algorithms", limit: 99 }), /TURSO_COURSE_AUTH_TOKEN/);
  } finally {
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
  }
});

test("searchCourses fails fast when the compatibility sqlite path does not exist", async () => {
  delete process.env.TURSO_COURSE_DATABASE_URL;
  delete process.env.TURSO_COURSE_AUTH_TOKEN;
  delete process.env.MADGRADES_COURSE_REPLICA_PATH;
  process.env.MADGRADES_DB_PATH = `${fixture.dbPath}.missing`;
  __resetDbsForTests();
  __resetCourseDataCachesForTests();

  try {
    await assert.rejects(searchCourses({ query: "algorithms", limit: 99 }), /Database file does not exist/);
  } finally {
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
  }
});

test("getCourseDetail uses the course database without requiring the compatibility db path", async () => {
  process.env.MADGRADES_DB_PATH = "/tmp/does-not-exist.sqlite";
  process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
  process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
  process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
  __resetDbsForTests();
  __resetCourseDataCachesForTests();

  try {
    const detail = await getCourseDetail("COMP SCI 577");

    assert.ok(detail);
    assert.equal(detail.course.designation, "COMP SCI 577");
  } finally {
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
  }
});

test("getCourseDetail returns sections meetings prerequisites grades and schedule packages", async () => {
  const detail = await getCourseDetail(" comp sci 577 ");

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
  assert.deepEqual(detail.instructorGrades[0], {
    sectionNumber: "001",
    sectionType: "LEC",
    instructorDisplayName: "Ada Lovelace",
    sameCoursePriorOfferingCount: 1,
    sameCourseStudentCount: 20,
    sameCourseGpa: 3.7,
    courseHistoricalGpa: 3.7,
    instructorMatchStatus: "matched",
  });
  assert.equal(detail.schedulePackages[0].sourcePackageId, "1272:302:005770:comp-sci-577-main");
});

test("getCourseDetail returns current instructors with null grade fields when madgrades rows are unavailable", async () => {
  const compatibilityFixture = buildCourseDataFixture();

  try {
    compatibilityFixture.db.exec(`
      DELETE FROM madgrades_course_offerings;
      DELETE FROM madgrades_instructor_grades;
      DELETE FROM madgrades_course_grades;
      DELETE FROM madgrades_instructor_matches;
      DELETE FROM madgrades_course_matches;
    `);
    compatibilityFixture.db.close();
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = compatibilityFixture.dbPath;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();

    const detail = await getCourseDetail("COMP SCI 577");

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
  } finally {
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
    compatibilityFixture.cleanup();
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
  }
});

test("getCourseDetail keeps unmatched instructors with null madgrades fields", async () => {
  const compatibilityFixture = buildCourseDataFixture();

  try {
    compatibilityFixture.db.exec(`
      DELETE FROM madgrades_course_offerings;
      DELETE FROM madgrades_instructor_grades;
      DELETE FROM madgrades_instructor_matches;
    `);
    compatibilityFixture.db.close();
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = compatibilityFixture.dbPath;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();

    const detail = await getCourseDetail("COMP SCI 577");

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
  } finally {
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
    compatibilityFixture.cleanup();
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
  }
});

test("getCourseDetail reads instructor history from standalone madgrades tables when overview views are absent", async () => {
  const compatibilityFixture = buildCourseDataFixture();

  try {
    seedCourseDetailRows(compatibilityFixture.db);
    compatibilityFixture.db.exec(`
      DROP VIEW course_grade_overview_v;
      DROP VIEW instructor_course_history_overview_v;
    `);
    compatibilityFixture.db.close();
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = compatibilityFixture.dbPath;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();

    const detail = await getCourseDetail("COMP SCI 577");

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
  } finally {
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
    compatibilityFixture.cleanup();
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
  }
});

test("getCourseDetail keeps the single-db instructor history path when dedicated madgrades env is absent", async () => {
  delete process.env.TURSO_MADGRADES_DATABASE_URL;
  delete process.env.TURSO_MADGRADES_AUTH_TOKEN;
  delete process.env.MADGRADES_MADGRADES_REPLICA_PATH;
  __resetDbsForTests();
  __resetCourseDataCachesForTests();

  try {
    const detail = await getCourseDetail("COMP SCI 577");

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
  } finally {
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
  }
});

test("getCourseDetail returns an empty instructor history when the single-db view is missing", async () => {
  const compatibilityFixture = buildCourseDataFixture();

  try {
    compatibilityFixture.db.exec("DROP VIEW current_term_section_instructor_grade_overview_v");
    compatibilityFixture.db.close();
    process.env.MADGRADES_DB_PATH = compatibilityFixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${compatibilityFixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = compatibilityFixture.dbPath;
    delete process.env.TURSO_MADGRADES_DATABASE_URL;
    delete process.env.TURSO_MADGRADES_AUTH_TOKEN;
    delete process.env.MADGRADES_MADGRADES_REPLICA_PATH;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();

    const detail = await getCourseDetail("COMP SCI 577");

    assert.ok(detail);
    assert.deepEqual(detail.instructorGrades, []);
  } finally {
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
    compatibilityFixture.cleanup();
    process.env.MADGRADES_DB_PATH = fixture.dbPath;
    process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
    process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
  }
});

test("getCourseDetail keeps the single-db instructor history path when dedicated madgrades config is partial", async () => {
  process.env.TURSO_MADGRADES_DATABASE_URL = "libsql://madgrades-db.example.turso.io";
  delete process.env.TURSO_MADGRADES_AUTH_TOKEN;
  process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
  __resetDbsForTests();
  __resetCourseDataCachesForTests();

  try {
    const detail = await getCourseDetail("COMP SCI 577");

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
  } finally {
    process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
    process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
    process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
    __resetDbsForTests();
    __resetCourseDataCachesForTests();
  }
});

test("getCourseDetail collapses cross-listed duplicate lecture rows on the course page", async () => {
  const detail = await getCourseDetail("COMP SCI 102");

  assert.ok(detail);
  assert.equal(detail.course.sectionCount, 1);
  assert.equal(detail.sections.length, 1);
  assert.equal(detail.schedulePackages.length, 1);
  assert.equal(detail.sections[0].sectionType, "LEC");
  assert.equal(detail.sections[0].sectionNumber, "001");
  assert.equal(detail.sections[0].sectionClassNumber, 27344);
  assert.equal(detail.sections[0].openSeats, 20);
  assert.equal(detail.schedulePackages[0].sourcePackageId, "1272:302:023191:comp-sci-102-main");
  assert.equal(detail.schedulePackages[0].openSeats, 20);
  assert.equal(detail.schedulePackages[0].restrictionNote, "Reserved for Information School majors.");
});

test("getCourseDetail preserves topic-specific titles for live sections on umbrella topic courses", async () => {
  const detail = await getCourseDetail("ASIAN AM 462");

  assert.ok(detail);
  assert.equal(detail.course.title, "Topic in Asian American Literature");
  assert.deepEqual(
    detail.sections.map((section) => ({
      sectionNumber: section.sectionNumber,
      sectionTitle: section.sectionTitle,
    })),
    [
      {
        sectionNumber: "001",
        sectionTitle: "Asian Americans and Sci Fi",
      },
      {
        sectionNumber: "002",
        sectionTitle: "Asian Am Creative Writing Wrk",
      },
    ],
  );
  assert.deepEqual(
    detail.schedulePackages.map((schedulePackage) => ({
      label: schedulePackage.sectionBundleLabel,
      sectionTitle: schedulePackage.sectionTitle,
    })),
    [
      {
        label: "ASIAN AM 462 LEC 002",
        sectionTitle: "Asian Am Creative Writing Wrk",
      },
      {
        label: "ASIAN AM 462 LEC 001 + LEC 002",
        sectionTitle: null,
      },
      {
        label: "ASIAN AM 462 LEC 001",
        sectionTitle: "Asian Americans and Sci Fi",
      },
    ],
  );
});

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

function makeRuntimeCourseDetailRows(sqlText: string): Record<string, unknown>[] {
  if (sqlText.includes("SELECT to_regclass('public.course_search_fts')::text AS name")) {
    return [{ name: "course_search_fts" }];
  }

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

  throw new Error(`Unexpected runtime query in course-data test: ${sqlText}`);
}

test("searchCourses preserves its result shape when SUPABASE_DATABASE_URL is set", async () => {
  const expected = await searchCourses({ query: "algorithms", limit: 99 });

  const actual = await withSupabaseRuntimeRows(
    (sqlText) => makeRuntimeCourseDetailRows(sqlText),
    async (queries) => {
      const runtimeResults = await searchCourses({ query: "algorithms", limit: 99 });
      assert.ok(queries.some((sqlText) => sqlText.includes("course_search_fts")));
      return runtimeResults;
    },
  );

  assert.deepEqual(actual, expected);
});

test("buildPostgresTsquery converts tokenized search text into valid prefix tsquery syntax", () => {
  assert.equal(buildPostgresTsquery("engl 462"), "engl:* & 462:*");
  assert.equal(buildPostgresTsquery("Algorithms   Data"), "algorithms:* & data:*");
  assert.equal(buildPostgresTsquery("((( )))"), null);
});

test("searchCourses orders higher Postgres ts_rank matches first", async () => {
  const results = await withSupabaseRuntimeRows(
    (sqlText) => {
      if (sqlText.includes("to_regclass('public.course_search_fts')")) {
        return [{ name: "course_search_fts" }];
      }

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

      throw new Error(`Unexpected runtime query in course-data test: ${sqlText}`);
    },
    async () => searchCourses({ query: "data", limit: 99 }),
  );

  assert.deepEqual(
    results.map((course) => course.designation),
    ["COMP SCI 577", "STAT 340"],
  );
});

test("generateSchedulesFromPostgres rejects hidden canonical meeting conflicts on the runtime path", async () => {
  const results = await withSupabaseRuntimeRows(
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

      throw new Error(`Unexpected runtime query in course-data test: ${sqlText}`);
    },
    async (queries) => {
      const runtimeResults = await generateSchedulesFromPostgres({
        courses: ["COMP SCI 577", "ASIAN AM 462"],
        lockPackages: [],
        excludePackages: [],
        limit: 5,
        preferenceOrder: ["earlier-finishes", "later-starts", "fewer-campus-days", "fewer-long-gaps"],
        includeWaitlisted: false,
        includeClosed: false,
      });
      assert.ok(queries.some((sqlText) => sqlText.includes("FROM schedule_candidates_v")));
      assert.ok(queries.some((sqlText) => sqlText.includes("FROM canonical_meetings")));
      return runtimeResults;
    },
  );

  assert.deepEqual(results, []);
});

test("generateSchedulesFromPostgresWithMetadata prefers the compact schedule for less-time-between-classes", async () => {
  const result = await withSupabaseRuntimeRows(
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

      throw new Error(`Unexpected runtime query in course-data test: ${sqlText}`);
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
  const result = await withSupabaseRuntimeRows(
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

      throw new Error(`Unexpected runtime query in course-data test: ${sqlText}`);
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

  assert.equal(result.schedules[0]?.package_ids[0], "stat340-aspread");
});

test("generateSchedulesFromPostgresWithMetadata keeps source ordering when preferenceOrder is explicitly empty", async () => {
  const result = await withSupabaseRuntimeRows(
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

      throw new Error(`Unexpected runtime query in course-data test: ${sqlText}`);
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

  assert.equal(result.schedules[0]?.package_ids[0], "stat340-aspread");
});

test("generateSchedulesFromPostgresWithMetadata reports hard-filter empty state", async () => {
  const result = await withSupabaseRuntimeRows(
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

      throw new Error(`Unexpected runtime query in course-data test: ${sqlText}`);
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
  const result = await withSupabaseRuntimeRows(
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

      throw new Error(`Unexpected runtime query in course-data test: ${sqlText}`);
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
  const result = await withSupabaseRuntimeRows(
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

      throw new Error(`Unexpected runtime query in course-data test: ${sqlText}`);
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
  const result = await withSupabaseRuntimeRows(
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

      throw new Error(`Unexpected runtime query in course-data test: ${sqlText}`);
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
  const result = await withSupabaseRuntimeRows(
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

      throw new Error(`Unexpected runtime query in course-data test: ${sqlText}`);
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
        preferenceOrder: ["fewer-long-gaps"],
        includeWaitlisted: false,
        includeClosed: false,
      }),
  );

  assert.equal(result.schedules[0]?.package_ids[0], "stat340-zcompact-long-gap");
});

test("getCourseDetail preserves instructor history when SUPABASE_DATABASE_URL is set", async () => {
  const detail = await withSupabaseRuntimeRows(
    (sqlText) => makeRuntimeCourseDetailRows(sqlText),
    async (queries) => {
      const runtimeDetail = await getCourseDetail("COMP SCI 577");
      assert.ok(queries.some((sqlText) => sqlText.includes("WITH course_history AS")));
      return runtimeDetail;
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

test("getCourseDetail qualifies Madgrades tables on the Supabase runtime path", async () => {
  const detail = await withSupabaseRuntimeRows(
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

      return makeRuntimeCourseDetailRows(sqlText);
    },
    async () => getCourseDetail("COMP SCI 577"),
  );

  assert.ok(detail);
  assert.equal(detail.instructorGrades[0]?.sameCourseGpa, 3.7);
});
