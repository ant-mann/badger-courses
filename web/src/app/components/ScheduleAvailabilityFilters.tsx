import React from "react";

type ScheduleAvailabilityFiltersProps = {
  includeWaitlisted: boolean;
  includeClosed: boolean;
  onIncludeWaitlistedChange: (checked: boolean) => void;
  onIncludeClosedChange: (checked: boolean) => void;
};

export function ScheduleAvailabilityFilters({
  includeWaitlisted,
  includeClosed,
  onIncludeWaitlistedChange,
  onIncludeClosedChange,
}: ScheduleAvailabilityFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-3 rounded-3xl border border-black/10 bg-black/[0.02] p-4 text-sm font-medium text-black/70 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70">
        <input
          type="checkbox"
          checked={includeWaitlisted}
          onChange={(event) => onIncludeWaitlistedChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border border-black/20 bg-transparent dark:border-white/20"
        />
        <span className="flex flex-col gap-1">
          <span>Include waitlisted sections</span>
          <span className="text-xs font-normal leading-6 text-black/55 dark:text-white/55">
            Allow schedules that rely on sections with no open seats but an active waitlist.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-3xl border border-black/10 bg-black/[0.02] p-4 text-sm font-medium text-black/70 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70">
        <input
          type="checkbox"
          checked={includeClosed}
          onChange={(event) => onIncludeClosedChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border border-black/20 bg-transparent dark:border-white/20"
        />
        <span className="flex flex-col gap-1">
          <span>Include closed sections</span>
          <span className="text-xs font-normal leading-6 text-black/55 dark:text-white/55">
            Allow schedules that rely on sections with no open seats and no usable waitlist.
          </span>
        </span>
      </label>

      <p className="text-sm leading-7 text-black/60 dark:text-white/60">
        Locked sections still count even if these are off.
      </p>
    </div>
  );
}
