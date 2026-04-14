import React from "react";

import type { GeneratedSchedule } from "@/app/schedule-builder/schedule-data";

type ScheduleResultsView = "cards" | "calendar";

type ScheduleResultsProps = {
  schedules: GeneratedSchedule[];
  selectedScheduleIndex: number;
  loading: boolean;
  errorMessage: string | null;
  view: ScheduleResultsView;
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
  loading,
  errorMessage,
  view,
  onSelectSchedule,
  onViewChange,
}: ScheduleResultsProps) {
  const selectedSchedule = schedules[selectedScheduleIndex] ?? null;

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
          {errorMessage}
        </div>
      ) : null}

      {!loading && !errorMessage && schedules.length === 0 ? (
        <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-5 text-sm leading-7 text-black/65 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">
          <p>No conflict-free schedules match your current courses and section choices.</p>
          <p>Relax your locked or excluded sections and try again.</p>
        </div>
      ) : null}

      {!loading && !errorMessage && schedules.length > 0 && view === "cards" ? (
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
      ) : null}

      {!loading && !errorMessage && schedules.length > 0 && view === "calendar" ? (
        <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.04]">
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
      ) : null}
    </section>
  );
}
