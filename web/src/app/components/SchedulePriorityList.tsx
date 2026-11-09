import React from "react";

import {
  PREFERENCE_RULE_LABELS,
  SUPPORTED_PREFERENCE_RULE_IDS,
  type PreferenceRuleId,
} from "@/app/schedule-builder/preferences";

type SchedulePriorityListProps = {
  preferenceOrder: PreferenceRuleId[];
  onMoveRule: (ruleId: PreferenceRuleId, direction: -1 | 1) => void;
  onRuleEnabledChange: (ruleId: PreferenceRuleId, enabled: boolean) => void;
};

export function SchedulePriorityList({
  preferenceOrder,
  onMoveRule,
  onRuleEnabledChange,
}: SchedulePriorityListProps) {
  const inactiveRuleIds = SUPPORTED_PREFERENCE_RULE_IDS.filter(
    (ruleId) => !preferenceOrder.includes(ruleId),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold">Rank schedules by</h3>
      </div>

      <div className="flex flex-col gap-3">
        {preferenceOrder.map((ruleId, index) => (
          <article
            key={ruleId}
            className="flex flex-col gap-3 rounded-xl border border-border bg-muted p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-text-faint">{index + 1}.</span>
              <span className="text-base font-semibold">{PREFERENCE_RULE_LABELS[ruleId]}</span>
            </div>

            <div className="flex w-full gap-2 sm:w-auto">
              <button
                type="button"
                onClick={() => onRuleEnabledChange(ruleId, false)}
                aria-label={`Remove ${PREFERENCE_RULE_LABELS[ruleId]}`}
                className="min-h-11 rounded-full border border-border px-4 text-sm font-medium transition hover:border-blue/20 hover:bg-blue/[0.03]"
              >
                Remove
              </button>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMoveRule(ruleId, -1)}
                aria-label={`Move ${PREFERENCE_RULE_LABELS[ruleId]} up`}
                className="min-h-11 rounded-full border border-border px-4 text-sm font-medium transition hover:border-blue/20 hover:bg-blue/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === preferenceOrder.length - 1}
                onClick={() => onMoveRule(ruleId, 1)}
                aria-label={`Move ${PREFERENCE_RULE_LABELS[ruleId]} down`}
                className="min-h-11 rounded-full border border-border px-4 text-sm font-medium transition hover:border-blue/20 hover:bg-blue/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ↓
              </button>
            </div>
          </article>
        ))}
      </div>

      {inactiveRuleIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {inactiveRuleIds.map((ruleId) => (
            <button
              key={ruleId}
              type="button"
              onClick={() => onRuleEnabledChange(ruleId, true)}
              aria-label={`Add ${PREFERENCE_RULE_LABELS[ruleId]} back to ranking`}
              className="rounded-full border border-border px-3 py-1 text-sm font-medium text-text-weak transition hover:border-blue/20 hover:bg-blue/[0.03]"
            >
              {PREFERENCE_RULE_LABELS[ruleId]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
