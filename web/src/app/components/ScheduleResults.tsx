import React from "react";

import type { GeneratedSchedule } from "@/app/schedule-builder/schedule-data";

type ScheduleResultsView = "cards" | "calendar";
type ScheduleResultsRequestState = "idle" | "loading" | "ready" | "error";

type ScheduleResultsProps = {
  schedules: GeneratedSchedule[];
  selectedScheduleIndex: number;
  requestState: ScheduleResultsRequestState;
  loading: boolean;
  errorMessage: string | null;
  view: ScheduleResultsView;
  zeroLimit?: boolean;
  onRetry?: () => void;
  onSelectSchedule: (index: number) => void;
  onViewChange: (view: ScheduleResultsView) => void;
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
  view,
  zeroLimit = false,
  onRetry,
  onSelectSchedule,
  onViewChange,
}: ScheduleResultsProps) {
  const selectedSchedule = schedules[selectedScheduleIndex] ?? null;
  const resultsCountLabel = `${schedules.length} schedule${schedules.length === 1 ? "" : "s"} generated`;
  const cardsSectionClassName = view === "cards" ? "order-1" : "order-2";
  const calendarSectionClassName = view === "calendar" ? "order-1" : "order-2";

  return (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-black/10 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-black/55 dark:text-white/55">
            Schedule Results
          </p>
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">Compare generated schedules</h2>
          <p className="text-sm leading-7 text-black/68 dark:text-white/68">
            Review ranked schedule cards and keep the selected option in view.
          </p>
          {!loading && !errorMessage ? (
            <p className="text-sm font-medium text-black/60 dark:text-white/60">{resultsCountLabel}</p>
          ) : null}
        </div>

        <div className="inline-flex rounded-full border border-black/10 bg-black/[0.02] p-1 dark:border-white/10 dark:bg-white/[0.04]">
          <button
            type="button"
            onClick={() => onViewChange("cards")}
            aria-pressed={view === "cards"}
            className={`min-h-11 rounded-full px-4 text-sm font-medium transition ${view === "cards" ? "bg-black text-white dark:bg-white dark:text-black" : "text-black/70 hover:bg-black/[0.04] dark:text-white/70 dark:hover:bg-white/[0.08]"}`}
          >
            Cards view
          </button>
          <button
            type="button"
            onClick={() => onViewChange("calendar")}
            aria-pressed={view === "calendar"}
            className={`min-h-11 rounded-full px-4 text-sm font-medium transition ${view === "calendar" ? "bg-black text-white dark:bg-white dark:text-black" : "text-black/70 hover:bg-black/[0.04] dark:text-white/70 dark:hover:bg-white/[0.08]"}`}
          >
            Calendar view
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-4 text-sm leading-7 text-black/65 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">
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
        <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-5 text-sm leading-7 text-black/65 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">
          <p>Add courses and section constraints to generate schedules.</p>
        </div>
      ) : null}

      {!loading && !errorMessage && requestState === "ready" && schedules.length === 0 && zeroLimit ? (
        <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-5 text-sm leading-7 text-black/65 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">
          <p>Result limit is set to 0, so the builder is not returning any schedules.</p>
          <p>Increase the limit to generate schedules.</p>
        </div>
      ) : null}

      {!loading && !errorMessage && requestState === "ready" && schedules.length === 0 && !zeroLimit ? (
        <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-5 text-sm leading-7 text-black/65 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">
          <p>No conflict-free schedules matched these courses and section constraints.</p>
          <p>Try unlocking or excluding fewer sections.</p>
        </div>
      ) : null}

      {!loading && !errorMessage && schedules.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className={cardsSectionClassName}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Ranked schedules</h3>
              <span className="text-sm text-black/60 dark:text-white/60">Tap a card to update the calendar</span>
            </div>
            <div className="flex flex-col gap-3">
              {schedules.map((schedule, index) => {
                const isSelected = index === selectedScheduleIndex;

                return (
                  <button
                    key={schedule.package_ids.join("|") || `schedule-${index}`}
                    type="button"
                    onClick={() => onSelectSchedule(index)}
                    className={`rounded-3xl border p-4 text-left transition ${isSelected ? "border-black/25 bg-black/[0.04] dark:border-white/25 dark:bg-white/[0.06]" : "border-black/10 bg-black/[0.02] hover:border-black/20 hover:bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20 dark:hover:bg-white/[0.06]"}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold">Schedule {index + 1}</h3>
                          {isSelected ? (
                            <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-900 dark:text-emerald-100">
                              Selected schedule
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-black/60 dark:text-white/60">
                          {schedule.packages.length} section choice{schedule.packages.length === 1 ? "" : "s"} • {formatTimeRange(schedule)}
                        </p>
                        <div className="flex flex-col gap-1 text-sm leading-7 text-black/68 dark:text-white/68">
                          {schedule.packages.map((schedulePackage) => (
                            <p key={schedulePackage.source_package_id}>
                              <span className="font-medium">{schedulePackage.course_designation}</span>: {schedulePackage.section_bundle_label}
                            </p>
                          ))}
                        </div>
                      </div>

                      <div className="text-sm text-black/60 dark:text-white/60">
                        {schedule.campus_day_count ?? "-"} campus days
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={calendarSectionClassName}>
            <div className={`rounded-3xl border p-5 ${view === "calendar" ? "border-black/20 bg-black/[0.04] dark:border-white/20 dark:bg-white/[0.06]" : "border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.04]"}`}>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">Calendar preview</h3>
                  <span className="rounded-full bg-black/[0.05] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-black/60 dark:bg-white/[0.06] dark:text-white/60">
                    Schedule {selectedScheduleIndex + 1}
                  </span>
                </div>
                {selectedSchedule ? (
                  <>
                    <p className="text-sm text-black/60 dark:text-white/60">
                      {selectedSchedule.packages.length} section choice{selectedSchedule.packages.length === 1 ? "" : "s"} • {formatTimeRange(selectedSchedule)}
                    </p>
                    <div className="flex flex-col gap-1 text-sm leading-7 text-black/68 dark:text-white/68">
                      {selectedSchedule.packages.map((schedulePackage) => (
                        <p key={schedulePackage.source_package_id}>
                          <span className="font-medium">{schedulePackage.course_designation}</span>: {schedulePackage.section_bundle_label}
                        </p>
                      ))}
                    </div>
                    <p className="text-sm text-black/60 dark:text-white/60">
                      Open the full calendar below to inspect the weekly layout for this selection.
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
