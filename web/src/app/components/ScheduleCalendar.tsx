import React from "react";

import {
  getVisibleWeekdays,
  type GeneratedSchedule,
  type ScheduleCalendarEntry,
  type VisibleWeekday,
} from "@/app/schedule-builder/schedule-data";

type ScheduleCalendarProps = {
  schedule: GeneratedSchedule | null;
  entries: ScheduleCalendarEntry[];
};

const WEEKDAY_LABELS: Record<VisibleWeekday, string> = {
  M: "Mon",
  T: "Tue",
  W: "Wed",
  R: "Thu",
  F: "Fri",
  S: "Sat",
  U: "Sun",
};

export function ScheduleCalendar({ schedule, entries }: ScheduleCalendarProps) {
  if (!schedule) {
    return (
      <section className="flex flex-col gap-4 rounded-[2rem] border border-black/10 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-black/55 dark:text-white/55">
            Weekly Calendar
          </p>
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">Selected schedule layout</h2>
        </div>
        <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-5 text-sm leading-7 text-black/65 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">
          Select a generated schedule to see its meetings laid out across the week.
        </div>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="flex flex-col gap-4 rounded-[2rem] border border-black/10 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-black/55 dark:text-white/55">
            Weekly Calendar
          </p>
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">Selected schedule layout</h2>
        </div>
        <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-5 text-sm leading-7 text-black/65 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">
          No calendar meetings are available for this selected schedule.
        </div>
      </section>
    );
  }

  const visibleWeekdays = getVisibleWeekdays(entries).filter((weekday) =>
    entries.some((entry) => entry.weekday === weekday),
  );

  return (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-black/10 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-black/55 dark:text-white/55">
          Weekly Calendar
        </p>
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">Selected schedule layout</h2>
        <p className="text-sm leading-7 text-black/68 dark:text-white/68">
          {schedule.packages.length} section choice{schedule.packages.length === 1 ? "" : "s"} in the selected result.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {visibleWeekdays.map((weekday) => {
          const weekdayEntries = entries.filter((entry) => entry.weekday === weekday);

          return (
            <section
              key={weekday}
              aria-label={WEEKDAY_LABELS[weekday]}
              className="rounded-3xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">{WEEKDAY_LABELS[weekday]}</h3>
                <span className="text-xs uppercase tracking-[0.18em] text-black/50 dark:text-white/50">
                  {weekdayEntries.length} meeting{weekdayEntries.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {weekdayEntries.map((entry) => (
                  <article
                    key={`${entry.sourcePackageId}-${entry.weekday}-${entry.startMinutes}-${entry.endMinutes}-${entry.meetingType ?? "meeting"}`}
                    className="rounded-2xl border border-black/10 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.05]"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold">{entry.courseDesignation}</p>
                      <p className="text-sm text-black/68 dark:text-white/68">{entry.sectionBundleLabel}</p>
                      <p className="text-sm text-black/60 dark:text-white/60">
                        {formatMinutes(entry.startMinutes)}-{formatMinutes(entry.endMinutes)}
                      </p>
                      <p className="text-sm text-black/60 dark:text-white/60">
                        {[entry.meetingType, entry.buildingName, entry.room].filter(Boolean).join(" • ") || "Location unavailable"}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function formatMinutes(totalMinutes: number): string {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;

  return `${hour12}:${minute.toString().padStart(2, "0")} ${suffix}`;
}
