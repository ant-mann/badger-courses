import React from "react";

import type {
  GeneratedSchedule,
  ScheduleBuilderSchedulesResponse,
} from "@/app/schedule-builder/schedule-data";
import type { PreferenceRuleId } from "@/app/schedule-builder/preferences";

type ScheduleResultsRequestState = "idle" | "loading" | "ready" | "error";

type ScheduleResultsProps = {
  schedules: GeneratedSchedule[];
  emptyStateReason: ScheduleBuilderSchedulesResponse["empty_state_reason"];
  preferenceOrder: PreferenceRuleId[];
  selectedScheduleIndex: number;
  requestState: ScheduleResultsRequestState;
  loading: boolean;
  errorMessage: string | null;
  zeroLimit?: boolean;
  onRetry?: () => void;
  onSelectSchedule: (index: number) => void;
};

function formatTimeRange(schedule: GeneratedSchedule): string {
  if (
    schedule.earliest_start_minute_local === null ||
    schedule.latest_end_minute_local === null
  ) {
    return "Time range unavailable";
  }

  return `${formatMinutes(schedule.earliest_start_minute_local)}-${formatMinutes(schedule.latest_end_minute_local)}`;
}

function formatMinutes(totalMinutes: number): string {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;

  return `${hour12}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

function formatScheduleMetric(
  schedule: GeneratedSchedule,
  ruleId: PreferenceRuleId,
): string | null {
  switch (ruleId) {
    case "later-starts":
      return schedule.earliest_start_minute_local === null
        ? null
        : `${formatMinutes(schedule.earliest_start_minute_local)} start`;
    case "earlier-finishes":
      return schedule.latest_end_minute_local === null
        ? null
        : `${formatMinutes(schedule.latest_end_minute_local)} finish`;
    case "less-time-between-classes":
      return `${schedule.total_between_class_minutes} min less gap`;
    case "more-time-between-classes":
      return `${schedule.total_between_class_minutes} min more gap`;
    case "shorter-walks":
      return `${schedule.total_walking_distance_meters}m walking`;
    case "more-open-seats":
      return `${schedule.total_open_seats} open seats`;
    case "fewer-campus-days":
      return schedule.campus_day_count === null ? null : `${schedule.campus_day_count} campus days`;
    default:
      return null;
  }
}

export function ScheduleResults({
  schedules,
  emptyStateReason,
  preferenceOrder,
  selectedScheduleIndex,
  requestState,
  loading,
  errorMessage,
  zeroLimit = false,
  onRetry,
  onSelectSchedule,
}: ScheduleResultsProps) {
  const visibleErrorMessage = loading ? null : errorMessage;
  const resultsCountLabel = `${schedules.length} schedule${schedules.length === 1 ? "" : "s"} generated`;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-soft">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">
          Schedules
        </h2>
        {!loading && !visibleErrorMessage && schedules.length > 0 ? (
          <p className="text-sm font-medium text-calendar-meta" aria-live="polite">{resultsCountLabel}</p>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-muted p-4 text-sm leading-7 text-text-weak">
          Generating schedules...
        </div>
      ) : null}

      {visibleErrorMessage ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 p-4 text-sm leading-7 text-red-900 dark:text-red-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{visibleErrorMessage}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="min-h-11 rounded-full border border-red-500/25 px-4 text-sm font-medium transition hover:bg-red-500/10"
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loading && !visibleErrorMessage && requestState === "idle" && schedules.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted p-5 text-sm leading-7 text-text-weak">
          <p>Add courses and section constraints to generate schedules.</p>
        </div>
      ) : null}

      {!loading && !visibleErrorMessage && requestState === "ready" && schedules.length === 0 && zeroLimit ? (
        <div className="rounded-lg border border-border bg-muted p-5 text-sm leading-7 text-text-weak">
          <p>Result limit is set to 0, so the builder is not returning any schedules.</p>
          <p>Increase the limit to generate schedules.</p>
        </div>
      ) : null}

      {!loading && !visibleErrorMessage && requestState === "ready" && schedules.length === 0 && !zeroLimit ? (
        <div className="rounded-lg border border-border bg-muted p-5 text-sm leading-7 text-text-weak">
          {emptyStateReason === "hard-filters" ? (
            <>
              <p>No schedules matched your current schedule limits.</p>
              <p>Try widening your day or time filters.</p>
            </>
          ) : (
            <>
              <p>No conflict-free schedules matched these courses and section constraints.</p>
              <p>Try unlocking or excluding fewer sections.</p>
            </>
          )}
        </div>
      ) : null}

      {!loading && !visibleErrorMessage && schedules.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="border-b border-border pb-2">
            <h3 className="text-base font-semibold">Ranked schedules</h3>
          </div>
          {schedules.map((schedule, index) => {
            const isSelected = index === selectedScheduleIndex;
            const metricChips = preferenceOrder
              .map((ruleId) => formatScheduleMetric(schedule, ruleId))
              .filter((metric): metric is string => metric !== null)
              .slice(0, 3);

            return (
              <button
                key={schedule.package_ids.join("|") || `schedule-${index}`}
                type="button"
                onClick={() => onSelectSchedule(index)}
                aria-pressed={isSelected}
                className={`rounded-lg border p-4 text-left transition ${isSelected ? "border-blue/25 bg-blue/[0.05]" : "border-border bg-muted/60 hover:border-blue/20 hover:bg-blue/[0.03]"}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">Schedule {index + 1}</h3>
                      {isSelected ? (
                        <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-900 dark:text-emerald-100">
                          Selected
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-calendar-meta">
                      {schedule.packages.length} section choice{schedule.packages.length === 1 ? "" : "s"} • {formatTimeRange(schedule)}
                    </p>
                    {metricChips.length > 0 ? (
                      <div className="flex flex-wrap gap-2 text-xs font-medium text-calendar-meta">
                        {metricChips.map((metric) => (
                          <span
                            key={metric}
                            className="rounded-full border border-border px-3 py-1"
                          >
                            {metric}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-1 text-sm leading-7 text-text-weak">
                      {schedule.packages.map((schedulePackage) => (
                        <p key={schedulePackage.source_package_id}>
                          <span className="font-medium">{schedulePackage.course_designation}</span>: {schedulePackage.section_bundle_label}
                        </p>
                      ))}
                    </div>
                  </div>

                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
