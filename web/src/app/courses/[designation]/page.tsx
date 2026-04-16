import Link from "next/link";
import { notFound } from "next/navigation";

import { PrerequisiteSummary } from "@/app/components/PrerequisiteSummary";
import { SectionTable } from "@/app/components/SectionTable";
import { getCourseDetail } from "@/lib/course-data";
import { getInstructorHistoryRowsForDisplay } from "./instructor-history";
import { splitSchedulePackageNotes } from "./schedule-package-notes";
import { organizeSharedEnrollmentNotes } from "./shared-enrollment-notes";

type CoursePageProps = {
  params: Promise<{
    designation: string;
  }>;
};

function formatCredits(minimumCredits: number | null, maximumCredits: number | null): string {
  if (minimumCredits === null || maximumCredits === null) {
    return "Credits unavailable";
  }

  return minimumCredits === maximumCredits
    ? `${minimumCredits} credits`
    : `${minimumCredits}-${maximumCredits} credits`;
}

function formatGpa(value: number | null): string {
  return value === null ? "-" : value.toFixed(2);
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { designation } = await params;
  const detail = getCourseDetail(designation);

  if (!detail) {
    notFound();
  }

  const schedulePackageNotes = splitSchedulePackageNotes(detail.schedulePackages, {
    promotedNotes: detail.course.enrollmentPrerequisites ? [detail.course.enrollmentPrerequisites] : [],
  });
  const sharedEnrollmentNotes = schedulePackageNotes.sharedNotes.filter(
    (note) => note !== detail.course.enrollmentPrerequisites?.trim(),
  );
  const organizedEnrollmentNotes = organizeSharedEnrollmentNotes(sharedEnrollmentNotes);
  const displayedInstructorGrades = getInstructorHistoryRowsForDisplay(detail.instructorGrades);

  return (
    <main className="flex-1 bg-bg text-navy">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-text-weak transition hover:text-navy"
        >
          <span aria-hidden="true">←</span>
          Course Explorer
        </Link>
        <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-surface p-6 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-text-faint">
                Course Detail
              </p>
              <h1 className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{detail.course.designation}</h1>
              <p className="max-w-3xl text-lg leading-8 text-text-weak">{detail.course.title}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-text-weak">
              <span className="rounded-full bg-muted px-3 py-1">
                {formatCredits(detail.course.minimumCredits, detail.course.maximumCredits)}
              </span>
              <span className="rounded-full bg-muted px-3 py-1">
                {detail.course.sectionCount} sections
              </span>
            </div>
          </div>

          {detail.course.description ? (
            <p className="max-w-4xl text-sm leading-7 text-text-weak">{detail.course.description}</p>
          ) : null}

          {detail.course.crossListDesignations.length > 1 ? (
            <p className="text-sm leading-7 text-text-weak">
              Cross-lists: {detail.course.crossListDesignations.join(", ")}
            </p>
          ) : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold tracking-[-0.02em]">Prerequisites</h2>
            <PrerequisiteSummary
              prerequisite={detail.prerequisite}
              enrollmentPrerequisites={detail.course.enrollmentPrerequisites}
            />

            {sharedEnrollmentNotes.length > 0 ? (
              <div className="flex flex-col gap-4">
                <h2 className="text-2xl font-semibold tracking-[-0.02em]">Enrollment notes</h2>
                {organizedEnrollmentNotes.visibleNotes.length > 0 ? (
                  <div className="rounded-3xl border border-border bg-surface p-5">
                    <div className="flex flex-col gap-3 text-sm leading-7 text-text-weak">
                      {organizedEnrollmentNotes.visibleNotes.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  </div>
                ) : null}

                {organizedEnrollmentNotes.collapsibleSections.map((section) => (
                  <details
                    key={section.title}
                    className="group rounded-3xl border border-border bg-surface px-5 py-4"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-navy marker:content-none">
                      <span>{section.title}</span>
                      <span className="text-xs uppercase tracking-[0.2em] text-text-faint transition group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <div className="mt-4 flex flex-col gap-4 text-sm leading-7 text-text-weak">
                      {section.notes.map((note) => (
                        <div key={note} className="whitespace-pre-line">
                          {note}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold tracking-[-0.02em]">Schedule packages</h2>
            <div className="flex flex-col gap-3">
              {schedulePackageNotes.packages.length === 0 ? (
                <div className="rounded-3xl border border-border bg-muted p-5 text-sm text-text-weak">
                  No schedule packages available.
                </div>
              ) : (
                schedulePackageNotes.packages.map((schedulePackage) => (
                  <article
                    key={schedulePackage.sourcePackageId}
                    className="rounded-3xl border border-border bg-surface p-5"
                  >
                    <div className="flex flex-col gap-2">
                      <h3 className="text-base font-semibold">{schedulePackage.sectionBundleLabel}</h3>
                      {schedulePackage.sectionTitle ? (
                        <p className="text-sm leading-7 text-text-weak">
                          {schedulePackage.sectionTitle}
                        </p>
                      ) : null}
                      <p className="text-sm leading-7 text-text-weak">
                        {schedulePackage.meetingSummaryLocal ?? "Meeting summary unavailable."}
                      </p>
                      <p className="text-sm text-text-faint">
                        {schedulePackage.openSeats ?? "-"} open seats, {schedulePackage.campusDayCount ?? "-"} campus days
                      </p>
                      {schedulePackage.packageNote ? (
                        <p className="text-sm leading-7 text-text-faint">
                          {schedulePackage.packageNote}
                        </p>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">Sections</h2>
          <SectionTable sections={detail.sections} />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">Instructor history</h2>
          {displayedInstructorGrades.length === 0 ? (
            <div className="rounded-3xl border border-border bg-muted p-5 text-sm text-text-weak">
              Historical instructor data is unavailable in the current database snapshot.
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-border">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">Section</th>
                      <th className="px-4 py-3 font-medium">Instructor</th>
                      <th className="px-4 py-3 font-medium">Previous times taught</th>
                      <th className="px-4 py-3 font-medium">Students</th>
                      <th className="px-4 py-3 font-medium">Same-course GPA</th>
                      <th className="px-4 py-3 font-medium">Course GPA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayedInstructorGrades.map((item) => (
                      <tr
                        key={`${item.sectionType}-${item.sectionNumber}-${item.instructorDisplayName ?? "unknown"}`}
                      >
                        <td className="px-4 py-3 align-top font-medium">
                          {item.sectionType} {item.sectionNumber}
                        </td>
                        <td className="px-4 py-3 align-top">{item.instructorDisplayName ?? "Unknown"}</td>
                        <td className="px-4 py-3 align-top">{item.sameCoursePriorOfferingCount ?? "-"}</td>
                        <td className="px-4 py-3 align-top">{item.sameCourseStudentCount ?? "-"}</td>
                        <td className="px-4 py-3 align-top">{formatGpa(item.sameCourseGpa)}</td>
                        <td className="px-4 py-3 align-top">{formatGpa(item.courseHistoricalGpa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
