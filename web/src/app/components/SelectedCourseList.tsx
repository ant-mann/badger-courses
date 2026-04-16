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
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">
          Selected Courses
        </h2>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted p-4 text-sm leading-7 text-text-weak">
          No courses selected yet. Add a course to start building schedules.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {courses.map((course) => (
            <article
              key={course.designation}
              className="rounded-xl border border-border bg-muted p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold">{course.designation}</h3>
                  {course.title ? (
                    <p className="text-sm leading-7 text-text-weak">{course.title}</p>
                  ) : null}
                  {course.loading ? (
                    <p className="text-sm text-text-faint">Loading section options...</p>
                  ) : null}
                  {course.errorMessage ? (
                    <p className="text-sm leading-7 text-red-900 dark:text-red-100">{course.errorMessage}</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveCourse(course.designation)}
                  className="min-h-11 rounded-full border border-border px-4 text-sm font-medium transition hover:border-blue/20 hover:bg-blue/[0.03]"
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
