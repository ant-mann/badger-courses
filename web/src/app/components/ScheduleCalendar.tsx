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

type PositionedCalendarEntry = {
  entry: ScheduleCalendarEntry;
  laneIndex: number;
  laneCount: number;
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
const COURSE_SLOT_COUNT = 8;

export function ScheduleCalendar({ schedule, entries }: ScheduleCalendarProps) {
  if (!schedule) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">Weekly Calendar</h2>
        </div>
        <div className="rounded-lg border border-border bg-muted p-5 text-sm leading-7 text-text-weak">
          Select a generated schedule to see its meetings laid out across the week.
        </div>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">Weekly Calendar</h2>
        </div>
        <div className="rounded-lg border border-border bg-muted p-5 text-sm leading-7 text-text-weak">
          No calendar meetings are available for this selected schedule.
        </div>
      </section>
    );
  }

  const visibleWeekdays = CALENDAR_WEEKDAYS.filter(
    (weekday) => (weekday !== "S" && weekday !== "U") || entries.some((entry) => entry.weekday === weekday),
  );
  const timeWindow = deriveTimeWindow(entries);
  const timeLabels = buildTimeLabels(timeWindow.startMinutes, timeWindow.endMinutes);
  const calendarHeightRem = ((timeWindow.endMinutes - timeWindow.startMinutes) / 60) * HOUR_HEIGHT_REM;
  const courseSlots = new Map(
    [...new Set(entries.map((entry) => entry.courseDesignation).filter(Boolean))].map((designation, index) => [designation, (index % COURSE_SLOT_COUNT) + 1] as const),
  );

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-soft">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">Weekly Calendar</h2>
        <p className="text-sm leading-6 text-calendar-meta">
          {schedule.packages.length} section choice{schedule.packages.length === 1 ? "" : "s"} in the selected result.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:hidden">
        {visibleWeekdays.map((weekday) => {
          const dayEntries = entries
            .filter((entry) => entry.weekday === weekday)
            .sort(compareEntriesByTime);

          if (dayEntries.length === 0) {
            return null;
          }

          return (
            <section key={weekday} className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-calendar-axis">
                {WEEKDAY_LABELS[weekday]}
              </p>
              <div className="flex flex-col gap-2">
                {dayEntries.map((entry) => {
                  const slot = courseSlots.get(entry.courseDesignation) ?? 1;
                  const heightClass = getMobileEventDensityClass(entry);

                  return (
                    <article
                      key={`mobile-${entry.sourcePackageId}-${entry.weekday}-${entry.startMinutes}-${entry.endMinutes}`}
                      aria-label={buildEntryAriaLabel(entry)}
                      className={`calendar-course-slot-${slot} rounded-lg border px-3 py-2 ${heightClass}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-semibold leading-tight">{entry.courseDesignation}</p>
                        {renderTypeBadge(entry, slot)}
                      </div>
                      <p className="mt-1 text-xs font-medium text-calendar-meta">
                        {formatMinutes(entry.startMinutes)}-{formatMinutes(entry.endMinutes)}
                      </p>
                      <p className="text-xs leading-tight text-calendar-meta">
                        {formatLocation(entry)}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="hidden lg:block">
        <div className="overflow-x-auto rounded-lg border border-border bg-muted p-4">
          <div
            className="grid grid-cols-[4rem_repeat(var(--calendar-columns),minmax(0,1fr))] gap-2.5"
            style={{
              ["--calendar-columns" as string]: visibleWeekdays.length,
              minWidth: `calc(4rem + ${visibleWeekdays.length} * 9rem + ${visibleWeekdays.length - 1} * 0.625rem)`,
            }}
          >
            <div />
            {visibleWeekdays.map((weekday) => (
              <div key={weekday} className="rounded-md border border-border bg-surface px-3 py-2 text-center text-sm font-semibold">
                {WEEKDAY_LABELS[weekday]}
              </div>
            ))}

            <div className="relative" style={{ height: `${calendarHeightRem}rem` }}>
              {timeLabels.map((labelMinute) => {
                const top = getOffsetPercent(labelMinute, timeWindow.startMinutes, timeWindow.endMinutes);

                return (
                  <div
                    key={labelMinute}
                    className="absolute left-0 right-0 -translate-y-1/2 text-xs font-medium text-calendar-axis"
                    style={{ top: `${top}%` }}
                  >
                    {formatMinutes(labelMinute)}
                  </div>
                );
              })}
            </div>

            {visibleWeekdays.map((weekday) => {
              const positionedEntries = buildPositionedEntries(
                entries.filter((entry) => entry.weekday === weekday),
              );

              return (
                <section
                  key={weekday}
                  aria-label={WEEKDAY_LABELS[weekday]}
                  className="relative rounded-md border border-border bg-surface"
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

                  {positionedEntries.map(({ entry, laneIndex, laneCount }) => {
                    const top = getOffsetPercent(entry.startMinutes, timeWindow.startMinutes, timeWindow.endMinutes);
                    const height = Math.max(
                      getOffsetPercent(entry.endMinutes, timeWindow.startMinutes, timeWindow.endMinutes) - top,
                      6,
                    );
                    const slot = courseSlots.get(entry.courseDesignation) ?? 1;
                    const compact = height < 11;
                    const medium = height >= 11 && height < 18;
                    const laneStyle =
                      laneCount > 1
                        ? buildLaneStyle(laneIndex, laneCount)
                        : { left: "0%", width: "100%" };

                    return (
                      <article
                        key={`${entry.sourcePackageId}-${entry.weekday}-${entry.startMinutes}-${entry.endMinutes}-${entry.meetingType ?? "meeting"}`}
                        aria-label={buildEntryAriaLabel(entry)}
                        className={`calendar-course-slot-${slot} absolute overflow-hidden rounded-md border px-2 py-1.5`}
                        style={{
                          top: `${top}%`,
                          height: `${height}%`,
                          ...laneStyle,
                        }}
                      >
                        <div className="flex h-full flex-col gap-1 text-[11px] leading-tight">
                          <div className="flex items-start justify-between gap-1.5">
                            <p className="min-w-0 truncate font-semibold leading-tight">{entry.courseDesignation}</p>
                            {renderTypeBadge(entry, slot)}
                          </div>
                          <p className="font-medium text-calendar-meta">
                            {formatMinutes(entry.startMinutes)}-{formatMinutes(entry.endMinutes)}
                          </p>
                          {!compact ? (
                            <p className={`${medium ? "truncate" : "leading-tight"} text-calendar-meta`}>
                              {formatLocation(entry)}
                            </p>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function buildPositionedEntries(entries: ScheduleCalendarEntry[]): PositionedCalendarEntry[] {
  const sortedEntries = [...entries].sort(compareEntriesByTime);
  const positionedEntries: PositionedCalendarEntry[] = [];
  let clusterEntries: ScheduleCalendarEntry[] = [];
  let clusterEnd = -1;

  for (const entry of sortedEntries) {
    if (clusterEntries.length === 0 || entry.startMinutes < clusterEnd) {
      clusterEntries.push(entry);
      clusterEnd = Math.max(clusterEnd, entry.endMinutes);
      continue;
    }

    positionedEntries.push(...positionClusterEntries(clusterEntries));
    clusterEntries = [entry];
    clusterEnd = entry.endMinutes;
  }

  if (clusterEntries.length > 0) {
    positionedEntries.push(...positionClusterEntries(clusterEntries));
  }

  return positionedEntries;
}

function positionClusterEntries(clusterEntries: ScheduleCalendarEntry[]): PositionedCalendarEntry[] {
  const activeLaneEndTimes: number[] = [];
  const laneIndexes = new Map<ScheduleCalendarEntry, number>();
  let laneCount = 0;

  for (const entry of clusterEntries) {
    let laneIndex = activeLaneEndTimes.findIndex((endMinutes) => endMinutes <= entry.startMinutes);

    if (laneIndex === -1) {
      laneIndex = activeLaneEndTimes.length;
      activeLaneEndTimes.push(entry.endMinutes);
    } else {
      activeLaneEndTimes[laneIndex] = entry.endMinutes;
    }

    laneIndexes.set(entry, laneIndex);
    laneCount = Math.max(laneCount, activeLaneEndTimes.length);
  }

  return clusterEntries.map((entry) => ({
    entry,
    laneIndex: laneIndexes.get(entry) ?? 0,
    laneCount,
  }));
}

function buildLaneStyle(laneIndex: number, laneCount: number): { left: string; width: string } {
  const laneGap = laneCount > 1 ? 1.5 : 0;
  const totalGap = laneGap * (laneCount - 1);
  return {
    left: `calc(((100% - ${totalGap}%) / ${laneCount}) * ${laneIndex} + ${laneGap * laneIndex}%)`,
    width: `calc((100% - ${totalGap}%) / ${laneCount})`,
  };
}

function compareEntriesByTime(left: ScheduleCalendarEntry, right: ScheduleCalendarEntry): number {
  return (
    left.startMinutes - right.startMinutes ||
    left.endMinutes - right.endMinutes ||
    left.courseDesignation.localeCompare(right.courseDesignation) ||
    left.sourcePackageId.localeCompare(right.sourcePackageId)
  );
}

function renderTypeBadge(entry: ScheduleCalendarEntry, slot: number): React.ReactNode {
  const label = meetingTypeLabel(entry.sectionType);

  if (!label) {
    return null;
  }

  return (
    <span className={`calendar-course-badge-${slot} shrink-0 rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.16em]`}>
      {label}{entry.sectionNumber ? ` ${entry.sectionNumber}` : ""}
    </span>
  );
}

function buildEntryAriaLabel(entry: ScheduleCalendarEntry): string {
  const label = meetingTypeLabel(entry.sectionType);
  const meetingLabel = label ? ` ${label}${entry.sectionNumber ? ` ${entry.sectionNumber}` : ""}` : "";

  return `${entry.courseDesignation}${meetingLabel} - ${formatMinutes(entry.startMinutes)} to ${formatMinutes(entry.endMinutes)}, ${entry.buildingName ?? "location unavailable"}`;
}

function formatLocation(entry: ScheduleCalendarEntry): string {
  return [entry.buildingName, entry.room].filter(Boolean).join(" • ") || "Location unavailable";
}

function getMobileEventDensityClass(entry: ScheduleCalendarEntry): string {
  const duration = entry.endMinutes - entry.startMinutes;
  return duration < 60 ? "min-h-16" : "min-h-20";
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

  return { startMinutes, endMinutes };
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
