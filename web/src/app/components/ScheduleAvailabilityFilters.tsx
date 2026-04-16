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
      <label className="flex items-start gap-3 rounded-3xl border border-border bg-muted p-4 text-sm font-medium text-text-weak">
        <input
          type="checkbox"
          checked={includeWaitlisted}
          onChange={(event) => onIncludeWaitlistedChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border border-border bg-transparent"
        />
        <span className="flex flex-col gap-1">
          <span>Include waitlisted sections</span>
          <span className="text-xs font-normal leading-6 text-text-faint">
            Allow schedules that rely on sections with no open seats but an active waitlist.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-3xl border border-border bg-muted p-4 text-sm font-medium text-text-weak">
        <input
          type="checkbox"
          checked={includeClosed}
          onChange={(event) => onIncludeClosedChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border border-border bg-transparent"
        />
        <span className="flex flex-col gap-1">
          <span>Include closed sections</span>
          <span className="text-xs font-normal leading-6 text-text-faint">
            Allow schedules that rely on sections with no open seats and no usable waitlist.
          </span>
        </span>
      </label>

      <p className="text-sm leading-7 text-text-faint">
        Locked sections still count even if these are off.
      </p>
    </div>
  );
}
