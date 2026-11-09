export const SUPPORTED_PREFERENCE_RULE_IDS = [
  "later-starts",
  "fewer-campus-days",
  "less-time-between-classes",
  "more-time-between-classes",
  "shorter-walks",
  "more-open-seats",
  "earlier-finishes",
] as const;

export type PreferenceRuleId = (typeof SUPPORTED_PREFERENCE_RULE_IDS)[number];

export const PREFERENCE_RULE_LABELS: Record<PreferenceRuleId, string> = {
  "later-starts": "Start classes later",
  "fewer-campus-days": "Spend fewer days on campus",
  "less-time-between-classes": "Less time between classes",
  "more-time-between-classes": "More time between classes",
  "shorter-walks": "Shorter walks",
  "more-open-seats": "More open seats",
  "earlier-finishes": "Finish classes earlier",
};

export const DEFAULT_PREFERENCE_ORDER: PreferenceRuleId[] = [
  "later-starts",
  "fewer-campus-days",
  "less-time-between-classes",
  "shorter-walks",
  "more-open-seats",
  "earlier-finishes",
];

const LEGACY_PREFERENCE_RULE_ALIASES: Record<string, PreferenceRuleId> = {
  "fewer-long-gaps": "less-time-between-classes",
};

const TIME_BETWEEN_CLASSES_EXCLUSIVE_RULES = new Map<PreferenceRuleId, PreferenceRuleId>([
  ["less-time-between-classes", "more-time-between-classes"],
  ["more-time-between-classes", "less-time-between-classes"],
]);

export function normalizePreferenceOrder(
  values: string[],
  options: { useDefaultsWhenEmpty?: boolean } = {},
): PreferenceRuleId[] {
  const { useDefaultsWhenEmpty = true } = options;
  const seen = new Set<PreferenceRuleId>();
  const normalized: PreferenceRuleId[] = [];

  for (const value of values) {
    const trimmedValue = normalizePreferenceRuleValue(value);

    if (!trimmedValue || seen.has(trimmedValue)) {
      continue;
    }

    const exclusiveRuleId = TIME_BETWEEN_CLASSES_EXCLUSIVE_RULES.get(trimmedValue);

    if (exclusiveRuleId && seen.has(exclusiveRuleId)) {
      continue;
    }

    if (isPreferenceRuleId(trimmedValue)) {
      seen.add(trimmedValue);
      normalized.push(trimmedValue);
    }
  }

  if (normalized.length === 0 && useDefaultsWhenEmpty) {
    return [...DEFAULT_PREFERENCE_ORDER];
  }

  return normalized;
}

export function getExclusivePreferenceRuleId(ruleId: PreferenceRuleId): PreferenceRuleId | null {
  return TIME_BETWEEN_CLASSES_EXCLUSIVE_RULES.get(ruleId) ?? null;
}

function isPreferenceRuleId(value: string): value is PreferenceRuleId {
  return SUPPORTED_PREFERENCE_RULE_IDS.includes(value as PreferenceRuleId);
}

function normalizePreferenceRuleValue(value: string): PreferenceRuleId | null {
  const trimmedValue = value.trim();
  const normalizedValue = LEGACY_PREFERENCE_RULE_ALIASES[trimmedValue] ?? trimmedValue;

  return isPreferenceRuleId(normalizedValue) ? normalizedValue : null;
}
