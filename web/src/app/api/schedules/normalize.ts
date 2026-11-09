import {
  normalizePreferenceOrder,
  type PreferenceRuleId,
} from '@/app/schedule-builder/preferences';

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
