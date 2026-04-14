import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SCHEDULE_LIMIT,
  MAX_SCHEDULE_COURSES,
  MAX_SCHEDULE_LIMIT,
  clampScheduleLimit,
  normalizeCourseDesignation,
  normalizeUniqueCourseDesignations,
} from "./course-designation";

test("normalizeCourseDesignation uppercases and collapses whitespace", () => {
  assert.equal(normalizeCourseDesignation("  Comp   Sci   577  "), "COMP SCI 577");
});

test("normalizeUniqueCourseDesignations drops duplicates and enforces the max course count", () => {
  assert.deepEqual(
    normalizeUniqueCourseDesignations([
      " comp sci 577 ",
      "COMP   SCI 577",
      "math 240",
      "stat   240",
    ]),
    ["COMP SCI 577", "MATH 240", "STAT 240"],
  );

  assert.throws(
    () =>
      normalizeUniqueCourseDesignations([
        "A 1",
        "B 2",
        "C 3",
        "D 4",
        "E 5",
        "F 6",
        "G 7",
        "H 8",
        "I 9",
      ]),
    new RegExp(`${MAX_SCHEDULE_COURSES}`),
  );
});

test("clampScheduleLimit falls back to defaults and caps oversized values", () => {
  assert.equal(clampScheduleLimit(undefined), DEFAULT_SCHEDULE_LIMIT);
  assert.equal(clampScheduleLimit(null), DEFAULT_SCHEDULE_LIMIT);
  assert.equal(clampScheduleLimit(MAX_SCHEDULE_LIMIT + 10), MAX_SCHEDULE_LIMIT);
  assert.equal(clampScheduleLimit(0), 0);
});
