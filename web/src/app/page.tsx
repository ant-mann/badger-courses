import React from "react";
import { Suspense } from "react";
import Link from "next/link";

import { CourseCard } from "@/app/components/CourseCard";
import { SearchBar } from "@/app/components/SearchBar";
import { searchCourses, type CourseListItem } from "@/lib/course-data";

type HomePageProps = {
  searchParams?: Promise<{
    q?: string | string[];
    subject?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const query = firstParam(resolvedSearchParams?.q).trim();
  const subject = firstParam(resolvedSearchParams?.subject).trim();
  const hasSearch = query.length > 0 || subject.length > 0;

  let courses: CourseListItem[] = [];
  let errorMessage: string | null = null;

  try {
    courses = hasSearch ? searchCourses({ query, subject }) : [];
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load courses right now.";
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
        <section className="flex flex-col gap-4">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-black/55 dark:text-white/55">
            UW-Madison Course Explorer
          </p>
          <div className="flex flex-col gap-3">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Search Fall 2026 courses with sections, prerequisites, and schedule packages.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-black/65 dark:text-white/65">
              Start with a designation, title, or subject prefix like <span className="font-medium">COMP SCI 577</span> or <span className="font-medium">MATH</span>.
            </p>
          </div>
          <div>
            <Link
              href="/schedule-builder"
              className="inline-flex min-h-11 items-center rounded-full border border-black/10 bg-black px-5 text-sm font-medium text-white transition hover:bg-black/90 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              Open schedule builder
            </Link>
          </div>
        </section>

        <Suspense>
          <SearchBar initialQuery={query} />
        </Suspense>

        {!hasSearch ? (
          <section className="rounded-3xl border border-black/10 bg-black/[0.02] p-6 text-sm leading-7 text-black/70 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70">
            Enter a search to see matching courses. Results load on the server from the shared course data module.
          </section>
        ) : null}

        {errorMessage ? (
          <section className="rounded-3xl border border-red-500/20 bg-red-500/8 p-6 text-sm leading-7 text-red-900 dark:text-red-100">
            {errorMessage}
          </section>
        ) : null}

        {hasSearch && !errorMessage && courses.length === 0 ? (
          <section className="rounded-3xl border border-black/10 bg-black/[0.02] p-6 text-sm leading-7 text-black/70 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70">
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
