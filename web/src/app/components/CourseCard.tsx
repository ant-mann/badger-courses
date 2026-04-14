import Link from "next/link";

import type { CourseListItem } from "@/lib/course-data";

type CourseCardProps = {
  course: CourseListItem;
};

function formatCredits(minimumCredits: number | null, maximumCredits: number | null): string {
  if (minimumCredits === null || maximumCredits === null) {
    return "Credits unavailable";
  }

  return minimumCredits === maximumCredits
    ? `${minimumCredits} credits`
    : `${minimumCredits}-${maximumCredits} credits`;
}

function seatLabel(hasAnyOpenSeats: boolean | null, hasAnyFullSection: boolean | null): string {
  if (hasAnyOpenSeats) {
    return "Open seats available";
  }

  if (hasAnyFullSection) {
    return "Some sections are full";
  }

  return "Seat status unavailable";
}

export function CourseCard({ course }: CourseCardProps) {
  return (
    <Link
      href={`/courses/${encodeURIComponent(course.designation)}`}
      className="group rounded-3xl border border-black/10 bg-white/70 p-5 shadow-sm transition hover:border-black/20 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.05]"
    >
      <article className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-[-0.02em] group-hover:underline">
              {course.designation}
            </h2>
            <p className="text-sm leading-6 text-black/68 dark:text-white/68">{course.title}</p>
          </div>
          <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-black/55 dark:border-white/10 dark:text-white/55">
            {course.sectionCount} sections
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-sm text-black/62 dark:text-white/62">
          <span className="rounded-full bg-black/[0.04] px-3 py-1 dark:bg-white/[0.06]">
            {formatCredits(course.minimumCredits, course.maximumCredits)}
          </span>
          <span className="rounded-full bg-black/[0.04] px-3 py-1 dark:bg-white/[0.06]">
            {seatLabel(course.hasAnyOpenSeats, course.hasAnyFullSection)}
          </span>
          {course.crossListDesignations.length > 1 ? (
            <span className="rounded-full bg-black/[0.04] px-3 py-1 dark:bg-white/[0.06]">
              Cross-listed with {course.crossListDesignations.filter((item) => item !== course.designation).join(", ")}
            </span>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
