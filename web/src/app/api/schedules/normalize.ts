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

  return normalizePreferenceOrder(value);
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
