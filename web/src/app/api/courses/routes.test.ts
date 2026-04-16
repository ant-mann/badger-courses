import { after, test } from "node:test";
import assert from "node:assert/strict";

import { buildCourseDbFixture, makeCourse } from "../../../../../tests/helpers/madgrades-db-fixture.mjs";

import { GET as getCourseDetail } from "./[designation]/route";
import { DEFAULT_PREFERENCE_ORDER } from "@/app/schedule-builder/preferences";
import { POST as buildSchedules } from "../schedules/route";
import {
  normalizeBooleanInput,
  normalizePreferenceOrderInput,
} from "../schedules/normalize";
import { GET as searchCourses } from "./search/route";

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

process.env.MADGRADES_DB_PATH = fixture.dbPath;
after(() => fixture.cleanup());

test("course search route requires q or subject", async () => {
  const response = searchCourses(new Request("https://example.test/api/courses/search"));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "At least one of q or subject is required.",
  });
});

test("course search route returns FTS-backed matches", async () => {
  const response = searchCourses(new Request("https://example.test/api/courses/search?q=algorithms"));

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
  const response = searchCourses(new Request("https://example.test/api/courses/search?q=%28%28%28"));

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
