import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCourseDetailsRequestSignature,
  buildScheduleRequestPayload,
  buildScheduleRequestSignature,
  movePreferenceRule,
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
    preferenceOrder: [
      "later-starts",
      "fewer-campus-days",
      "fewer-long-gaps",
      "earlier-finishes",
    ],
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
  searchParams.append("priority", " earlier-finishes ");
  searchParams.append("priority", "fewer-long-gaps");
  searchParams.append("priority", " earlier-finishes ");
  searchParams.append("priority", "unknown-rule");
  searchParams.set("limit", "999");

  assert.deepEqual(parseBuilderState(searchParams), {
    courses: ["COMP SCI 577", "MATH 240"],
    lockedSections: [{ courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-1" }],
    excludedSections: [
      { courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-2" },
    ],
    limit: 50,
    preferenceOrder: [
      "earlier-finishes",
      "fewer-long-gaps",
      "later-starts",
      "fewer-campus-days",
    ],
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
      preferenceOrder: [
        "fewer-long-gaps",
        "later-starts",
        "earlier-finishes",
        "fewer-campus-days",
      ],
    }),
  );

  assert.deepEqual(searchParams.getAll("course"), ["MATH 240", "COMP SCI 577"]);
  assert.deepEqual(searchParams.getAll("lock"), ["COMP SCI 577~pkg-1"]);
  assert.deepEqual(searchParams.getAll("exclude"), ["COMP SCI 577~pkg-2"]);
  assert.deepEqual(searchParams.getAll("priority"), [
    "fewer-long-gaps",
    "later-starts",
    "earlier-finishes",
    "fewer-campus-days",
  ]);
  assert.equal(searchParams.get("limit"), "30");
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
    preference_order: [
      "later-starts",
      "fewer-campus-days",
      "fewer-long-gaps",
      "earlier-finishes",
    ],
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

test("buildScheduleRequestSignature changes when preference order changes", () => {
  const firstSignature = buildScheduleRequestSignature(makeState());
  const secondSignature = buildScheduleRequestSignature(
    makeState({
      preferenceOrder: [
        "fewer-campus-days",
        "later-starts",
        "fewer-long-gaps",
        "earlier-finishes",
      ],
    }),
  );

  assert.notEqual(firstSignature, secondSignature);
});

test("buildCourseDetailsRequestSignature stays stable across equivalent course arrays", () => {
  const firstSignature = buildCourseDetailsRequestSignature([" comp sci 577 ", "MATH 240"]);
  const secondSignature = buildCourseDetailsRequestSignature(["COMP SCI 577", "MATH 240"]);

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

test("movePreferenceRule swaps adjacent rules and stops at bounds", () => {
  const movedUp = movePreferenceRule(makeState(), "fewer-long-gaps", -1);
  assert.deepEqual(movedUp.preferenceOrder, [
    "later-starts",
    "fewer-long-gaps",
    "fewer-campus-days",
    "earlier-finishes",
  ]);

  const unchangedAtTop = movePreferenceRule(movedUp, "later-starts", -1);
  assert.deepEqual(unchangedAtTop.preferenceOrder, movedUp.preferenceOrder);

  const movedDown = movePreferenceRule(unchangedAtTop, "fewer-campus-days", 1);
  assert.deepEqual(movedDown.preferenceOrder, [
    "later-starts",
    "fewer-long-gaps",
    "earlier-finishes",
    "fewer-campus-days",
  ]);

  const unchangedAtBottom = movePreferenceRule(movedDown, "fewer-campus-days", 1);
  assert.deepEqual(unchangedAtBottom.preferenceOrder, movedDown.preferenceOrder);
});
