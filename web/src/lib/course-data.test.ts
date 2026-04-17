import { after, test } from "node:test";
import assert from "node:assert/strict";

import { buildCourseDbFixture, makeCourse } from "../../../tests/helpers/madgrades-db-fixture.mjs";
import { __resetDbsForTests } from "./db";
import {
  __resetCourseDataCachesForTests,
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
process.env.MADGRADES_DB_PATH = fixture.dbPath;
process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
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

test("searchCourses queries the shared course overview data", () => {
  const results = searchCourses({ query: "algorithms", subject: "comp sci", limit: 99 });

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

test("searchCourses collapses duplicate designations and keeps the live offering", () => {
  const results = searchCourses({ query: "asian am 462", limit: 99 });

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

test("searchCourses matches cross-listed alias designations through the FTS index", () => {
  const results = searchCourses({ query: "engl 462", limit: 99 });

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

test("searchCourses falls back when the FTS table is missing", () => {
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

    const results = searchCourses({ query: "engl 462", limit: 99 });

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

test("searchCourses fallback matches reordered alias tokens when the FTS table is missing", () => {
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

    const results = searchCourses({ query: "462 engl", limit: 99 });

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

test("searchCourses fallback matches tokens split across alias and title when the FTS table is missing", () => {
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

    const results = searchCourses({ query: "engl literature", limit: 99 });

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

test("searchCourses fallback matches description-only queries when the FTS table is missing", () => {
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

    const results = searchCourses({ query: "petabyte", limit: 99 });

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

test("searchCourses fallback does not return false positives from token precedence when the FTS table is missing", () => {
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

    assert.deepEqual(searchCourses({ query: "engl data", limit: 99 }), []);
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

test("searchCourses fallback applies subject filtering when the FTS table is missing", () => {
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

    const results = searchCourses({ query: "literature", subject: "comp sci", limit: 99 });

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

test("searchCourses matches compact subject queries for spaced-letter aliases", () => {
  const results = searchCourses({ query: "lis 102", limit: 99 });

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

test("searchCourses returns a controlled empty list for punctuation-only queries", () => {
  assert.deepEqual(searchCourses({ query: "((( )))", limit: 99 }), []);
});

test("getCourseDetail returns sections meetings prerequisites grades and schedule packages", () => {
  const detail = getCourseDetail(" comp sci 577 ");

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

test("getCourseDetail collapses cross-listed duplicate lecture rows on the course page", () => {
  const detail = getCourseDetail("COMP SCI 102");

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

test("getCourseDetail preserves topic-specific titles for live sections on umbrella topic courses", () => {
  const detail = getCourseDetail("ASIAN AM 462");

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
