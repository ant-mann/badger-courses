import { after, test } from "node:test";
import assert from "node:assert/strict";

import { buildCourseDbFixture, makeCourse } from "../../../../../tests/helpers/madgrades-db-fixture.mjs";

import { GET as getCourseDetail } from "./[designation]/route";
import { POST as buildSchedules } from "../schedules/route";
import { GET as searchCourses } from "./search/route";

const fixture = buildCourseDbFixture({
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
    results: [],
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
