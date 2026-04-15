export const SUPPORTED_PREFERENCE_RULE_IDS = [
  "later-starts",
  "fewer-campus-days",
  "fewer-long-gaps",
  "earlier-finishes",
] as const;

export type PreferenceRuleId = (typeof SUPPORTED_PREFERENCE_RULE_IDS)[number];

export const PREFERENCE_RULE_LABELS: Record<PreferenceRuleId, string> = {
  "later-starts": "Later starts",
  "fewer-campus-days": "Fewer campus days",
  "fewer-long-gaps": "Fewer long gaps",
  "earlier-finishes": "Earlier finishes",
};

export const DEFAULT_PREFERENCE_ORDER: PreferenceRuleId[] = [...SUPPORTED_PREFERENCE_RULE_IDS];

export function normalizePreferenceOrder(values: string[]): PreferenceRuleId[] {
  const seen = new Set<PreferenceRuleId>();
  const normalized: PreferenceRuleId[] = [];

  for (const value of values) {
    const trimmedValue = value.trim();

    if (isPreferenceRuleId(trimmedValue) && !seen.has(trimmedValue)) {
      seen.add(trimmedValue);
      normalized.push(trimmedValue);
    }
  }

  for (const ruleId of DEFAULT_PREFERENCE_ORDER) {
    if (!seen.has(ruleId)) {
      normalized.push(ruleId);
    }
  }

  return normalized;
}

function isPreferenceRuleId(value: string): value is PreferenceRuleId {
  return SUPPORTED_PREFERENCE_RULE_IDS.includes(value as PreferenceRuleId);
}
