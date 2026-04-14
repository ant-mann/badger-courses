import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScheduleRequestPayload,
  buildScheduleRequestSignature,
  parseBuilderState,
  removeCourse,
  serializeBuilderState,
  setExcludedSection,
  setLockedSection,
  type ScheduleBuilderState,
} from "./builder-state";

function makeState(overrides: Partial<ScheduleBuilderState> = {}): ScheduleBuilderState {
  return {
    courses: ["COMP SCI 577", "MATH 240"],
    lockedSections: [],
    excludedSections: [],
    limit: 25,
    view: "cards",
    ...overrides,
  };
}

test("parseBuilderState normalizes url-backed builder inputs", () => {
  const searchParams = new URLSearchParams();
  searchParams.append("course", " comp sci 577 ");
  searchParams.append("course", "COMP   SCI 577");
  searchParams.append("course", "math 240");
  searchParams.append("lock", "COMP SCI 577~pkg-1");
  searchParams.append("lock", "bad-lock-value");
  searchParams.append("exclude", "COMP SCI 577~pkg-2");
  searchParams.append("exclude", "COMP SCI 577~pkg-2");
  searchParams.set("limit", "999");
  searchParams.set("view", "calendar");

  assert.deepEqual(parseBuilderState(searchParams), {
    courses: ["COMP SCI 577", "MATH 240"],
    lockedSections: [{ courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-1" }],
    excludedSections: [
      { courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-2" },
    ],
    limit: 50,
    view: "calendar",
  });
});

test("parseBuilderState drops invalid course lists that fail shared normalization", () => {
  const searchParams = new URLSearchParams();

  for (const course of ["A 1", "B 2", "C 3", "D 4", "E 5", "F 6", "G 7", "H 8", "I 9"]) {
    searchParams.append("course", course);
  }

  assert.deepEqual(parseBuilderState(searchParams).courses, []);
});

test("serializeBuilderState emits normalized url params", () => {
  const searchParams = serializeBuilderState(
    makeState({
      courses: ["MATH 240", "COMP SCI 577"],
      lockedSections: [{ courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-1" }],
      excludedSections: [{ courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-2" }],
      limit: 30,
      view: "calendar",
    }),
  );

  assert.deepEqual(searchParams.getAll("course"), ["MATH 240", "COMP SCI 577"]);
  assert.deepEqual(searchParams.getAll("lock"), ["COMP SCI 577~pkg-1"]);
  assert.deepEqual(searchParams.getAll("exclude"), ["COMP SCI 577~pkg-2"]);
  assert.equal(searchParams.get("limit"), "30");
  assert.equal(searchParams.get("view"), "calendar");
});

test("buildScheduleRequestPayload uses schedule api field names", () => {
  const payload = buildScheduleRequestPayload(
    makeState({
      lockedSections: [
        { courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-1" },
        { courseDesignation: "MATH 240", sourcePackageId: "pkg-2" },
      ],
      excludedSections: [
        { courseDesignation: "MATH 240", sourcePackageId: "pkg-2" },
        { courseDesignation: null, sourcePackageId: "pkg-3" },
      ],
      limit: 10,
    }),
  );

  assert.deepEqual(payload, {
    courses: ["COMP SCI 577", "MATH 240"],
    lock_packages: ["pkg-1"],
    exclude_packages: ["pkg-2", "pkg-3"],
    limit: 10,
  });
});

test("buildScheduleRequestSignature stays stable for equivalent builder inputs", () => {
  const firstSignature = buildScheduleRequestSignature(
    makeState({
      courses: [" comp sci 577 ", "MATH 240"],
      lockedSections: [
        { courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-1" },
        { courseDesignation: "MATH 240", sourcePackageId: "pkg-2" },
      ],
      excludedSections: [
        { courseDesignation: "MATH 240", sourcePackageId: "pkg-2" },
        { courseDesignation: null, sourcePackageId: "pkg-3" },
        { courseDesignation: null, sourcePackageId: "pkg-3" },
      ],
      limit: 999,
    }),
  );

  const secondSignature = buildScheduleRequestSignature(
    makeState({
      courses: ["COMP SCI 577", "MATH 240"],
      lockedSections: [
        { courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-1" },
        { courseDesignation: "MATH 240", sourcePackageId: "pkg-2" },
      ],
      excludedSections: [
        { courseDesignation: "MATH 240", sourcePackageId: "pkg-2" },
        { courseDesignation: null, sourcePackageId: "pkg-3" },
      ],
      limit: 50,
    }),
  );

  assert.equal(firstSignature, secondSignature);
});

test("setLockedSection keeps only one locked section per course", () => {
  const state = setLockedSection(
    setLockedSection(makeState(), "COMP SCI 577", "pkg-1"),
    " comp sci 577 ",
    "pkg-2",
  );

  assert.deepEqual(state.lockedSections, [
    { courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-2" },
  ]);
});

test("setExcludedSection removes matching locked sections", () => {
  const state = setExcludedSection(
    makeState({
      lockedSections: [
        { courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-1" },
        { courseDesignation: "MATH 240", sourcePackageId: "pkg-2" },
      ],
    }),
    "COMP SCI 577",
    "pkg-1",
    true,
  );

  assert.deepEqual(state.lockedSections, [
    { courseDesignation: "MATH 240", sourcePackageId: "pkg-2" },
  ]);
  assert.deepEqual(state.excludedSections, [
    { courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-1" },
  ]);
});

test("removeCourse drops the removed course locks and exclusions without detail data", () => {
  const state = removeCourse(
    makeState({
      lockedSections: [
        { courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-1" },
        { courseDesignation: "MATH 240", sourcePackageId: "pkg-2" },
      ],
      excludedSections: [
        { courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-3" },
        { courseDesignation: null, sourcePackageId: "pkg-4" },
        { courseDesignation: "MATH 240", sourcePackageId: "pkg-5" },
      ],
    }),
    " comp sci 577 ",
  );

  assert.deepEqual(state.courses, ["MATH 240"]);
  assert.deepEqual(state.lockedSections, [
    { courseDesignation: "MATH 240", sourcePackageId: "pkg-2" },
  ]);
  assert.deepEqual(state.excludedSections, [
    { courseDesignation: null, sourcePackageId: "pkg-4" },
    { courseDesignation: "MATH 240", sourcePackageId: "pkg-5" },
  ]);
});
