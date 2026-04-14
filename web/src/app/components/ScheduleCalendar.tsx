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

const HOUR_HEIGHT_REM = 4;

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
  const timeWindow = deriveTimeWindow(entries);
  const timeLabels = buildTimeLabels(timeWindow.startMinutes, timeWindow.endMinutes);
  const calendarHeightRem = ((timeWindow.endMinutes - timeWindow.startMinutes) / 60) * HOUR_HEIGHT_REM;

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

      <div className="overflow-x-auto rounded-3xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="grid min-w-[42rem] grid-cols-[4.5rem_repeat(var(--calendar-columns),minmax(0,1fr))] gap-3" style={{ ["--calendar-columns" as string]: visibleWeekdays.length }}>
          <div />
          {visibleWeekdays.map((weekday) => (
            <div key={weekday} className="rounded-2xl bg-white/70 px-3 py-2 text-center text-sm font-semibold dark:bg-white/[0.05]">
              {WEEKDAY_LABELS[weekday]}
            </div>
          ))}

          <div className="relative" style={{ height: `${calendarHeightRem}rem` }}>
            {timeLabels.map((labelMinute) => {
              const top = getOffsetPercent(labelMinute, timeWindow.startMinutes, timeWindow.endMinutes);

              return (
                <div
                  key={labelMinute}
                  className="absolute left-0 right-0 -translate-y-1/2 text-xs text-black/50 dark:text-white/50"
                  style={{ top: `${top}%` }}
                >
                  {formatMinutes(labelMinute)}
                </div>
              );
            })}
          </div>

          {visibleWeekdays.map((weekday) => {
            const weekdayEntries = entries.filter((entry) => entry.weekday === weekday);

            return (
              <div
                key={weekday}
                aria-label={WEEKDAY_LABELS[weekday]}
                className="relative rounded-2xl border border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/[0.05]"
                style={{ height: `${calendarHeightRem}rem` }}
              >
                {timeLabels.map((labelMinute) => {
                  const top = getOffsetPercent(labelMinute, timeWindow.startMinutes, timeWindow.endMinutes);

                  return (
                    <div
                      key={labelMinute}
                      className="absolute left-0 right-0 border-t border-dashed border-black/8 dark:border-white/10"
                      style={{ top: `${top}%` }}
                    />
                  );
                })}

                {weekdayEntries.map((entry) => {
                  const top = getOffsetPercent(entry.startMinutes, timeWindow.startMinutes, timeWindow.endMinutes);
                  const height = getOffsetPercent(entry.endMinutes, timeWindow.startMinutes, timeWindow.endMinutes) - top;

                  return (
                    <article
                      key={`${entry.sourcePackageId}-${entry.weekday}-${entry.startMinutes}-${entry.endMinutes}-${entry.meetingType ?? "meeting"}`}
                      className="absolute left-2 right-2 overflow-hidden rounded-xl border border-black/10 bg-black/[0.06] p-2 dark:border-white/10 dark:bg-white/[0.1]"
                      style={{ top: `${top}%`, height: `${Math.max(height, 6)}%`, position: "absolute" }}
                    >
                      <div className="flex flex-col gap-1 text-xs leading-5">
                        <p className="font-semibold">{entry.courseDesignation}</p>
                        <p className="text-black/72 dark:text-white/72">{entry.sectionBundleLabel}</p>
                        <p className="text-black/60 dark:text-white/60">{formatMinutes(entry.startMinutes)}-{formatMinutes(entry.endMinutes)}</p>
                        <p className="text-black/60 dark:text-white/60">
                          {[entry.buildingName, entry.room].filter(Boolean).join(" • ") || "Location unavailable"}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function deriveTimeWindow(entries: ScheduleCalendarEntry[]): { startMinutes: number; endMinutes: number } {
  const earliestStart = Math.min(...entries.map((entry) => entry.startMinutes));
  const latestEnd = Math.max(...entries.map((entry) => entry.endMinutes));

  return {
    startMinutes: Math.floor(earliestStart / 60) * 60,
    endMinutes: Math.ceil(latestEnd / 60) * 60,
  };
}

function buildTimeLabels(startMinutes: number, endMinutes: number): number[] {
  const labels: number[] = [];

  for (let minutes = startMinutes; minutes <= endMinutes; minutes += 60) {
    labels.push(minutes);
  }

  return labels;
}

function getOffsetPercent(minutes: number, startMinutes: number, endMinutes: number): number {
  const totalRange = Math.max(endMinutes - startMinutes, 60);
  return ((minutes - startMinutes) / totalRange) * 100;
}

function formatMinutes(totalMinutes: number): string {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;

  return `${hour12}:${minute.toString().padStart(2, "0")} ${suffix}`;
}
