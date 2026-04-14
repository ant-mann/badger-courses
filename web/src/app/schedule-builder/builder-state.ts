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

export type ExcludedSection = {
  courseDesignation: string | null;
  sourcePackageId: string;
};

export type ScheduleBuilderState = {
  courses: string[];
  lockedSections: LockedSection[];
  excludedSections: ExcludedSection[];
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
  const excludedSections = normalizeExcludedSections(searchParams.getAll("exclude"));
  const lockedSections = normalizeLockedSections(searchParams.getAll("lock"), excludedSections);

  return {
    courses,
    lockedSections,
    excludedSections,
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

  searchParams.set("limit", String(clampScheduleLimit(state.limit)));
  searchParams.set("view", parseView(state.view));

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
  };
}

export function buildScheduleRequestSignature(state: ScheduleBuilderState): string {
  return JSON.stringify(buildScheduleRequestPayload(state));
}

export function buildCourseDetailsRequestSignature(courses: string[]): string {
  return JSON.stringify(normalizeCourses(courses));
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
