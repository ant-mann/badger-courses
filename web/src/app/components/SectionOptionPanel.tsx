import React from "react";

import type { SchedulePackage } from "@/lib/course-data";

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

export function SectionOptionPanel({
  course,
  lockedSectionId,
  excludedSectionIds,
  loading,
  errorMessage,
  onLockSection,
  onExcludeSection,
}: SectionOptionPanelProps) {
  return (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-black/10 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-black/55 dark:text-white/55">
          {course.course.designation}
        </p>
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">Section options</h2>
        <p className="text-sm leading-7 text-black/68 dark:text-white/68">{course.course.title}</p>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-4 text-sm leading-7 text-black/65 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">
          Loading section options...
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/8 p-4 text-sm leading-7 text-red-900 dark:text-red-100">
          {errorMessage}
        </div>
      ) : null}

      {!loading && !errorMessage && course.schedule_packages.length === 0 ? (
        <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-4 text-sm leading-7 text-black/65 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">
          No section combinations are available for this course right now.
        </div>
      ) : null}

      {!loading && !errorMessage && course.schedule_packages.length > 0 ? (
        <div className="flex flex-col gap-3">
          {course.schedule_packages.map((schedulePackage) => {
            const excluded = isExcluded(excludedSectionIds, schedulePackage.sourcePackageId);
            const locked = lockedSectionId === schedulePackage.sourcePackageId;

            return (
              <article
                key={schedulePackage.sourcePackageId}
                className="rounded-3xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.04]"
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
                    <p className="text-sm leading-7 text-black/68 dark:text-white/68">
                      {schedulePackage.meetingSummaryLocal ?? "Meeting summary unavailable."}
                    </p>
                    <p className="text-sm text-black/60 dark:text-white/60">
                      {seatsLabel(schedulePackage)}
                      {schedulePackage.campusDayCount !== null ? `, ${schedulePackage.campusDayCount} campus days` : ""}
                    </p>
                    {schedulePackage.restrictionNote ? (
                      <p className="text-sm leading-7 text-black/60 dark:text-white/60">
                        {schedulePackage.restrictionNote}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onLockSection(locked ? null : schedulePackage.sourcePackageId)}
                      className="min-h-11 rounded-full border border-black/10 px-4 text-sm font-medium transition hover:border-black/20 hover:bg-black/[0.03] dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
                    >
                      {locked ? "Unlock section" : "Lock section"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onExcludeSection(schedulePackage.sourcePackageId, !excluded)}
                      className="min-h-11 rounded-full border border-black/10 px-4 text-sm font-medium transition hover:border-black/20 hover:bg-black/[0.03] dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
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
