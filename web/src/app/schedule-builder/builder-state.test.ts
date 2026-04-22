import assert from "node:assert/strict";
import test from "node:test";

import {
  addCourse,
  ALLOWED_END_BEFORE_HOURS,
  ALLOWED_MAX_DAYS,
  ALLOWED_START_AFTER_HOURS,
  applyPendingBuilderStateUpdate,
  buildCourseDetailsRequestSignature,
  deriveCoursePickerState,
  deriveInteractiveBuilderState,
  derivePendingResultsDisplayState,
  shouldHideGeneratedSchedulePreview,
  buildScheduleRequestPayload,
  buildScheduleRequestSignature,
  movePreferenceRule,
  parseBuilderState,
  replacePendingBuilderStateSignature,
  reconcilePendingBuilderStateFromUrl,
  removeCourse,
  serializeBuilderState,
  setExcludedSection,
  setLockedSection,
  setPreferenceRuleEnabled,
  type ScheduleBuilderState,
} from "./builder-state";
import { DEFAULT_SCHEDULE_LIMIT, MAX_SCHEDULE_COURSES } from "@/lib/course-designation";

function makeState(
  overrides: Partial<ScheduleBuilderState> & {
    includeWaitlisted?: boolean;
    includeClosed?: boolean;
  } = {},
): ScheduleBuilderState & {
  includeWaitlisted: boolean;
  includeClosed: boolean;
} {
  return {
    courses: ["COMP SCI 577", "MATH 240"],
    lockedSections: [],
    excludedSections: [],
    limit: DEFAULT_SCHEDULE_LIMIT,
    maxDays: null,
    startAfterHour: null,
    endBeforeHour: null,
    preferenceOrder: [
      "later-starts",
      "fewer-campus-days",
      "less-time-between-classes",
      "shorter-walks",
      "more-open-seats",
      "earlier-finishes",
    ],
    includeWaitlisted: false,
    includeClosed: false,
    ...overrides,
  } as ScheduleBuilderState & {
    includeWaitlisted: boolean;
    includeClosed: boolean;
  };
}

test("makeState defaults availability toggles to false", () => {
  const state = makeState();

  assert.equal(state.includeWaitlisted, false);
  assert.equal(state.includeClosed, false);
});

test("parseBuilderState normalizes url-backed builder inputs", () => {
  const searchParams = new URLSearchParams();
  searchParams.append("course", " comp sci 577 ");
   searchParams.append("course", "math 240");
   searchParams.append("priority", "later-starts");
   searchParams.append("priority", "fewer-long-gaps");
   searchParams.append("priority", "more-time-between-classes");
   searchParams.append("priority", "shorter-walks");
   searchParams.set("maxDays", "3");
   searchParams.set("startAfter", "9");
   searchParams.set("endBefore", "16");

    assert.deepEqual(parseBuilderState(searchParams), {
      courses: ["COMP SCI 577", "MATH 240"],
      lockedSections: [],
      excludedSections: [],
      limit: DEFAULT_SCHEDULE_LIMIT,
     maxDays: 3,
     startAfterHour: 9,
     endBeforeHour: 16,
     preferenceOrder: [
        "later-starts",
       "less-time-between-classes",
       "shorter-walks",
     ],
     includeWaitlisted: false,
     includeClosed: false,
   });
});

test("parseBuilderState drops invalid course lists that fail shared normalization", () => {
  const searchParams = new URLSearchParams();

  for (const course of ["A 1", "B 2", "C 3", "D 4", "E 5", "F 6", "G 7", "H 8", "I 9"]) {
    searchParams.append("course", course);
  }

  assert.deepEqual(parseBuilderState(searchParams).courses, []);
});

test("parseBuilderState restores availability toggles from the url", () => {
  const searchParams = new URLSearchParams();
  searchParams.append("course", "COMP SCI 577");
  searchParams.set("includeWaitlisted", "true");
  searchParams.set("includeClosed", "true");

  const parsedState = parseBuilderState(searchParams) as ScheduleBuilderState & Record<string, unknown>;

  assert.equal(parsedState.includeWaitlisted, true);
  assert.equal(parsedState.includeClosed, true);
});

test("parseBuilderState defaults malformed availability toggles to false", () => {
  const searchParams = new URLSearchParams();
  searchParams.append("course", "COMP SCI 577");
  searchParams.set("includeWaitlisted", "yes");
  searchParams.set("includeClosed", "1");

  const parsedState = parseBuilderState(searchParams) as ScheduleBuilderState & Record<string, unknown>;

  assert.equal(parsedState.includeWaitlisted, false);
  assert.equal(parsedState.includeClosed, false);
});

test("parseBuilderState restores the default active ranking when priority params are absent", () => {
  const searchParams = new URLSearchParams();
  searchParams.append("course", "COMP SCI 577");

  assert.deepEqual(parseBuilderState(searchParams).preferenceOrder, [
    "later-starts",
    "fewer-campus-days",
    "less-time-between-classes",
    "shorter-walks",
    "more-open-seats",
    "earlier-finishes",
  ]);
});

test("parseBuilderState uses the shared default schedule limit when the url omits limit", () => {
  const searchParams = new URLSearchParams();
  searchParams.append("course", "COMP SCI 577");

  assert.equal(parseBuilderState(searchParams).limit, DEFAULT_SCHEDULE_LIMIT);
});

test("builder-state exports the allowed hard-filter value lists", () => {
  assert.deepEqual(ALLOWED_MAX_DAYS, [2, 3, 4, 5]);
  assert.deepEqual(ALLOWED_START_AFTER_HOURS, [8, 9, 10]);
  assert.deepEqual(ALLOWED_END_BEFORE_HOURS, [14, 15, 16, 17, 18]);
});

test("buildScheduleRequestPayload includes hard filters and only active ranking rules", () => {
  const payload = buildScheduleRequestPayload(
    makeState({
      maxDays: 3,
      startAfterHour: 9,
      endBeforeHour: 16,
      preferenceOrder: ["later-starts", "shorter-walks"],
    }),
  );

    assert.deepEqual(payload, {
      courses: ["COMP SCI 577", "MATH 240"],
      lock_packages: [],
      exclude_packages: [],
      limit: DEFAULT_SCHEDULE_LIMIT,
    max_campus_days: 3,
    start_after_minute_local: 540,
    end_before_minute_local: 960,
    preference_order: ["later-starts", "shorter-walks"],
    include_waitlisted: false,
    include_closed: false,
  });
});

test("setPreferenceRuleEnabled enforces the mutually exclusive time-between-classes pair", () => {
  const unchangedState = setPreferenceRuleEnabled(
    makeState(),
    "shorter-walks",
    true,
  );

  assert.deepEqual(unchangedState.preferenceOrder, makeState().preferenceOrder);

  const enabledState = setPreferenceRuleEnabled(
    makeState(),
    "more-time-between-classes",
    true,
  );

  assert.deepEqual(enabledState.preferenceOrder, [
    "later-starts",
    "fewer-campus-days",
    "shorter-walks",
    "more-open-seats",
    "earlier-finishes",
    "more-time-between-classes",
  ]);

  const disabledState = setPreferenceRuleEnabled(
    enabledState,
    "more-time-between-classes",
    false,
  );

  assert.deepEqual(disabledState.preferenceOrder, [
    "later-starts",
    "fewer-campus-days",
    "shorter-walks",
    "more-open-seats",
    "earlier-finishes",
  ]);
});

test("serializeBuilderState emits normalized url params", () => {
  const searchParams = serializeBuilderState(
    makeState({
      courses: ["MATH 240", "COMP SCI 577"],
      lockedSections: [{ courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-1" }],
      excludedSections: [{ courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-2" }],
      limit: 30,
      maxDays: 3,
      startAfterHour: 9,
      endBeforeHour: 16,
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
    "less-time-between-classes",
    "later-starts",
    "earlier-finishes",
    "fewer-campus-days",
  ]);
  assert.equal(searchParams.get("limit"), "30");
  assert.equal(searchParams.get("maxDays"), "3");
  assert.equal(searchParams.get("startAfter"), "9");
  assert.equal(searchParams.get("endBefore"), "16");
});

test("serializeBuilderState emits availability toggle params", () => {
  const searchParams = serializeBuilderState(
    makeState({ includeWaitlisted: true, includeClosed: true }),
  );

  assert.equal(searchParams.get("includeWaitlisted"), "true");
  assert.equal(searchParams.get("includeClosed"), "true");
});

test("serializeBuilderState and parseBuilderState round-trip an explicit empty active ranking", () => {
  const searchParams = serializeBuilderState(makeState({ preferenceOrder: [] }));

  assert.deepEqual(searchParams.getAll("priority"), [""]);
  assert.deepEqual(parseBuilderState(searchParams).preferenceOrder, []);
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
    max_campus_days: null,
    start_after_minute_local: null,
    end_before_minute_local: null,
    preference_order: [
      "later-starts",
      "fewer-campus-days",
      "less-time-between-classes",
      "shorter-walks",
      "more-open-seats",
      "earlier-finishes",
    ],
    include_waitlisted: false,
    include_closed: false,
  });
});

test("buildScheduleRequestPayload includes availability flags", () => {
  const payload = buildScheduleRequestPayload(
    makeState({ includeWaitlisted: true, includeClosed: false }),
  ) as Record<string, unknown>;

  assert.equal(payload.include_waitlisted, true);
  assert.equal(payload.include_closed, false);
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
        "less-time-between-classes",
        "earlier-finishes",
      ],
    }),
  );

  assert.notEqual(firstSignature, secondSignature);
});

test("buildScheduleRequestSignature changes when availability toggles change", () => {
  const firstSignature = buildScheduleRequestSignature(
    makeState({ includeWaitlisted: false, includeClosed: false }),
  );
  const secondSignature = buildScheduleRequestSignature(
    makeState({ includeWaitlisted: true, includeClosed: false }),
  );

  assert.notEqual(firstSignature, secondSignature);
});

test("buildCourseDetailsRequestSignature stays stable across equivalent course arrays", () => {
  const firstSignature = buildCourseDetailsRequestSignature([" comp sci 577 ", "MATH 240"]);
  const secondSignature = buildCourseDetailsRequestSignature(["COMP SCI 577", "MATH 240"]);

  assert.equal(firstSignature, secondSignature);
});

test("applyPendingBuilderStateUpdate accumulates rapid sequential updates from the last pending state", () => {
  const pendingStateRef = {
    current: makeState({
      maxDays: null,
      startAfterHour: null,
      endBeforeHour: null,
    }),
  };

  const firstUpdate = applyPendingBuilderStateUpdate(pendingStateRef, (state) => ({
    ...state,
    maxDays: 3,
  }));
  const secondUpdate = applyPendingBuilderStateUpdate(pendingStateRef, (state) => ({
    ...state,
    startAfterHour: 9,
  }));

  assert.equal(firstUpdate.changed, true);
  assert.deepEqual(firstUpdate.nextState, makeState({ maxDays: 3 }));
  assert.equal(secondUpdate.changed, true);
  assert.deepEqual(secondUpdate.nextState, makeState({ maxDays: 3, startAfterHour: 9 }));
  assert.deepEqual(pendingStateRef.current, makeState({ maxDays: 3, startAfterHour: 9 }));
});

test("applyPendingBuilderStateUpdate keeps rapid add-course updates within the max and preserves course params", () => {
  const startingCourses = Array.from({ length: MAX_SCHEDULE_COURSES - 1 }, (_, index) => `COURSE ${index + 1}`);
  const pendingStateRef = {
    current: makeState({
      courses: startingCourses,
      maxDays: 3,
      startAfterHour: 9,
    }),
  };

  const firstUpdate = applyPendingBuilderStateUpdate(pendingStateRef, (state) =>
    addCourse(state, "COURSE 8"),
  );
  const secondUpdate = applyPendingBuilderStateUpdate(pendingStateRef, (state) =>
    addCourse(state, "COURSE 9"),
  );

  assert.equal(firstUpdate.changed, true);
  assert.deepEqual(firstUpdate.nextState.courses, [...startingCourses, "COURSE 8"]);
  assert.equal(secondUpdate.changed, false);
  assert.deepEqual(secondUpdate.nextState.courses, [...startingCourses, "COURSE 8"]);
  assert.deepEqual(pendingStateRef.current.courses, [...startingCourses, "COURSE 8"]);
  assert.deepEqual(serializeBuilderState(pendingStateRef.current).getAll("course"), [
    ...startingCourses,
    "COURSE 8",
  ]);
});

test("deriveCoursePickerState prefers pending course selections while routing is still in flight", () => {
  const builderState = makeState({ courses: ["COMP SCI 577"] });
  const pendingBuilderState = makeState({
    courses: ["COMP SCI 577", "MATH 240"],
  });

  assert.deepEqual(
    deriveCoursePickerState(builderState, pendingBuilderState, true),
    {
      selectedCourseDesignations: ["COMP SCI 577", "MATH 240"],
      maxCoursesReached: false,
    },
  );
  assert.deepEqual(
    deriveCoursePickerState(builderState, pendingBuilderState, false),
    {
      selectedCourseDesignations: ["COMP SCI 577"],
      maxCoursesReached: false,
    },
  );
});

test("deriveInteractiveBuilderState prefers pending control values while routing is still in flight", () => {
  const builderState = makeState({ maxDays: null, preferenceOrder: ["later-starts"] });
  const pendingBuilderState = makeState({
    maxDays: 3,
    preferenceOrder: ["shorter-walks", "later-starts"],
  });

  assert.deepEqual(
    deriveInteractiveBuilderState(builderState, pendingBuilderState, true),
    pendingBuilderState,
  );
  assert.deepEqual(
    deriveInteractiveBuilderState(builderState, pendingBuilderState, false),
    builderState,
  );
});

test("derivePendingResultsDisplayState hides stale results while pending control changes are in flight", () => {
  const builderState = makeState({ limit: DEFAULT_SCHEDULE_LIMIT });
  const pendingBuilderState = makeState({ limit: 0 });

  assert.deepEqual(
    derivePendingResultsDisplayState(builderState, pendingBuilderState, true),
    {
      schedules: null,
      requestState: "loading",
      zeroLimit: true,
    },
  );
  assert.equal(
    derivePendingResultsDisplayState(builderState, pendingBuilderState, false),
    null,
  );
});

test("derivePendingResultsDisplayState keeps the calendar in the empty preview state while pending control changes are in flight", () => {
  const builderState = makeState();
  const pendingBuilderState = makeState({ maxDays: 3 });

  const displayState = derivePendingResultsDisplayState(builderState, pendingBuilderState, true);

  assert.deepEqual(displayState, {
    schedules: null,
    requestState: "loading",
    zeroLimit: false,
  });
});

test("shouldHideGeneratedSchedulePreview stays hidden while replacement schedules are loading", () => {
  assert.equal(shouldHideGeneratedSchedulePreview(true, "ready"), true);
  assert.equal(shouldHideGeneratedSchedulePreview(false, "loading"), true);
  assert.equal(shouldHideGeneratedSchedulePreview(false, "ready"), false);
});

test("replacePendingBuilderStateSignature clears a queued local signature when the latest state matches the current url", () => {
  const acknowledgedState = makeState({ maxDays: null });
  const intermediateState = makeState({ maxDays: 3 });
  const pendingStateSignaturesRef = {
    current: [serializeBuilderState(intermediateState).toString()],
  };

  replacePendingBuilderStateSignature(
    pendingStateSignaturesRef,
    serializeBuilderState(intermediateState).toString(),
    serializeBuilderState(acknowledgedState).toString(),
    serializeBuilderState(acknowledgedState).toString(),
  );

  assert.deepEqual(pendingStateSignaturesRef.current, []);
});

test("reconcilePendingBuilderStateFromUrl ignores stale url state while a newer local state is pending", () => {
  const acknowledgedState = makeState({ maxDays: 3 });
  const pendingStateRef = {
    current: makeState({ maxDays: 3, startAfterHour: 9 }),
  };
  const pendingStateSignaturesRef = {
    current: [serializeBuilderState(makeState({ maxDays: 3, startAfterHour: 9 })).toString()],
  };
  const lastReconciledBuilderStateSignatureRef = {
    current: serializeBuilderState(acknowledgedState).toString(),
  };

  const reconciled = reconcilePendingBuilderStateFromUrl(
    pendingStateRef,
    pendingStateSignaturesRef,
    acknowledgedState,
    lastReconciledBuilderStateSignatureRef,
  );

  assert.equal(reconciled, false);
  assert.deepEqual(pendingStateRef.current, makeState({ maxDays: 3, startAfterHour: 9 }));
  assert.deepEqual(
    pendingStateSignaturesRef.current,
    [serializeBuilderState(makeState({ maxDays: 3, startAfterHour: 9 })).toString()],
  );
  assert.equal(
    lastReconciledBuilderStateSignatureRef.current,
    serializeBuilderState(acknowledgedState).toString(),
  );
});

test("reconcilePendingBuilderStateFromUrl accepts the latest requested url state and clears the pending signature", () => {
  const expectedState = makeState({ maxDays: 3, startAfterHour: 9 });
  const acknowledgedState = makeState({ maxDays: 3 });
  const pendingStateRef = {
    current: makeState({ maxDays: 3 }),
  };
  const pendingStateSignaturesRef = {
    current: [serializeBuilderState(expectedState).toString()],
  };
  const lastReconciledBuilderStateSignatureRef = {
    current: serializeBuilderState(acknowledgedState).toString(),
  };

  const reconciled = reconcilePendingBuilderStateFromUrl(
    pendingStateRef,
    pendingStateSignaturesRef,
    expectedState,
    lastReconciledBuilderStateSignatureRef,
  );

  assert.equal(reconciled, true);
  assert.deepEqual(pendingStateRef.current, expectedState);
  assert.deepEqual(pendingStateSignaturesRef.current, []);
  assert.equal(
    lastReconciledBuilderStateSignatureRef.current,
    serializeBuilderState(expectedState).toString(),
  );
});

test("reconcilePendingBuilderStateFromUrl keeps a newer local state pending when an older in-flight local url arrives", () => {
  const acknowledgedState = makeState({ maxDays: 3 });
  const intermediateState = makeState({ maxDays: 3, startAfterHour: 9 });
  const latestState = makeState({ maxDays: 3, startAfterHour: 9, endBeforeHour: 16 });
  const pendingStateRef = {
    current: latestState,
  };
  const pendingStateSignaturesRef = {
    current: [
      serializeBuilderState(intermediateState).toString(),
      serializeBuilderState(latestState).toString(),
    ],
  };
  const lastReconciledBuilderStateSignatureRef = {
    current: serializeBuilderState(acknowledgedState).toString(),
  };

  const reconciledIntermediateState = reconcilePendingBuilderStateFromUrl(
    pendingStateRef,
    pendingStateSignaturesRef,
    intermediateState,
    lastReconciledBuilderStateSignatureRef,
  );

  assert.equal(reconciledIntermediateState, false);
  assert.deepEqual(pendingStateRef.current, latestState);
  assert.deepEqual(pendingStateSignaturesRef.current, [serializeBuilderState(latestState).toString()]);
  assert.equal(
    lastReconciledBuilderStateSignatureRef.current,
    serializeBuilderState(intermediateState).toString(),
  );

  const reconciledLatestState = reconcilePendingBuilderStateFromUrl(
    pendingStateRef,
    pendingStateSignaturesRef,
    latestState,
    lastReconciledBuilderStateSignatureRef,
  );

  assert.equal(reconciledLatestState, true);
  assert.deepEqual(pendingStateRef.current, latestState);
  assert.deepEqual(pendingStateSignaturesRef.current, []);
  assert.equal(
    lastReconciledBuilderStateSignatureRef.current,
    serializeBuilderState(latestState).toString(),
  );
});

test("reconcilePendingBuilderStateFromUrl recovers when an external url change supersedes a pending local update", () => {
  const acknowledgedState = makeState({ maxDays: 3 });
  const externalState = makeState({ endBeforeHour: 16, preferenceOrder: ["shorter-walks"] });
  const pendingStateRef = {
    current: makeState({ maxDays: 3, startAfterHour: 9 }),
  };
  const pendingStateSignaturesRef = {
    current: [serializeBuilderState(pendingStateRef.current).toString()],
  };
  const lastReconciledBuilderStateSignatureRef = {
    current: serializeBuilderState(acknowledgedState).toString(),
  };

  const reconciled = reconcilePendingBuilderStateFromUrl(
    pendingStateRef,
    pendingStateSignaturesRef,
    externalState,
    lastReconciledBuilderStateSignatureRef,
  );

  assert.equal(reconciled, true);
  assert.deepEqual(pendingStateRef.current, externalState);
  assert.deepEqual(pendingStateSignaturesRef.current, []);
  assert.equal(
    lastReconciledBuilderStateSignatureRef.current,
    serializeBuilderState(externalState).toString(),
  );
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
  const movedUp = movePreferenceRule(makeState(), "less-time-between-classes", -1);
  assert.deepEqual(movedUp.preferenceOrder, [
    "later-starts",
    "less-time-between-classes",
    "fewer-campus-days",
    "shorter-walks",
    "more-open-seats",
    "earlier-finishes",
  ]);

  const unchangedAtTop = movePreferenceRule(movedUp, "later-starts", -1);
  assert.deepEqual(unchangedAtTop.preferenceOrder, movedUp.preferenceOrder);

  const movedDown = movePreferenceRule(unchangedAtTop, "fewer-campus-days", 1);
  assert.deepEqual(movedDown.preferenceOrder, [
    "later-starts",
    "less-time-between-classes",
    "shorter-walks",
    "fewer-campus-days",
    "more-open-seats",
    "earlier-finishes",
  ]);

  const movedToBottom = movePreferenceRule(movedDown, "fewer-campus-days", 1);
  assert.deepEqual(movedToBottom.preferenceOrder, [
    "later-starts",
    "less-time-between-classes",
    "shorter-walks",
    "more-open-seats",
    "fewer-campus-days",
    "earlier-finishes",
  ]);

  const movedPastEarlierFinishes = movePreferenceRule(movedToBottom, "fewer-campus-days", 1);
  assert.deepEqual(movedPastEarlierFinishes.preferenceOrder, [
    "later-starts",
    "less-time-between-classes",
    "shorter-walks",
    "more-open-seats",
    "earlier-finishes",
    "fewer-campus-days",
  ]);

  const unchangedAtBottom = movePreferenceRule(movedPastEarlierFinishes, "fewer-campus-days", 1);
  assert.deepEqual(unchangedAtBottom.preferenceOrder, movedPastEarlierFinishes.preferenceOrder);
});
