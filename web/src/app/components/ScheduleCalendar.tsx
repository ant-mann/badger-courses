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

type DesktopCalendarSegment = {
  entry: ScheduleCalendarEntry;
  startMinutes: number;
  endMinutes: number;
  laneIndex: number;
  laneCount: number;
  isSegmentStart: boolean;
  isSegmentEnd: boolean;
  showContent: boolean;
};

type DesktopCalendarSlice = {
  startMinutes: number;
  endMinutes: number;
  entries: ScheduleCalendarEntry[];
};

type ActiveLaneAssignment = {
  entry: ScheduleCalendarEntry;
  laneIndex: number;
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
const LANE_GAP_PERCENT = 1.5;

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
              const segments = buildDesktopSegments(
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

                  {segments.map((segment) => {
                    const { entry, startMinutes, endMinutes, laneIndex, laneCount, isSegmentStart, isSegmentEnd, showContent } = segment;
                    const top = getOffsetPercent(startMinutes, timeWindow.startMinutes, timeWindow.endMinutes);
                    const height = Math.max(
                      getOffsetPercent(endMinutes, timeWindow.startMinutes, timeWindow.endMinutes) - top,
                      6,
                    );
                    const slot = courseSlots.get(entry.courseDesignation) ?? 1;
                    const compact = height < 11;
                    const medium = height >= 11 && height < 18;
                    const laneStyle =
                      laneCount > 1
                        ? buildLaneStyle(laneIndex, laneCount)
                        : { left: "0%", width: "100%" };
                    const segmentRadiusClass = getSegmentRadiusClass(isSegmentStart, isSegmentEnd);

                    return (
                      <article
                        key={`${buildSegmentKey(entry)}-${startMinutes}-${endMinutes}`}
                        aria-label={buildEntryAriaLabel(entry)}
                        aria-hidden={showContent ? undefined : true}
                        data-calendar-entry={entry.sourcePackageId}
                        data-calendar-entry-key={buildSegmentDomKey(entry)}
                        data-calendar-segment-start={startMinutes}
                        data-calendar-segment-end={endMinutes}
                        className={`calendar-course-slot-${slot} absolute overflow-hidden border px-2 py-1.5 ${segmentRadiusClass}`}
                        style={{
                          top: `${top}%`,
                          height: `${height}%`,
                          ...laneStyle,
                        }}
                      >
                        {showContent ? (
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
                        ) : (
                          <div aria-hidden="true" className="h-full w-full" />
                        )}
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

function buildDesktopSegments(entries: ScheduleCalendarEntry[]): DesktopCalendarSegment[] {
  const sortedEntries = [...entries].sort(compareEntriesByTime);
  const slices = buildDesktopSlices(sortedEntries);
  let previousAssignments = new Map<string, number>();
  const entrySegments = new Map<string, DesktopCalendarSegment[]>();

  for (const slice of slices) {
    const assignments = assignSliceLanes(slice.entries, previousAssignments);
    const laneCount = assignments.length;

    for (const assignment of assignments) {
      const segmentKey = buildSegmentKey(assignment.entry);
      const existingSegments = entrySegments.get(segmentKey) ?? [];
      const previousSegment = existingSegments[existingSegments.length - 1];

      if (
        previousSegment &&
        previousSegment.endMinutes === slice.startMinutes &&
        previousSegment.laneIndex === assignment.laneIndex &&
        previousSegment.laneCount === laneCount
      ) {
        previousSegment.endMinutes = slice.endMinutes;
      } else {
        existingSegments.push({
          entry: assignment.entry,
          startMinutes: slice.startMinutes,
          endMinutes: slice.endMinutes,
          laneIndex: assignment.laneIndex,
          laneCount,
          isSegmentStart: true,
          isSegmentEnd: true,
          showContent: false,
        });
      }

      entrySegments.set(segmentKey, existingSegments);
    }

    previousAssignments = new Map(
      assignments.map((assignment) => [buildSegmentKey(assignment.entry), assignment.laneIndex]),
    );
  }

  return [...entrySegments.values()]
    .flatMap((segmentsForEntry) => {
      const contentIndex = segmentsForEntry.findIndex((segment) => getSegmentDuration(segment) >= 45);

      return segmentsForEntry.map((segment, index) => ({
        ...segment,
        isSegmentStart: index === 0,
        isSegmentEnd: index === segmentsForEntry.length - 1,
        showContent: contentIndex === -1 ? index === 0 : index === contentIndex,
      }));
    })
    .sort((left, right) =>
      left.startMinutes - right.startMinutes ||
      left.endMinutes - right.endMinutes ||
      left.laneIndex - right.laneIndex ||
      compareEntriesByTime(left.entry, right.entry),
    );
}

function buildDesktopSlices(entries: ScheduleCalendarEntry[]): DesktopCalendarSlice[] {
  const boundaries = [...new Set(entries.flatMap((entry) => [entry.startMinutes, entry.endMinutes]))].sort(
    (left, right) => left - right,
  );
  const slices: DesktopCalendarSlice[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startMinutes = boundaries[index];
    const endMinutes = boundaries[index + 1];

    if (endMinutes <= startMinutes) {
      continue;
    }

    const activeEntries = entries.filter(
      (entry) => entry.startMinutes < endMinutes && entry.endMinutes > startMinutes,
    );

    if (activeEntries.length === 0) {
      continue;
    }

    slices.push({
      startMinutes,
      endMinutes,
      entries: [...activeEntries].sort(compareEntriesByTime),
    });
  }

  return slices;
}

function assignSliceLanes(
  entries: ScheduleCalendarEntry[],
  previousAssignments: Map<string, number>,
): ActiveLaneAssignment[] {
  const assignments: ActiveLaneAssignment[] = [];
  const occupiedLaneIndexes = new Set<number>();

  const continuingEntries = entries.filter((entry) => previousAssignments.has(buildSegmentKey(entry)));
  const newEntries = entries.filter((entry) => !previousAssignments.has(buildSegmentKey(entry)));

  for (const entry of continuingEntries) {
    const laneIndex = previousAssignments.get(buildSegmentKey(entry));

    if (laneIndex === undefined || occupiedLaneIndexes.has(laneIndex)) {
      continue;
    }

    occupiedLaneIndexes.add(laneIndex);
    assignments.push({ entry, laneIndex });
  }

  for (const entry of newEntries) {
    const laneIndex = findNextAvailableLane(occupiedLaneIndexes);
    occupiedLaneIndexes.add(laneIndex);
    assignments.push({ entry, laneIndex });
  }

  return [...assignments]
    .sort((left, right) => left.laneIndex - right.laneIndex || compareEntriesByTime(left.entry, right.entry))
    .map((assignment, laneIndex) => ({
      entry: assignment.entry,
      laneIndex,
    }));
}

function findNextAvailableLane(occupiedLaneIndexes: Set<number>): number {
  let laneIndex = 0;

  while (occupiedLaneIndexes.has(laneIndex)) {
    laneIndex += 1;
  }

  return laneIndex;
}

function buildSegmentKey(entry: ScheduleCalendarEntry): string {
  return JSON.stringify([
    entry.sourcePackageId,
    entry.weekday,
    entry.startMinutes,
    entry.endMinutes,
    entry.meetingType,
    entry.sectionType,
    entry.sectionNumber,
    entry.sectionBundleLabel,
    entry.title,
    entry.buildingName,
    entry.room,
  ]);
}

function buildSegmentDomKey(entry: ScheduleCalendarEntry): string {
  const source = buildSegmentKey(entry);
  let hash = 5381;

  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) + hash + source.charCodeAt(index)) >>> 0;
  }

  return `segment-${hash.toString(36)}`;
}

function getSegmentDuration(segment: Pick<DesktopCalendarSegment, "startMinutes" | "endMinutes">): number {
  return segment.endMinutes - segment.startMinutes;
}

function buildLaneStyle(laneIndex: number, laneCount: number): { left: string; width: string } {
  const geometry = buildLaneGeometry(laneIndex, laneCount);

  return {
    left: `${geometry.leftPercent}%`,
    width: `${geometry.widthPercent}%`,
  };
}

function buildLaneGeometry(laneIndex: number, laneCount: number): { leftPercent: number; widthPercent: number } {
  if (laneCount <= 1) {
    return { leftPercent: 0, widthPercent: 100 };
  }

  const totalGap = LANE_GAP_PERCENT * (laneCount - 1);
  const widthPercent = (100 - totalGap) / laneCount;

  return {
    leftPercent: (widthPercent + LANE_GAP_PERCENT) * laneIndex,
    widthPercent,
  };
}

function getSegmentRadiusClass(isSegmentStart: boolean, isSegmentEnd: boolean): string {
  if (isSegmentStart && isSegmentEnd) {
    return "rounded-md";
  }

  if (isSegmentStart) {
    return "rounded-t-md rounded-b-sm";
  }

  if (isSegmentEnd) {
    return "rounded-t-sm rounded-b-md";
  }

  return "rounded-sm";
}

function compareEntriesByTime(left: ScheduleCalendarEntry, right: ScheduleCalendarEntry): number {
  return (
    left.startMinutes - right.startMinutes ||
    left.endMinutes - right.endMinutes ||
    left.courseDesignation.localeCompare(right.courseDesignation) ||
    left.sourcePackageId.localeCompare(right.sourcePackageId) ||
    (left.sectionType ?? "").localeCompare(right.sectionType ?? "") ||
    (left.sectionNumber ?? "").localeCompare(right.sectionNumber ?? "") ||
    left.title.localeCompare(right.title) ||
    (left.buildingName ?? "").localeCompare(right.buildingName ?? "") ||
    (left.room ?? "").localeCompare(right.room ?? "") ||
    left.sectionBundleLabel.localeCompare(right.sectionBundleLabel)
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
  const locationLabel = formatLocation(entry);

  return `${entry.courseDesignation}${meetingLabel} - ${formatMinutes(entry.startMinutes)} to ${formatMinutes(entry.endMinutes)}, ${locationLabel}`;
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
