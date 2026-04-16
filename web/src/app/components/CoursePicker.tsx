import React from "react";

import type { CourseListItem } from "@/lib/course-data";

type CoursePickerProps = {
  query: string;
  results: CourseListItem[];
  selectedCourseDesignations: string[];
  loading: boolean;
  errorMessage: string | null;
  maxCoursesReached: boolean;
  onQueryChange: (value: string) => void;
  onAddCourse: (designation: string) => void;
};

export function CoursePicker({
  query,
  results,
  selectedCourseDesignations,
  loading,
  errorMessage,
  maxCoursesReached,
  onQueryChange,
  onAddCourse,
}: CoursePickerProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">
          Add Courses
        </h2>
        <p className="text-sm leading-7 text-text-weak">
          Search by designation, title, or subject prefix, then add courses to the builder.
        </p>
      </div>

      <label className="flex flex-col gap-3 text-sm font-medium text-text-weak" htmlFor="schedule-builder-course-picker">
        Course search
        <input
          id="schedule-builder-course-picker"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="COMP SCI 577"
          className="min-h-12 rounded-2xl border border-border bg-transparent px-4 text-base font-normal outline-none transition focus:border-blue"
        />
      </label>

      {maxCoursesReached ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-7 text-amber-950 dark:text-amber-100">
          You have reached the 8-course limit. Remove a course to add another one.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 p-4 text-sm leading-7 text-red-900 dark:text-red-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex items-center justify-between text-sm text-text-faint">
        <span>{loading ? "Searching courses..." : `${results.length} course option${results.length === 1 ? "" : "s"}`}</span>
        <span>{selectedCourseDesignations.length} selected</span>
      </div>

      {!loading && results.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted p-4 text-sm leading-7 text-text-weak">
          {query.trim().length === 0
            ? "Search to see matching courses."
            : "No matching courses found for this search."}
        </div>
      ) : results.length > 0 ? (
        <div className="flex flex-col gap-3">
          {results.map((course) => {
            const isSelected = selectedCourseDesignations.includes(course.designation);

            return (
              <article
                key={course.designation}
                className="flex flex-col gap-3 rounded-xl border border-border bg-muted p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold">{course.designation}</h3>
                  <p className="text-sm leading-7 text-text-weak">{course.title}</p>
                </div>
                <button
                  type="button"
                  disabled={isSelected || maxCoursesReached}
                  onClick={() => onAddCourse(course.designation)}
                  className="min-h-11 rounded-full border border-border px-4 text-sm font-medium transition hover:border-blue/20 hover:bg-blue/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSelected ? "Added" : "Add course"}
                </button>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
