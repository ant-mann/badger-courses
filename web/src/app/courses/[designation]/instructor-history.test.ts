import test from "node:test";
import assert from "node:assert/strict";

import type { InstructorHistoryItem } from "@/lib/course-data";

import { getInstructorHistoryRowsForDisplay } from "./instructor-history";

function makeInstructorHistoryItem(
  sectionType: string,
  sectionNumber: string,
  instructorDisplayName: string,
): InstructorHistoryItem {
  return {
    sectionNumber,
    sectionType,
    instructorDisplayName,
    sameCoursePriorOfferingCount: 2,
    sameCourseStudentCount: 120,
    sameCourseGpa: 3.1,
    courseHistoricalGpa: 3.2,
    instructorMatchStatus: "matched",
  };
}

test("getInstructorHistoryRowsForDisplay keeps only lecture rows when lectures are available", () => {
  const result = getInstructorHistoryRowsForDisplay([
    makeInstructorHistoryItem("DIS", "311", "Ada Lovelace"),
    makeInstructorHistoryItem("DIS", "312", "Ada Lovelace"),
    makeInstructorHistoryItem("LEC", "001", "Ada Lovelace"),
  ]);

  assert.deepEqual(
    result.map((item) => `${item.sectionType} ${item.sectionNumber}`),
    ["LEC 001"],
  );
});

test("getInstructorHistoryRowsForDisplay removes duplicate lecture rows", () => {
  const result = getInstructorHistoryRowsForDisplay([
    makeInstructorHistoryItem("LEC", "001", "Scott Swanson"),
    makeInstructorHistoryItem("LEC", "001", "Scott Swanson"),
    makeInstructorHistoryItem("LEC", "002", "Scott Swanson"),
    makeInstructorHistoryItem("LEC", "002", "Scott Swanson"),
    makeInstructorHistoryItem("DIS", "311", "Scott Swanson"),
  ]);

  assert.deepEqual(
    result.map((item) => `${item.sectionType} ${item.sectionNumber} ${item.instructorDisplayName}`),
    ["LEC 001 Scott Swanson", "LEC 002 Scott Swanson"],
  );
});

test("getInstructorHistoryRowsForDisplay leaves non-lecture courses alone", () => {
  const result = getInstructorHistoryRowsForDisplay([
    makeInstructorHistoryItem("LAB", "301", "Grace Hopper"),
    makeInstructorHistoryItem("LAB", "302", "Grace Hopper"),
  ]);

  assert.deepEqual(
    result.map((item) => `${item.sectionType} ${item.sectionNumber}`),
    ["LAB 301", "LAB 302"],
  );
});
