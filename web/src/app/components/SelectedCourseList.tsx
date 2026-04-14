import React from "react";

type SelectedCourseListItem = {
  designation: string;
  title?: string | null;
  loading: boolean;
  errorMessage: string | null;
};

type SelectedCourseListProps = {
  courses: SelectedCourseListItem[];
  onRemoveCourse: (designation: string) => void;
};

export function SelectedCourseList({ courses, onRemoveCourse }: SelectedCourseListProps) {
  return (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-black/10 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-black/55 dark:text-white/55">
          Selected Courses
        </p>
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">Current builder inputs</h2>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-4 text-sm leading-7 text-black/65 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">
          No courses selected yet. Add a course to start building schedules.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {courses.map((course) => (
            <article
              key={course.designation}
              className="rounded-3xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold">{course.designation}</h3>
                  {course.title ? (
                    <p className="text-sm leading-7 text-black/68 dark:text-white/68">{course.title}</p>
                  ) : null}
                  {course.loading ? (
                    <p className="text-sm text-black/60 dark:text-white/60">Loading section options...</p>
                  ) : null}
                  {course.errorMessage ? (
                    <p className="text-sm leading-7 text-red-900 dark:text-red-100">{course.errorMessage}</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveCourse(course.designation)}
                  className="min-h-11 rounded-full border border-black/10 px-4 text-sm font-medium transition hover:border-black/20 hover:bg-black/[0.03] dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
