import React from "react";

import {
  ALLOWED_END_BEFORE_HOURS,
  ALLOWED_MAX_DAYS,
  ALLOWED_START_AFTER_HOURS,
} from "@/app/schedule-builder/builder-state";

type ScheduleHardFilterBarProps = {
  maxDays: number | null;
  startAfterHour: number | null;
  endBeforeHour: number | null;
  onMaxDaysChange: (value: number | null) => void;
  onStartAfterHourChange: (value: number | null) => void;
  onEndBeforeHourChange: (value: number | null) => void;
};

const MAX_DAY_OPTIONS = [null, ...ALLOWED_MAX_DAYS] as const;
const START_AFTER_OPTIONS = [null, ...ALLOWED_START_AFTER_HOURS] as const;
const END_BEFORE_OPTIONS = [null, ...ALLOWED_END_BEFORE_HOURS] as const;

function renderHourLabel(hour: number | null): string {
  if (hour === null) {
    return "Any";
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12} ${suffix}`;
}

export function ScheduleHardFilterBar({
  maxDays,
  startAfterHour,
  endBeforeHour,
  onMaxDaysChange,
  onStartAfterHourChange,
  onEndBeforeHourChange,
}: ScheduleHardFilterBarProps) {
  const buttonClassName = (active: boolean) =>
    `min-h-9 rounded-lg border px-3 text-sm font-medium transition ${active ? "border-blue/35 bg-blue/[0.08] text-blue" : "border-border bg-transparent text-text-weak hover:border-blue/20 hover:bg-blue/[0.03]"}`;

  return (
    <div className="flex flex-nowrap items-center gap-4 overflow-x-auto border-b border-border pb-3">
      <div role="group" aria-label="Max days/week" className="flex flex-nowrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
          Max days/week
        </span>
        {MAX_DAY_OPTIONS.map((value) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => onMaxDaysChange(value)}
            aria-pressed={maxDays === value}
            className={buttonClassName(maxDays === value)}
          >
            {value ?? "Any"}
          </button>
        ))}
      </div>

      <div className="h-5 w-px shrink-0 bg-border" />

      <div role="group" aria-label="Start classes after" className="flex flex-nowrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
          Start classes after
        </span>
        {START_AFTER_OPTIONS.map((value) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => onStartAfterHourChange(value)}
            aria-pressed={startAfterHour === value}
            className={buttonClassName(startAfterHour === value)}
          >
            {renderHourLabel(value)}
          </button>
        ))}
      </div>

      <div className="h-5 w-px shrink-0 bg-border" />

      <div role="group" aria-label="Finish classes by" className="flex flex-nowrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
          Finish classes by
        </span>
        {END_BEFORE_OPTIONS.map((value) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => onEndBeforeHourChange(value)}
            aria-pressed={endBeforeHour === value}
            className={buttonClassName(endBeforeHour === value)}
          >
            {renderHourLabel(value)}
          </button>
        ))}
      </div>
    </div>
  );
}
