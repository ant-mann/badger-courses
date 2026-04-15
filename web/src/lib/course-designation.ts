export const MAX_SCHEDULE_COURSES = 8;
export const DEFAULT_SCHEDULE_LIMIT = 5;
export const MAX_SCHEDULE_LIMIT = 50;

export function normalizeCourseDesignation(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ").toUpperCase();

  if (!normalized) {
    throw new Error("Course designation must be non-empty");
  }

  return normalized;
}

export function normalizeUniqueCourseDesignations(values: string[]): string[] {
  const normalized = values.reduce<string[]>((courses, value) => {
    const designation = normalizeCourseDesignation(value);

    if (!courses.includes(designation)) {
      courses.push(designation);
    }

    return courses;
  }, []);

  if (normalized.length === 0 || normalized.length > MAX_SCHEDULE_COURSES) {
    throw new Error(`Expected between 1 and ${MAX_SCHEDULE_COURSES} unique course designations`);
  }

  return normalized;
}

export function clampScheduleLimit(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) {
    return DEFAULT_SCHEDULE_LIMIT;
  }

  return Math.max(0, Math.min(MAX_SCHEDULE_LIMIT, Math.trunc(value)));
}
