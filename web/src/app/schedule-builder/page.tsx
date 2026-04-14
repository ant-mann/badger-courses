import React, { Suspense } from "react";
import { ScheduleBuilder } from "./ScheduleBuilder";

export default function ScheduleBuilderPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
        <section className="flex flex-col gap-4">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-black/55 dark:text-white/55">
            Schedule Builder
          </p>
          <div className="flex flex-col gap-3">
            <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Build Fall 2026 schedules in the browser.
            </h1>
            <p className="max-w-3xl text-base leading-7 text-black/65 dark:text-white/65">
              Add courses, lock or exclude section combinations, and compare ranked schedules with a weekly calendar.
            </p>
          </div>
        </section>

        <Suspense>
          <ScheduleBuilder />
        </Suspense>
      </div>
    </main>
  );
}
