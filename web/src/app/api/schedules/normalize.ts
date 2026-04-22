import {
  normalizePreferenceOrder,
  type PreferenceRuleId,
} from '@/app/schedule-builder/preferences';
import type { generateSchedulesFromPostgresWithMetadata } from '@/lib/course-data';

type ScheduleGenerationResult = Awaited<ReturnType<typeof generateSchedulesFromPostgresWithMetadata>>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isFiniteNumberOrNull(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isValidSchedulePackageEntry(
  value: unknown,
): value is ScheduleGenerationResult['schedules'][number]['packages'][number] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'source_package_id' in value &&
    typeof value.source_package_id === 'string' &&
    'course_designation' in value &&
    typeof value.course_designation === 'string' &&
    'title' in value &&
    typeof value.title === 'string' &&
    'section_bundle_label' in value &&
    typeof value.section_bundle_label === 'string' &&
    'open_seats' in value &&
    isFiniteNumberOrNull(value.open_seats) &&
    'is_full' in value &&
    isFiniteNumberOrNull(value.is_full) &&
    'has_waitlist' in value &&
    isFiniteNumberOrNull(value.has_waitlist) &&
    'meeting_count' in value &&
    isFiniteNumberOrNull(value.meeting_count) &&
    'campus_day_count' in value &&
    isFiniteNumberOrNull(value.campus_day_count) &&
    'earliest_start_minute_local' in value &&
    isFiniteNumberOrNull(value.earliest_start_minute_local) &&
    'latest_end_minute_local' in value &&
    isFiniteNumberOrNull(value.latest_end_minute_local) &&
    'has_online_meeting' in value &&
    isFiniteNumberOrNull(value.has_online_meeting) &&
    'has_unknown_location' in value &&
    isFiniteNumberOrNull(value.has_unknown_location) &&
    'restriction_note' in value &&
    (value.restriction_note === null || typeof value.restriction_note === 'string') &&
    'has_temporary_restriction' in value &&
    isFiniteNumberOrNull(value.has_temporary_restriction) &&
    'meeting_summary_local' in value &&
    (value.meeting_summary_local === null || typeof value.meeting_summary_local === 'string')
  );
}

function isValidScheduleEntry(
  value: unknown,
): value is ScheduleGenerationResult['schedules'][number] {
  const packageIds =
    typeof value === 'object' && value !== null && 'package_ids' in value && Array.isArray(value.package_ids)
      ? value.package_ids
      : null;
  const packages =
    typeof value === 'object' && value !== null && 'packages' in value && Array.isArray(value.packages)
      ? value.packages
      : null;

  return (
    typeof value === 'object' &&
    value !== null &&
    'package_ids' in value &&
    Array.isArray(value.package_ids) &&
    value.package_ids.every((item) => typeof item === 'string') &&
    'packages' in value &&
    Array.isArray(value.packages) &&
    value.packages.every(isValidSchedulePackageEntry) &&
    packageIds !== null &&
    packages !== null &&
    packageIds.length === packages.length &&
    packageIds.every((packageId) =>
      packages.some((pkg) => pkg.source_package_id === packageId),
    ) &&
    'conflict_count' in value &&
    isFiniteNumber(value.conflict_count) &&
    'campus_day_count' in value &&
    isFiniteNumberOrNull(value.campus_day_count) &&
    'earliest_start_minute_local' in value &&
    isFiniteNumberOrNull(value.earliest_start_minute_local) &&
    'large_idle_gap_count' in value &&
    isFiniteNumber(value.large_idle_gap_count) &&
    'total_between_class_minutes' in value &&
    isFiniteNumber(value.total_between_class_minutes) &&
    'tight_transition_count' in value &&
    isFiniteNumber(value.tight_transition_count) &&
    'total_walking_distance_meters' in value &&
    isFiniteNumber(value.total_walking_distance_meters) &&
    'total_open_seats' in value &&
    isFiniteNumber(value.total_open_seats) &&
    'latest_end_minute_local' in value &&
    isFiniteNumberOrNull(value.latest_end_minute_local)
  );
}

function isValidEmptyStateReason(
  value: unknown,
): value is ScheduleGenerationResult['emptyStateReason'] {
  return value === null || value === 'constraints' || value === 'hard-filters';
}

export function normalizeScheduleGenerationResult(
  value: unknown,
): ScheduleGenerationResult {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('schedules' in value) ||
    !Array.isArray(value.schedules) ||
    !value.schedules.every(isValidScheduleEntry) ||
    !('emptyStateReason' in value) ||
    !isValidEmptyStateReason(value.emptyStateReason)
  ) {
    throw new Error('Invalid schedule generation result from SQLite generator.');
  }

  return {
    schedules: value.schedules,
    emptyStateReason: value.emptyStateReason,
  };
}

export function normalizePreferenceOrderInput(value: unknown): PreferenceRuleId[] | null {
  if (value === undefined) {
    return normalizePreferenceOrder([]);
  }

  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    return null;
  }

  return normalizePreferenceOrder(value, { useDefaultsWhenEmpty: false });
}

export function normalizeBooleanInput(value: unknown): boolean | null {
  if (value === undefined) {
    return false;
  }

  if (typeof value !== 'boolean') {
    return null;
  }

  return value;
}

export type NormalizedNullableIntegerField = {
  value: number | null;
  isValid: boolean;
};

export function normalizeNullableIntegerField(value: unknown): NormalizedNullableIntegerField {
  if (value === undefined || value === null) {
    return { value: null, isValid: true };
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return { value: null, isValid: false };
  }

  return { value, isValid: true };
}

export function normalizeNullableIntegerInput(value: unknown): number | null {
  return normalizeNullableIntegerField(value).value;
}
