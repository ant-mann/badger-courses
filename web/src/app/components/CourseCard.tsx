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
      className="group rounded-3xl border border-border bg-surface p-5 shadow-soft transition hover:shadow-card hover:border-blue/20"
    >
      <article className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-[-0.02em] group-hover:underline">
              {course.designation}
            </h2>
            <p className="text-sm leading-6 text-text-weak">{course.title}</p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-text-faint">
            {course.sectionCount} sections
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-sm text-text-weak">
          <span className="rounded-full bg-muted px-3 py-1">
            {formatCredits(course.minimumCredits, course.maximumCredits)}
          </span>
          <span className="rounded-full bg-muted px-3 py-1">
            {seatLabel(course.hasAnyOpenSeats, course.hasAnyFullSection)}
          </span>
          {course.crossListDesignations.length > 1 ? (
            <span className="rounded-full bg-muted px-3 py-1">
              Cross-listed with {course.crossListDesignations.filter((item) => item !== course.designation).join(", ")}
            </span>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
