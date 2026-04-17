import React from "react";
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { CourseCard } from "@/app/components/CourseCard";
import { SearchBar } from "@/app/components/SearchBar";
import { searchCourses, type CourseListItem } from "@/lib/course-data";

type CoursesPageProps = {
  searchParams?: Promise<{
    q?: string | string[];
    subject?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export async function generateMetadata({ searchParams }: CoursesPageProps): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const query = firstParam(resolvedSearchParams?.q).trim();
  if (query) {
    return { title: `${query} – Badger Courses` };
  }
  return { title: "Course Explorer – Badger Courses" };
}

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = firstParam(resolvedSearchParams?.q).trim();
  const subject = firstParam(resolvedSearchParams?.subject).trim();
  const hasSearch = query.length > 0 || subject.length > 0;

  let courses: CourseListItem[] = [];
  let errorMessage: string | null = null;

  try {
    courses = hasSearch ? searchCourses({ query, subject }) : [];
  } catch {
    errorMessage = "Unable to load courses right now. Please try again.";
  }

  return (
    <main className="flex-1 bg-bg text-navy">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
        <section className="flex flex-col gap-4">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-text-faint">
            Badger Courses
          </p>
          <div className="flex flex-col gap-3">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Every Fall 2026 course, with sections and prerequisites.
            </h1>
          </div>
          <div>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-full bg-blue px-5 text-sm font-medium text-white transition hover:bg-blue/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue focus-visible:outline-offset-2"
            >
              Build your schedule
            </Link>
          </div>
        </section>

        <Suspense>
          <SearchBar initialQuery={query} />
        </Suspense>

        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {hasSearch && !errorMessage && courses.length > 0 ? `${courses.length} course${courses.length === 1 ? "" : "s"} found` : ""}
          {hasSearch && !errorMessage && courses.length === 0 ? "No courses found" : ""}
        </div>

        {!hasSearch ? (
          <section className="rounded-xl border border-border bg-muted p-6 text-sm leading-7 text-text-weak">
            Enter a search to see matching courses.
          </section>
        ) : null}

        {errorMessage ? (
          <section className="rounded-xl border border-red-500/20 bg-red-500/8 p-6 text-sm leading-7 text-red-900 dark:text-red-100">
            {errorMessage}
          </section>
        ) : null}

        {hasSearch && !errorMessage && courses.length === 0 ? (
          <section className="rounded-xl border border-border bg-muted p-6 text-sm leading-7 text-text-weak">
            No courses matched <span className="font-medium">{query || subject}</span>.
          </section>
        ) : null}

        {courses.length > 0 ? (
          <section className="grid gap-4">
            {courses.map((course) => (
              <CourseCard key={course.designation} course={course} />
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
