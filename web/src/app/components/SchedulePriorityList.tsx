import React from "react";

import {
  PREFERENCE_RULE_LABELS,
  type PreferenceRuleId,
} from "@/app/schedule-builder/preferences";

type SchedulePriorityListProps = {
  preferenceOrder: PreferenceRuleId[];
  onMoveRule: (ruleId: PreferenceRuleId, direction: -1 | 1) => void;
};

export function SchedulePriorityList({
  preferenceOrder,
  onMoveRule,
}: SchedulePriorityListProps) {
  return (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-surface p-5 shadow-soft">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-text-faint">
          Schedule Priorities
        </p>
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">Choose ranking order</h2>
        <p className="text-sm leading-7 text-text-weak">
          Schedules are generated using this priority order top to bottom.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {preferenceOrder.map((ruleId, index) => (
          <article
            key={ruleId}
            className="flex flex-col gap-3 rounded-3xl border border-border bg-muted p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-text-faint">{index + 1}.</span>
              <span className="text-base font-semibold">{PREFERENCE_RULE_LABELS[ruleId]}</span>
            </div>

            <div className="flex w-full gap-2 sm:w-auto">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMoveRule(ruleId, -1)}
                aria-label="Move up"
                className="min-h-11 flex-1 rounded-full border border-border px-4 text-sm font-medium transition hover:border-blue/20 hover:bg-blue/[0.03] disabled:cursor-not-allowed disabled:opacity-55"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === preferenceOrder.length - 1}
                onClick={() => onMoveRule(ruleId, 1)}
                aria-label="Move down"
                className="min-h-11 flex-1 rounded-full border border-border px-4 text-sm font-medium transition hover:border-blue/20 hover:bg-blue/[0.03] disabled:cursor-not-allowed disabled:opacity-55"
              >
                ↓
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
