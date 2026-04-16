"use client";

import React, { useState } from "react";

import type { CourseMeeting, SchedulePackage } from "@/lib/course-data";

import type { ScheduleBuilderCourseDetailResponse } from "@/app/schedule-builder/schedule-data";

type SectionOptionPanelProps = {
  course: ScheduleBuilderCourseDetailResponse;
  lockedSectionId: string | null;
  excludedSectionIds: string[];
  loading: boolean;
  errorMessage: string | null;
  onLockSection: (sourcePackageId: string | null) => void;
  onExcludeSection: (sourcePackageId: string, excluded: boolean) => void;
};

type MeetingLine = {
  label: string;
  detail: string;
};

function isExcluded(excludedSectionIds: string[], sourcePackageId: string): boolean {
  return excludedSectionIds.includes(sourcePackageId);
}

function seatsLabel(schedulePackage: SchedulePackage): string {
  if (schedulePackage.isFull) {
    return "Full";
  }

  if (schedulePackage.openSeats !== null) {
    return `${schedulePackage.openSeats} open seats`;
  }

  return "Seat availability unavailable";
}

function parseBundleSections(sectionBundleLabel: string): Array<{
  sectionType: string;
  sectionNumber: string;
}> {
  return sectionBundleLabel
    .split("+")
    .map((part) => part.trim())
    .map((part) => /(?:^|\s)([A-Z]+)\s+([A-Z0-9]+)$/.exec(part))
    .flatMap((match) =>
      match
        ? [
            {
              sectionType: match[1],
              sectionNumber: match[2],
            },
          ]
        : [],
    );
}

function formatLocalTime(value: string | number | null): string | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(value));
  }

  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);

  if (hour > 23 || minute > 59) {
    return null;
  }

  const meridiem = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${match[2]} ${meridiem}`;
}

function formatMeetingDetail(meeting: CourseMeeting): string | null {
  if (!meeting.meetingDays) {
    return null;
  }

  const meetingTimeStart = formatLocalTime(meeting.meetingTimeStart);
  const meetingTimeEnd = formatLocalTime(meeting.meetingTimeEnd);

  if (!meetingTimeStart || !meetingTimeEnd) {
    return null;
  }

  const location = meeting.buildingName ?? meeting.room;
  const timeRange = `${meeting.meetingDays} ${meetingTimeStart}-${meetingTimeEnd}`;

  return location ? `${timeRange} @ ${location}` : timeRange;
}

function buildMeetingLines(
  course: ScheduleBuilderCourseDetailResponse,
  schedulePackage: SchedulePackage,
): MeetingLine[] | null {
  const bundleSections = parseBundleSections(schedulePackage.sectionBundleLabel);

  if (bundleSections.length === 0) {
    return null;
  }

  const meetingLines: MeetingLine[] = [];

  for (const bundleSection of bundleSections) {
    const section = course.sections.find(
      (candidateSection) =>
        candidateSection.sectionType === bundleSection.sectionType &&
        candidateSection.sectionNumber === bundleSection.sectionNumber,
    );

    if (!section || section.sectionClassNumber === null) {
      return null;
    }

    const meeting = course.meetings
      .filter(
        (candidateMeeting) =>
          candidateMeeting.sourcePackageId === schedulePackage.sourcePackageId &&
          candidateMeeting.sectionClassNumber === section.sectionClassNumber,
      )
      .sort((left, right) => (left.meetingIndex ?? Number.MAX_SAFE_INTEGER) - (right.meetingIndex ?? Number.MAX_SAFE_INTEGER))
      .find((candidateMeeting) => formatMeetingDetail(candidateMeeting) !== null);

    if (!meeting) {
      return null;
    }

    const detail = formatMeetingDetail(meeting);

    if (!detail) {
      return null;
    }

    meetingLines.push({
      label: bundleSection.sectionType,
      detail,
    });
  }

  return meetingLines;
}

export function SectionOptionPanel({
  course,
  lockedSectionId,
  excludedSectionIds,
  loading,
  errorMessage,
  onLockSection,
  onExcludeSection,
}: SectionOptionPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const packageCount = course.schedule_packages.length;

  return (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-surface p-5 shadow-soft">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">
            {course.course.designation}
          </h2>
          <p className="text-sm leading-7 text-text-weak">{course.course.title}</p>
          {!isOpen && !loading && packageCount > 0 ? (
            <p className="text-sm text-text-faint">{packageCount} section{packageCount === 1 ? "" : "s"} available</p>
          ) : null}
        </div>
        <span
          aria-hidden="true"
          className={`mt-1 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {isOpen && loading ? (
        <div className="rounded-3xl border border-border bg-muted p-4 text-sm leading-7 text-text-weak">
          Loading section options...
        </div>
      ) : null}

      {isOpen && errorMessage ? (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/8 p-4 text-sm leading-7 text-red-900 dark:text-red-100">
          {errorMessage}
        </div>
      ) : null}

      {isOpen && !loading && !errorMessage && course.schedule_packages.length === 0 ? (
        <div className="rounded-3xl border border-border bg-muted p-4 text-sm leading-7 text-text-weak">
          No section combinations are available for this course right now.
        </div>
      ) : null}

      {isOpen && !loading && !errorMessage && course.schedule_packages.length > 0 ? (
        <div className="flex flex-col gap-3">
          {course.schedule_packages.map((schedulePackage) => {
            const excluded = isExcluded(excludedSectionIds, schedulePackage.sourcePackageId);
            const locked = lockedSectionId === schedulePackage.sourcePackageId;
            const meetingLines = buildMeetingLines(course, schedulePackage);

            return (
              <article
                key={schedulePackage.sourcePackageId}
                className="rounded-3xl border border-border bg-muted p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{schedulePackage.sectionBundleLabel}</h3>
                      {locked ? (
                        <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-900 dark:text-emerald-100">
                          Locked section
                        </span>
                      ) : null}
                      {excluded ? (
                        <span className="rounded-full bg-red-500/12 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-red-900 dark:text-red-100">
                          Excluded section
                        </span>
                      ) : null}
                    </div>
                    {meetingLines ? (
                      <div className="flex flex-col gap-1 text-sm leading-7 text-text-weak">
                        {meetingLines.map((meetingLine, index) => (
                          <div
                            key={`${schedulePackage.sourcePackageId}-${meetingLine.label}-${meetingLine.detail}-${index}`}
                            className="flex flex-wrap gap-2"
                          >
                            <span className="font-medium text-navy">{meetingLine.label}</span>
                            <span>{meetingLine.detail}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm leading-7 text-text-weak">
                        {schedulePackage.meetingSummaryLocal ?? "Meeting summary unavailable."}
                      </p>
                    )}
                    <p className="text-sm text-text-faint">
                      {seatsLabel(schedulePackage)}
                      {schedulePackage.campusDayCount !== null ? `, ${schedulePackage.campusDayCount} campus days` : ""}
                    </p>
                    {schedulePackage.restrictionNote ? (
                      <details className="rounded-2xl border border-border bg-surface px-4 py-3">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-text-weak marker:content-none">
                          <span>More details</span>
                          <span aria-hidden="true">+</span>
                        </summary>
                        <p className="mt-3 text-sm leading-7 text-text-faint">
                          {schedulePackage.restrictionNote}
                        </p>
                      </details>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onLockSection(locked ? null : schedulePackage.sourcePackageId)}
                      className="min-h-11 rounded-full border border-border px-4 text-sm font-medium transition hover:border-blue/20 hover:bg-blue/[0.03]"
                    >
                      {locked ? "Unlock section" : "Lock section"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onExcludeSection(schedulePackage.sourcePackageId, !excluded)}
                      className="min-h-11 rounded-full border border-border px-4 text-sm font-medium transition hover:border-blue/20 hover:bg-blue/[0.03]"
                    >
                      {excluded ? "Include section" : "Exclude section"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
