import React from "react";

import {
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

const CALENDAR_WEEKDAYS: VisibleWeekday[] = ["M", "T", "W", "R", "F", "S", "U"];

const HOUR_HEIGHT_REM = 4;
const BASELINE_START_MINUTES = 9 * 60;
const BASELINE_END_MINUTES = 17 * 60;

const COURSE_COLORS = [
  { bg: "bg-blue/[0.12] border-blue/[0.25]" },
  { bg: "bg-amber-500/15 border-amber-500/30" },
  { bg: "bg-violet-500/15 border-violet-500/30" },
  { bg: "bg-rose-500/15 border-rose-500/30" },
  { bg: "bg-teal-500/15 border-teal-500/30" },
  { bg: "bg-orange-500/15 border-orange-500/30" },
];

function badgeClasses(sectionType: string | null): string {
  switch (sectionType) {
    case "LEC": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "LAB": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "DIS": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    default: return "bg-black/8 dark:bg-white/10";
  }
}

export function ScheduleCalendar({ schedule, entries }: ScheduleCalendarProps) {
  if (!schedule) {
    return (
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">
            Weekly Calendar
          </h2>
        </div>
        <div className="rounded-xl border border-border bg-muted p-5 text-sm leading-7 text-text-weak">
          Select a generated schedule to see its meetings laid out across the week.
        </div>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">
            Weekly Calendar
          </h2>
        </div>
        <div className="rounded-xl border border-border bg-muted p-5 text-sm leading-7 text-text-weak">
          No calendar meetings are available for this selected schedule.
        </div>
      </section>
    );
  }

  const visibleWeekdays = CALENDAR_WEEKDAYS.filter(
    (d) => (d !== "S" && d !== "U") || entries.some((e) => e.weekday === d),
  );
  const timeWindow = deriveTimeWindow(entries);
  const timeLabels = buildTimeLabels(timeWindow.startMinutes, timeWindow.endMinutes);
  const calendarHeightRem = ((timeWindow.endMinutes - timeWindow.startMinutes) / 60) * HOUR_HEIGHT_REM;

  const courseDesignations = [...new Set(entries.map((e) => e.courseDesignation).filter(Boolean))];
  const getCourseColor = (designation: string | null) => COURSE_COLORS[(designation ? courseDesignations.indexOf(designation) : 0) % COURSE_COLORS.length];

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">
          Weekly Calendar
        </h2>
        <p className="text-sm leading-7 text-text-weak">
          {schedule.packages.length} section choice{schedule.packages.length === 1 ? "" : "s"} in the selected result.
        </p>
      </div>

      {/* Mobile list view */}
      <div className="lg:hidden flex flex-col gap-4">
        {visibleWeekdays.map((weekday) => {
          const dayEntries = entries
            .filter((e) => e.weekday === weekday)
            .sort((a, b) => a.startMinutes - b.startMinutes);
          if (dayEntries.length === 0) return null;
          return (
            <div key={weekday}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-faint">
                {WEEKDAY_LABELS[weekday]}
              </p>
              <div className="flex flex-col gap-2">
                {dayEntries.map((entry) => {
                  const typeLabel = meetingTypeLabel(entry.sectionType);
                  const courseColor = getCourseColor(entry.courseDesignation);
                  return (
                    <div
                      key={`mobile-${entry.sourcePackageId}-${entry.weekday}-${entry.startMinutes}`}
                      className={`rounded-lg border p-3 ${courseColor.bg}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{entry.courseDesignation}</p>
                        {typeLabel ? (
                          <span className={`shrink-0 rounded px-1 py-px text-[10px] font-bold uppercase tracking-wide ${badgeClasses(entry.sectionType)}`}>
                            {typeLabel}{entry.sectionNumber ? ` ${entry.sectionNumber}` : ""}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-text-faint">
                        {formatMinutes(entry.startMinutes)}-{formatMinutes(entry.endMinutes)}
                      </p>
                      <p className="text-xs text-text-faint">
                        {[entry.buildingName, entry.room].filter(Boolean).join(" • ") || "Location unavailable"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop grid view */}
      <div className="hidden lg:block">
        <div className="overflow-x-auto rounded-lg border border-border bg-muted p-4">
          <div
            role="grid"
            className="grid grid-cols-[4rem_repeat(var(--calendar-columns),minmax(0,1fr))] gap-3"
            style={{
              ["--calendar-columns" as string]: visibleWeekdays.length,
              minWidth: `calc(4rem + ${visibleWeekdays.length} * 9rem + ${visibleWeekdays.length - 1} * 0.75rem)`,
            }}
          >
            <div />
            {visibleWeekdays.map((weekday) => (
              <div key={weekday} role="columnheader" className="rounded-lg bg-surface px-3 py-2 text-center text-sm font-semibold">
                {WEEKDAY_LABELS[weekday]}
              </div>
            ))}

            <div role="rowgroup" className="relative" style={{ height: `${calendarHeightRem}rem` }}>
              {timeLabels.map((labelMinute) => {
                const top = getOffsetPercent(labelMinute, timeWindow.startMinutes, timeWindow.endMinutes);

                return (
                  <div
                    key={labelMinute}
                    className="absolute left-0 right-0 -translate-y-1/2 text-xs text-text-faint"
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
                  role="gridcell"
                  aria-label={WEEKDAY_LABELS[weekday]}
                  className="relative rounded-lg border border-border bg-surface"
                  style={{ height: `${calendarHeightRem}rem` }}
                >
                  {timeLabels.map((labelMinute) => {
                    const top = getOffsetPercent(labelMinute, timeWindow.startMinutes, timeWindow.endMinutes);

                    return (
                      <div
                        key={labelMinute}
                        className="absolute left-0 right-0 border-t border-dashed border-border"
                        style={{ top: `${top}%` }}
                      />
                    );
                  })}

                  {weekdayEntries.map((entry) => {
                    const top = getOffsetPercent(entry.startMinutes, timeWindow.startMinutes, timeWindow.endMinutes);
                    const height = getOffsetPercent(entry.endMinutes, timeWindow.startMinutes, timeWindow.endMinutes) - top;
                    const typeLabel = meetingTypeLabel(entry.sectionType);
                    const courseColor = getCourseColor(entry.courseDesignation);

                    return (
                      <article
                        key={`${entry.sourcePackageId}-${entry.weekday}-${entry.startMinutes}-${entry.endMinutes}-${entry.meetingType ?? "meeting"}`}
                        aria-label={`${entry.courseDesignation ?? "Course"}${typeLabel ? ` ${typeLabel}${entry.sectionNumber ? ` ${entry.sectionNumber}` : ""}` : ""} — ${formatMinutes(entry.startMinutes)} to ${formatMinutes(entry.endMinutes)}, ${entry.buildingName ?? "location unavailable"}`}
                        tabIndex={0}
                        className={`absolute left-2 right-2 overflow-hidden rounded-lg p-1 border ${courseColor.bg}`}
                        style={{ top: `${top}%`, height: `${Math.max(height, 6)}%` }}
                      >
                        <div className="flex flex-col gap-0.5 text-xs leading-tight">
                          <p className="font-semibold leading-tight">{entry.courseDesignation}</p>
                          {typeLabel ? (
                            <span className={`self-start rounded px-1 py-px text-[10px] font-bold uppercase tracking-wide ${badgeClasses(entry.sectionType)}`}>
                              {typeLabel}{entry.sectionNumber ? ` ${entry.sectionNumber}` : ""}
                            </span>
                          ) : null}
                          <p className="text-text-faint">
                            {formatMinutes(entry.startMinutes)}-{formatMinutes(entry.endMinutes)}
                          </p>
                          <p className="truncate text-text-faint">
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
      </div>
    </section>
  );
}

function deriveTimeWindow(entries: ScheduleCalendarEntry[]): { startMinutes: number; endMinutes: number } {
  const earliestStart = Math.min(...entries.map((entry) => entry.startMinutes));
  const latestEnd = Math.max(...entries.map((entry) => entry.endMinutes));

  const startMinutes = earliestStart < BASELINE_START_MINUTES
    ? Math.floor(earliestStart / 60) * 60
    : BASELINE_START_MINUTES;

  const endMinutes = latestEnd > BASELINE_END_MINUTES
    ? Math.ceil(latestEnd / 60) * 60
    : BASELINE_END_MINUTES;

  return {
    startMinutes,
    endMinutes,
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

function meetingTypeLabel(sectionType: string | null): string | null {
  return sectionType;
}
