import { after, test } from "node:test";
import assert from "node:assert/strict";

import { buildCourseDbFixture, makeCourse } from "../../../tests/helpers/madgrades-db-fixture.mjs";
import {
  getCourseDetail,
  normalizeDesignation,
  parseCourseGroupsJson,
  parseStringArrayJson,
  searchCourses,
} from "./course-data";

function buildCourseDataFixture() {
  return buildCourseDbFixture({
    courses: [
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

const fixture = buildCourseDataFixture();
seedCourseDetailRows(fixture.db);
process.env.MADGRADES_DB_PATH = fixture.dbPath;
after(() => fixture.cleanup());

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
