import {
  DEFAULT_SCHEDULE_LIMIT,
  clampScheduleLimit,
  normalizeCourseDesignation,
  normalizeUniqueCourseDesignations,
} from "@/lib/course-designation";

export type BuilderView = "cards" | "calendar";

export type LockedSection = {
  courseDesignation: string;
  sourcePackageId: string;
};

export type ScheduleBuilderState = {
  courses: string[];
  lockedSections: LockedSection[];
  excludedSectionIds: string[];
  limit: number;
  view: BuilderView;
};

export type ScheduleRequestPayload = {
  courses: string[];
  lock_packages: string[];
  exclude_packages: string[];
  limit: number;
};

const DEFAULT_VIEW: BuilderView = "cards";

export function parseBuilderState(searchParams: URLSearchParams): ScheduleBuilderState {
  const courses = normalizeCourses(searchParams.getAll("course"));
  const excludedSectionIds = normalizePackageIds(searchParams.getAll("exclude"));
  const lockedSections = normalizeLockedSections(searchParams.getAll("lock"), excludedSectionIds);

  return {
    courses,
    lockedSections,
    excludedSectionIds,
    limit: clampScheduleLimit(parseOptionalInteger(searchParams.get("limit"))),
    view: parseView(searchParams.get("view")),
  };
}

export function serializeBuilderState(state: ScheduleBuilderState): URLSearchParams {
  const searchParams = new URLSearchParams();

  for (const course of normalizeCourses(state.courses)) {
    searchParams.append("course", course);
  }

  for (const lockedSection of normalizeLockedSections(
    state.lockedSections.map(({ courseDesignation, sourcePackageId }) => `${courseDesignation}~${sourcePackageId}`),
    normalizePackageIds(state.excludedSectionIds),
  )) {
    searchParams.append(
      "lock",
      `${lockedSection.courseDesignation}~${lockedSection.sourcePackageId}`,
    );
  }

  for (const packageId of normalizePackageIds(state.excludedSectionIds)) {
    searchParams.append("exclude", packageId);
  }

  searchParams.set("limit", String(clampScheduleLimit(state.limit)));
  searchParams.set("view", parseView(state.view));

  return searchParams;
}

export function buildScheduleRequestPayload(state: ScheduleBuilderState): ScheduleRequestPayload {
  const excludedSectionIds = normalizePackageIds(state.excludedSectionIds);
  const excludedSectionIdSet = new Set(excludedSectionIds);

  return {
    courses: normalizeCourses(state.courses),
    lock_packages: normalizeLockedSections(
      state.lockedSections.map(({ courseDesignation, sourcePackageId }) => `${courseDesignation}~${sourcePackageId}`),
      excludedSectionIds,
    )
      .map((lockedSection) => lockedSection.sourcePackageId)
      .filter((packageId) => !excludedSectionIdSet.has(packageId)),
    exclude_packages: excludedSectionIds,
    limit: clampScheduleLimit(state.limit),
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
      state.excludedSectionIds,
    ),
  };
}

export function setExcludedSection(
  state: ScheduleBuilderState,
  sourcePackageId: string,
  excluded: boolean,
): ScheduleBuilderState {
  const normalizedSourcePackageId = normalizePackageId(sourcePackageId);

  if (!normalizedSourcePackageId) {
    return state;
  }

  const excludedSectionIds = excluded
    ? normalizePackageIds([...state.excludedSectionIds, normalizedSourcePackageId])
    : normalizePackageIds(
        state.excludedSectionIds.filter((packageId) => packageId !== normalizedSourcePackageId),
      );

  return {
    ...state,
    excludedSectionIds,
    lockedSections: state.lockedSections.filter(
      (lockedSection) => lockedSection.sourcePackageId !== normalizedSourcePackageId,
    ),
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

function normalizeLockedSections(values: string[], excludedSectionIds: string[]): LockedSection[] {
  const excludedSectionIdSet = new Set(excludedSectionIds);
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

function normalizePackageIds(values: Array<string | null | undefined>): string[] {
  const packageIds: string[] = [];

  for (const value of values) {
    const normalizedValue = normalizePackageId(value);

    if (normalizedValue && !packageIds.includes(normalizedValue)) {
      packageIds.push(normalizedValue);
    }
  }

  return packageIds;
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

function parseOptionalInteger(value: string | null): number | undefined {
  if (value == null) {
    return DEFAULT_SCHEDULE_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? DEFAULT_SCHEDULE_LIMIT : parsed;
}

function parseView(value: string | null): BuilderView {
  return value === "calendar" ? "calendar" : DEFAULT_VIEW;
}
