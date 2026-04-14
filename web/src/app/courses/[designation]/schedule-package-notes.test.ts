import test from "node:test";
import assert from "node:assert/strict";

import type { SchedulePackage } from "@/lib/course-data";

import { splitSchedulePackageNotes } from "./schedule-package-notes";

function makeSchedulePackage(
  sourcePackageId: string,
  restrictionNote: string | null,
): SchedulePackage {
  return {
    sourcePackageId,
    sectionBundleLabel: sourcePackageId,
    openSeats: 5,
    isFull: false,
    hasWaitlist: false,
    campusDayCount: 2,
    meetingSummaryLocal: "MW 9:30-10:45",
    restrictionNote,
  };
}

test("splitSchedulePackageNotes groups repeated restriction notes into a shared section", () => {
  const result = splitSchedulePackageNotes([
    makeSchedulePackage("pkg-1", "Reserved for declared majors."),
    makeSchedulePackage("pkg-2", "Reserved for declared majors."),
    makeSchedulePackage("pkg-3", "Instructor consent required."),
    makeSchedulePackage("pkg-4", null),
  ]);

  assert.deepEqual(result.sharedNotes, ["Reserved for declared majors."]);
  assert.deepEqual(
    result.packages.map((schedulePackage) => ({
      id: schedulePackage.sourcePackageId,
      packageNote: schedulePackage.packageNote,
    })),
    [
      { id: "pkg-1", packageNote: null },
      { id: "pkg-2", packageNote: null },
      { id: "pkg-3", packageNote: "Instructor consent required." },
      { id: "pkg-4", packageNote: null },
    ],
  );
});

test("splitSchedulePackageNotes groups repeated note fragments even when package notes are partially different", () => {
  const result = splitSchedulePackageNotes([
    makeSchedulePackage(
      "pkg-1",
      "Catalog prerequisite text. | Declared majors only. | Textbook recommended.",
    ),
    makeSchedulePackage(
      "pkg-2",
      "Catalog prerequisite text. | Declared majors only.",
    ),
  ]);

  assert.deepEqual(result.sharedNotes, [
    "Catalog prerequisite text.",
    "Declared majors only.",
  ]);
  assert.deepEqual(
    result.packages.map((schedulePackage) => ({
      id: schedulePackage.sourcePackageId,
      packageNote: schedulePackage.packageNote,
    })),
    [
      { id: "pkg-1", packageNote: "Textbook recommended." },
      { id: "pkg-2", packageNote: null },
    ],
  );
});

test("splitSchedulePackageNotes only splits restriction notes on persisted delimiters", () => {
  const result = splitSchedulePackageNotes([
    makeSchedulePackage("pkg-1", "Department says A|B option is allowed."),
    makeSchedulePackage("pkg-2", "Department says A|B option is allowed."),
    makeSchedulePackage(
      "pkg-3",
      "Department says A|B option is allowed. | Instructor consent required.",
    ),
  ]);

  assert.deepEqual(result.sharedNotes, ["Department says A|B option is allowed."]);
  assert.deepEqual(
    result.packages.map((schedulePackage) => ({
      id: schedulePackage.sourcePackageId,
      packageNote: schedulePackage.packageNote,
    })),
    [
      { id: "pkg-1", packageNote: null },
      { id: "pkg-2", packageNote: null },
      { id: "pkg-3", packageNote: "Instructor consent required." },
    ],
  );
});
