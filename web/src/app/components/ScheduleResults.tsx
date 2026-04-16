import React from "react";

import type { GeneratedSchedule } from "@/app/schedule-builder/schedule-data";

type ScheduleResultsRequestState = "idle" | "loading" | "ready" | "error";

type ScheduleResultsProps = {
  schedules: GeneratedSchedule[];
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

export function ScheduleResults({
  schedules,
  selectedScheduleIndex,
  requestState,
  loading,
  errorMessage,
  zeroLimit = false,
  onRetry,
  onSelectSchedule,
}: ScheduleResultsProps) {
  const resultsCountLabel = `${schedules.length} schedule${schedules.length === 1 ? "" : "s"} generated`;

  return (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-surface p-5 shadow-soft">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">
          Schedule Results
        </h2>
        <p className="text-sm leading-7 text-text-weak">
          Review ranked schedule cards and keep the selected option in view.
        </p>
        {!loading && !errorMessage ? (
          <p className="text-sm font-medium text-text-faint">{resultsCountLabel}</p>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-3xl border border-border bg-muted p-4 text-sm leading-7 text-text-weak">
          Generating schedules...
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/8 p-4 text-sm leading-7 text-red-900 dark:text-red-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{errorMessage}</p>
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

      {!loading && !errorMessage && requestState === "idle" && schedules.length === 0 ? (
        <div className="rounded-3xl border border-border bg-muted p-5 text-sm leading-7 text-text-weak">
          <p>Add courses and section constraints to generate schedules.</p>
        </div>
      ) : null}

      {!loading && !errorMessage && requestState === "ready" && schedules.length === 0 && zeroLimit ? (
        <div className="rounded-3xl border border-border bg-muted p-5 text-sm leading-7 text-text-weak">
          <p>Result limit is set to 0, so the builder is not returning any schedules.</p>
          <p>Increase the limit to generate schedules.</p>
        </div>
      ) : null}

      {!loading && !errorMessage && requestState === "ready" && schedules.length === 0 && !zeroLimit ? (
        <div className="rounded-3xl border border-border bg-muted p-5 text-sm leading-7 text-text-weak">
          <p>No conflict-free schedules matched these courses and section constraints.</p>
          <p>Try unlocking or excluding fewer sections.</p>
        </div>
      ) : null}

      {!loading && !errorMessage && schedules.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Ranked schedules</h3>
            <span className="text-sm text-text-faint">Tap a card to update the calendar</span>
          </div>
          {schedules.map((schedule, index) => {
            const isSelected = index === selectedScheduleIndex;

            return (
              <button
                key={schedule.package_ids.join("|") || `schedule-${index}`}
                type="button"
                onClick={() => onSelectSchedule(index)}
                className={`rounded-3xl border p-4 text-left transition ${isSelected ? "border-blue/25 bg-blue/[0.05]" : "border-border bg-muted hover:border-blue/20 hover:bg-blue/[0.03]"}`}
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
                    <p className="text-sm text-text-faint">
                      {schedule.packages.length} section choice{schedule.packages.length === 1 ? "" : "s"} • {formatTimeRange(schedule)}
                    </p>
                    <div className="flex flex-col gap-1 text-sm leading-7 text-text-weak">
                      {schedule.packages.map((schedulePackage) => (
                        <p key={schedulePackage.source_package_id}>
                          <span className="font-medium">{schedulePackage.course_designation}</span>: {schedulePackage.section_bundle_label}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="text-sm text-text-faint">
                    {schedule.campus_day_count ?? "-"} campus days
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
