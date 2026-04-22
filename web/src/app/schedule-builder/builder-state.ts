import {
  clampScheduleLimit,
  DEFAULT_SCHEDULE_LIMIT,
  MAX_SCHEDULE_COURSES,
  normalizeCourseDesignation,
  normalizeUniqueCourseDesignations,
} from "@/lib/course-designation";

import {
  getExclusivePreferenceRuleId,
  normalizePreferenceOrder,
  type PreferenceRuleId,
} from "./preferences";

export const ALLOWED_MAX_DAYS = [2, 3, 4, 5] as const;
export const ALLOWED_START_AFTER_HOURS = [8, 9, 10] as const;
export const ALLOWED_END_BEFORE_HOURS = [14, 15, 16, 17, 18] as const;

export type LockedSection = {
  courseDesignation: string;
  sourcePackageId: string;
};

export type ExcludedSection = {
  courseDesignation: string | null;
  sourcePackageId: string;
};

export type ScheduleBuilderState = {
  courses: string[];
  lockedSections: LockedSection[];
  excludedSections: ExcludedSection[];
  limit: number;
  maxDays: number | null;
  startAfterHour: number | null;
  endBeforeHour: number | null;
  preferenceOrder: PreferenceRuleId[];
  includeWaitlisted: boolean;
  includeClosed: boolean;
};

export type ScheduleRequestPayload = {
  courses: string[];
  lock_packages: string[];
  exclude_packages: string[];
  limit: number;
  max_campus_days: number | null;
  start_after_minute_local: number | null;
  end_before_minute_local: number | null;
  preference_order: PreferenceRuleId[];
  include_waitlisted: boolean;
  include_closed: boolean;
};

export type CoursePickerState = {
  selectedCourseDesignations: string[];
  maxCoursesReached: boolean;
};

export type PendingResultsDisplayState = {
  schedules: null;
  requestState: "loading";
  zeroLimit: boolean;
};

export function shouldHideGeneratedSchedulePreview(
  hasPendingBuilderState: boolean,
  requestState: "idle" | "loading" | "ready" | "error",
): boolean {
  return hasPendingBuilderState || requestState === "loading";
}

export function deriveInteractiveBuilderState(
  builderState: ScheduleBuilderState,
  pendingBuilderState: ScheduleBuilderState,
  hasPendingBuilderState: boolean,
): ScheduleBuilderState {
  return hasPendingBuilderState ? pendingBuilderState : builderState;
}

export function derivePendingResultsDisplayState(
  builderState: ScheduleBuilderState,
  pendingBuilderState: ScheduleBuilderState,
  hasPendingBuilderState: boolean,
): PendingResultsDisplayState | null {
  if (!hasPendingBuilderState) {
    return null;
  }

  const interactiveState = deriveInteractiveBuilderState(
    builderState,
    pendingBuilderState,
    hasPendingBuilderState,
  );

  return {
    schedules: null,
    requestState: "loading",
    zeroLimit: interactiveState.limit === 0,
  };
}

export function parseBuilderState(searchParams: URLSearchParams): ScheduleBuilderState {
  const priorityValues = searchParams.getAll("priority");
  const hasExplicitPriorityParams = priorityValues.length > 0;
  const courses = normalizeCourses(searchParams.getAll("course"));
  const excludedSections = normalizeExcludedSections(searchParams.getAll("exclude"));
  const lockedSections = normalizeLockedSections(searchParams.getAll("lock"), excludedSections);

  return {
    courses,
    lockedSections,
    excludedSections,
    limit: clampScheduleLimit(parseOptionalInteger(searchParams.get("limit"), DEFAULT_SCHEDULE_LIMIT)),
    maxDays: parseOptionalAllowedInteger(searchParams.get("maxDays"), ALLOWED_MAX_DAYS),
    startAfterHour: parseOptionalAllowedInteger(
      searchParams.get("startAfter"),
      ALLOWED_START_AFTER_HOURS,
    ),
    endBeforeHour: parseOptionalAllowedInteger(
      searchParams.get("endBefore"),
      ALLOWED_END_BEFORE_HOURS,
    ),
    preferenceOrder: normalizePreferenceOrder(priorityValues, {
      useDefaultsWhenEmpty: !hasExplicitPriorityParams,
    }),
    includeWaitlisted: parseBooleanSearchParam(searchParams.get("includeWaitlisted")),
    includeClosed: parseBooleanSearchParam(searchParams.get("includeClosed")),
  };
}

export function serializeBuilderState(state: ScheduleBuilderState): URLSearchParams {
  const searchParams = new URLSearchParams();

  for (const course of normalizeCourses(state.courses)) {
    searchParams.append("course", course);
  }

  for (const lockedSection of normalizeLockedSections(
    state.lockedSections.map(({ courseDesignation, sourcePackageId }) => `${courseDesignation}~${sourcePackageId}`),
    normalizeExcludedSections(
      state.excludedSections.map(({ courseDesignation, sourcePackageId }) =>
        courseDesignation ? `${courseDesignation}~${sourcePackageId}` : sourcePackageId,
      ),
    ),
  )) {
    searchParams.append(
      "lock",
      `${lockedSection.courseDesignation}~${lockedSection.sourcePackageId}`,
    );
  }

  for (const excludedSection of normalizeExcludedSections(
    state.excludedSections.map(({ courseDesignation, sourcePackageId }) =>
      courseDesignation ? `${courseDesignation}~${sourcePackageId}` : sourcePackageId,
    ),
  )) {
    searchParams.append(
      "exclude",
      excludedSection.courseDesignation
        ? `${excludedSection.courseDesignation}~${excludedSection.sourcePackageId}`
        : excludedSection.sourcePackageId,
    );
  }

  for (const ruleId of normalizePreferenceOrder(state.preferenceOrder, {
    useDefaultsWhenEmpty: false,
  })) {
    searchParams.append("priority", ruleId);
  }

  if (state.preferenceOrder.length === 0) {
    searchParams.append("priority", "");
  }

  searchParams.set("limit", String(clampScheduleLimit(state.limit)));
  if (state.maxDays != null) {
    searchParams.set("maxDays", String(state.maxDays));
  }
  if (state.startAfterHour != null) {
    searchParams.set("startAfter", String(state.startAfterHour));
  }
  if (state.endBeforeHour != null) {
    searchParams.set("endBefore", String(state.endBeforeHour));
  }
  searchParams.set("includeWaitlisted", state.includeWaitlisted ? "true" : "false");
  searchParams.set("includeClosed", state.includeClosed ? "true" : "false");

  return searchParams;
}

export function buildScheduleRequestPayload(state: ScheduleBuilderState): ScheduleRequestPayload {
  const excludedSections = normalizeExcludedSections(
    state.excludedSections.map(({ courseDesignation, sourcePackageId }) =>
      courseDesignation ? `${courseDesignation}~${sourcePackageId}` : sourcePackageId,
    ),
  );
  const excludedSectionIds = excludedSections.map((excludedSection) => excludedSection.sourcePackageId);
  const excludedSectionIdSet = new Set(excludedSectionIds);

  return {
    courses: normalizeCourses(state.courses),
    lock_packages: normalizeLockedSections(
      state.lockedSections.map(({ courseDesignation, sourcePackageId }) => `${courseDesignation}~${sourcePackageId}`),
      excludedSections,
    )
      .map((lockedSection) => lockedSection.sourcePackageId)
      .filter((packageId) => !excludedSectionIdSet.has(packageId)),
    exclude_packages: excludedSectionIds,
    limit: clampScheduleLimit(state.limit),
    max_campus_days: state.maxDays,
    start_after_minute_local: hourToMinuteLocal(state.startAfterHour),
    end_before_minute_local: hourToMinuteLocal(state.endBeforeHour),
    preference_order: normalizePreferenceOrder(state.preferenceOrder, {
      useDefaultsWhenEmpty: false,
    }),
    include_waitlisted: state.includeWaitlisted,
    include_closed: state.includeClosed,
  };
}

export function buildScheduleRequestSignature(state: ScheduleBuilderState): string {
  return JSON.stringify(buildScheduleRequestPayload(state));
}

export function buildCourseDetailsRequestSignature(courses: string[]): string {
  return JSON.stringify(normalizeCourses(courses));
}

export function applyPendingBuilderStateUpdate(
  pendingStateRef: { current: ScheduleBuilderState },
  updater: (state: ScheduleBuilderState) => ScheduleBuilderState,
) {
  const nextState = updater(pendingStateRef.current);
  const changed = serializeBuilderState(nextState).toString() !== serializeBuilderState(pendingStateRef.current).toString();

  if (changed) {
    pendingStateRef.current = nextState;
  }

  return { nextState, changed };
}

export function replacePendingBuilderStateSignature(
  pendingStateSignaturesRef: { current: string[] },
  previousSignature: string,
  nextSignature: string,
  currentSignature: string,
) {
  if (previousSignature === nextSignature) {
    return;
  }

  pendingStateSignaturesRef.current = pendingStateSignaturesRef.current.filter(
    (signature) => signature !== previousSignature,
  );

  if (nextSignature !== currentSignature && !pendingStateSignaturesRef.current.includes(nextSignature)) {
    pendingStateSignaturesRef.current.push(nextSignature);
  }
}

export function reconcilePendingBuilderStateFromUrl(
  pendingStateRef: { current: ScheduleBuilderState },
  pendingStateSignaturesRef: { current: string[] },
  builderState: ScheduleBuilderState,
  lastReconciledBuilderStateSignatureRef: { current: string },
): boolean {
  const builderStateSignature = serializeBuilderState(builderState).toString();
  const pendingSignatureIndex = pendingStateSignaturesRef.current.indexOf(builderStateSignature);

  if (pendingSignatureIndex >= 0) {
    pendingStateSignaturesRef.current = pendingStateSignaturesRef.current.slice(pendingSignatureIndex + 1);

    lastReconciledBuilderStateSignatureRef.current = builderStateSignature;

    if (pendingStateSignaturesRef.current.length > 0) {
      return false;
    }
  } else if (pendingStateSignaturesRef.current.length > 0) {
    if (lastReconciledBuilderStateSignatureRef.current === builderStateSignature) {
      return false;
    }
  }

  pendingStateRef.current = builderState;
  pendingStateSignaturesRef.current = [];
  lastReconciledBuilderStateSignatureRef.current = builderStateSignature;
  return true;
}

export function deriveCoursePickerState(
  builderState: ScheduleBuilderState,
  pendingBuilderState: ScheduleBuilderState,
  hasPendingBuilderState: boolean,
): CoursePickerState {
  const selectedCourseDesignations = deriveInteractiveBuilderState(
    builderState,
    pendingBuilderState,
    hasPendingBuilderState,
  ).courses;

  return {
    selectedCourseDesignations,
    maxCoursesReached: selectedCourseDesignations.length >= MAX_SCHEDULE_COURSES,
  };
}

export function addCourse(state: ScheduleBuilderState, courseDesignation: string): ScheduleBuilderState {
  let normalizedCourseDesignation: string;

  try {
    normalizedCourseDesignation = normalizeCourseDesignation(courseDesignation);
  } catch {
    return state;
  }

  if (
    state.courses.length >= MAX_SCHEDULE_COURSES ||
    state.courses.includes(normalizedCourseDesignation)
  ) {
    return state;
  }

  return {
    ...state,
    courses: [...state.courses, normalizedCourseDesignation],
  };
}

export function setLockedSection(
  state: ScheduleBuilderState,
  courseDesignation: string,
  sourcePackageId: string | null,
): ScheduleBuilderState {
  const normalizedCourseDesignation = safeNormalizeCourseDesignation(courseDesignation);
  const normalizedSourcePackageId = normalizePackageId(sourcePackageId);

  if (!normalizedCourseDesignation) {
    return state;
  }

  const lockedSections = state.lockedSections.filter(
    (lockedSection) => lockedSection.courseDesignation !== normalizedCourseDesignation,
  );

  if (normalizedSourcePackageId) {
    lockedSections.push({
      courseDesignation: normalizedCourseDesignation,
      sourcePackageId: normalizedSourcePackageId,
    });
  }

  return {
    ...state,
    lockedSections: normalizeLockedSections(
      lockedSections.map(({ courseDesignation: designation, sourcePackageId: packageId }) => `${designation}~${packageId}`),
      state.excludedSections,
    ),
  };
}

export function setExcludedSection(
  state: ScheduleBuilderState,
  courseDesignation: string | null,
  sourcePackageId: string,
  excluded: boolean,
): ScheduleBuilderState {
  const normalizedCourseDesignation = safeNormalizeCourseDesignation(courseDesignation);
  const normalizedSourcePackageId = normalizePackageId(sourcePackageId);

  if (!normalizedSourcePackageId) {
    return state;
  }

  const excludedSections = excluded
    ? normalizeExcludedSections([
        ...state.excludedSections.map(({ courseDesignation: designation, sourcePackageId: packageId }) =>
          designation ? `${designation}~${packageId}` : packageId,
        ),
        normalizedCourseDesignation
          ? `${normalizedCourseDesignation}~${normalizedSourcePackageId}`
          : normalizedSourcePackageId,
      ])
    : normalizeExcludedSections(
        state.excludedSections
          .filter((excludedSection) => excludedSection.sourcePackageId !== normalizedSourcePackageId)
          .map(({ courseDesignation: designation, sourcePackageId: packageId }) =>
            designation ? `${designation}~${packageId}` : packageId,
          ),
      );

  return {
    ...state,
    excludedSections,
    lockedSections: state.lockedSections.filter(
      (lockedSection) => lockedSection.sourcePackageId !== normalizedSourcePackageId,
    ),
  };
}

export function removeCourse(state: ScheduleBuilderState, courseDesignation: string): ScheduleBuilderState {
  const normalizedCourseDesignation = safeNormalizeCourseDesignation(courseDesignation);

  if (!normalizedCourseDesignation) {
    return state;
  }

  return {
    ...state,
    courses: state.courses.filter((designation) => designation !== normalizedCourseDesignation),
    lockedSections: state.lockedSections.filter(
      (lockedSection) => lockedSection.courseDesignation !== normalizedCourseDesignation,
    ),
    excludedSections: state.excludedSections.filter(
      (excludedSection) => excludedSection.courseDesignation !== normalizedCourseDesignation,
    ),
  };
}

export function movePreferenceRule(
  state: ScheduleBuilderState,
  ruleId: PreferenceRuleId,
  direction: -1 | 1,
): ScheduleBuilderState {
  const preferenceOrder = normalizePreferenceOrder(state.preferenceOrder, {
    useDefaultsWhenEmpty: false,
  });
  const fromIndex = preferenceOrder.indexOf(ruleId);

  if (fromIndex === -1) {
    return { ...state, preferenceOrder };
  }

  const toIndex = fromIndex + direction;

  if (toIndex < 0 || toIndex >= preferenceOrder.length) {
    return { ...state, preferenceOrder };
  }

  const nextPreferenceOrder = [...preferenceOrder];
  [nextPreferenceOrder[fromIndex], nextPreferenceOrder[toIndex]] = [
    nextPreferenceOrder[toIndex],
    nextPreferenceOrder[fromIndex],
  ];

  return {
    ...state,
    preferenceOrder: nextPreferenceOrder,
  };
}

export function setPreferenceRuleEnabled(
  state: ScheduleBuilderState,
  ruleId: PreferenceRuleId,
  enabled: boolean,
): ScheduleBuilderState {
  const preferenceOrder = normalizePreferenceOrder(state.preferenceOrder, {
    useDefaultsWhenEmpty: false,
  });

  if (!enabled) {
    return {
      ...state,
      preferenceOrder: preferenceOrder.filter((currentRuleId) => currentRuleId !== ruleId),
    };
  }

  if (preferenceOrder.includes(ruleId)) {
    return {
      ...state,
      preferenceOrder,
    };
  }

  const exclusiveRuleId = getExclusivePreferenceRuleId(ruleId);
  const nextPreferenceOrder = preferenceOrder.filter(
    (currentRuleId) => currentRuleId !== ruleId && currentRuleId !== exclusiveRuleId,
  );

  nextPreferenceOrder.push(ruleId);

  return {
    ...state,
    preferenceOrder: nextPreferenceOrder,
  };
}

function normalizeCourses(values: string[]): string[] {
  if (values.length === 0) {
    return [];
  }

  try {
    return normalizeUniqueCourseDesignations(values);
  } catch {
    return [];
  }
}

function normalizeLockedSections(values: string[], excludedSections: ExcludedSection[]): LockedSection[] {
  const excludedSectionIdSet = new Set(excludedSections.map((excludedSection) => excludedSection.sourcePackageId));
  const lockedByCourse = new Map<string, string>();

  for (const value of values) {
    const lockedSection = parseLockedSection(value);

    if (!lockedSection || excludedSectionIdSet.has(lockedSection.sourcePackageId)) {
      continue;
    }

    lockedByCourse.set(lockedSection.courseDesignation, lockedSection.sourcePackageId);
  }

  return [...lockedByCourse.entries()].map(([courseDesignation, sourcePackageId]) => ({
    courseDesignation,
    sourcePackageId,
  }));
}

function parseLockedSection(value: string): LockedSection | null {
  const [courseDesignation, sourcePackageId, ...rest] = value.split("~");

  if (rest.length > 0) {
    return null;
  }

  const normalizedCourseDesignation = safeNormalizeCourseDesignation(courseDesignation);
  const normalizedSourcePackageId = normalizePackageId(sourcePackageId);

  if (!normalizedCourseDesignation || !normalizedSourcePackageId) {
    return null;
  }

  return {
    courseDesignation: normalizedCourseDesignation,
    sourcePackageId: normalizedSourcePackageId,
  };
}

function normalizeExcludedSections(values: string[]): ExcludedSection[] {
  const excludedSections: ExcludedSection[] = [];

  for (const value of values) {
    const excludedSection = parseExcludedSection(value);

    if (
      excludedSection &&
      !excludedSections.some(
        (entry) =>
          entry.sourcePackageId === excludedSection.sourcePackageId &&
          entry.courseDesignation === excludedSection.courseDesignation,
      )
    ) {
      excludedSections.push(excludedSection);
    }
  }

  return excludedSections;
}

function parseExcludedSection(value: string): ExcludedSection | null {
  const [firstPart, secondPart, ...rest] = value.split("~");

  if (rest.length > 0) {
    return null;
  }

  if (secondPart === undefined) {
    const sourcePackageId = normalizePackageId(firstPart);

    if (!sourcePackageId) {
      return null;
    }

    return {
      courseDesignation: null,
      sourcePackageId,
    };
  }

  const courseDesignation = safeNormalizeCourseDesignation(firstPart);
  const sourcePackageId = normalizePackageId(secondPart);

  if (!courseDesignation || !sourcePackageId) {
    return null;
  }

  return {
    courseDesignation,
    sourcePackageId,
  };
}

function normalizePackageId(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim() ?? "";
  return normalizedValue ? normalizedValue : null;
}

function safeNormalizeCourseDesignation(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return normalizeCourseDesignation(value);
  } catch {
    return null;
  }
}

function parseOptionalInteger(value: string | null, defaultValue?: number): number | undefined {
  if (value == null) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function parseOptionalAllowedInteger(
  value: string | null,
  allowedValues: readonly number[],
): number | null {
  if (value == null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return allowedValues.includes(parsed) ? parsed : null;
}

function parseBooleanSearchParam(value: string | null): boolean {
  return value === "true";
}

function hourToMinuteLocal(value: number | null): number | null {
  return value == null ? null : value * 60;
}
