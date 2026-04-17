import { after, test } from "node:test";
import assert from "node:assert/strict";

import { buildCourseDbFixture, makeCourse } from "../../../../../tests/helpers/madgrades-db-fixture.mjs";
import { __resetDbsForTests } from "@/lib/db";

import { GET as getCourseDetail } from "./[designation]/route";
import { DEFAULT_PREFERENCE_ORDER } from "@/app/schedule-builder/preferences";
import { POST as buildSchedules } from "../schedules/route";
import {
  normalizeBooleanInput,
  normalizePreferenceOrderInput,
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

process.env.MADGRADES_DB_PATH = fixture.dbPath;
process.env.TURSO_COURSE_DATABASE_URL = `file:${fixture.dbPath}`;
process.env.TURSO_COURSE_AUTH_TOKEN = "test-course-token";
process.env.MADGRADES_COURSE_REPLICA_PATH = fixture.dbPath;
process.env.TURSO_MADGRADES_DATABASE_URL = `file:${fixture.dbPath}`;
process.env.TURSO_MADGRADES_AUTH_TOKEN = "test-madgrades-token";
process.env.MADGRADES_MADGRADES_REPLICA_PATH = fixture.dbPath;
after(() => {
  __resetDbsForTests();
  fixture.cleanup();
});

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
  });
});

test("normalizePreferenceOrderInput fills defaults and filters invalid values", () => {
  assert.deepEqual(normalizePreferenceOrderInput(undefined), DEFAULT_PREFERENCE_ORDER);
  assert.deepEqual(
    normalizePreferenceOrderInput(["fewer-long-gaps", "invalid", "fewer-long-gaps"]),
    [
      "fewer-long-gaps",
      "later-starts",
      "fewer-campus-days",
      "earlier-finishes",
    ],
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
});
