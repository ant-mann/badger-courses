import type { CourseSection } from "@/lib/course-data";

type SectionTableProps = {
  sections: CourseSection[];
};

function seatState(section: CourseSection): string {
  if (section.hasOpenSeats) {
    return "Open";
  }

  if (section.hasWaitlist) {
    return "Waitlist";
  }

  if (section.isFull) {
    return "Full";
  }

  return "Unknown";
}

export function SectionTable({ sections }: SectionTableProps) {
  if (sections.length === 0) {
    return (
      <div className="rounded-3xl border border-black/10 bg-black/[0.02] p-5 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65">
        No sections found for this course.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-black/10 dark:border-white/10">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-black/10 text-sm dark:divide-white/10">
          <thead className="bg-black/[0.03] text-left dark:bg-white/[0.04]">
            <tr>
              <th className="px-4 py-3 font-medium">Section</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">Seats</th>
              <th className="px-4 py-3 font-medium">Waitlist</th>
              <th className="px-4 py-3 font-medium">Enrollment</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/8 dark:divide-white/8">
            {sections.map((section) => (
              <tr key={`${section.sectionType}-${section.sectionNumber}-${section.sectionClassNumber ?? "na"}`}>
                <td className="px-4 py-3 align-top font-medium">
                  {section.sectionType} {section.sectionNumber}
                </td>
                <td className="px-4 py-3 align-top text-black/68 dark:text-white/68">
                  {section.instructionMode ?? "Unknown"}
                </td>
                <td className="px-4 py-3 align-top">{section.openSeats ?? "-"}</td>
                <td className="px-4 py-3 align-top">{section.waitlistCurrentSize ?? "-"}</td>
                <td className="px-4 py-3 align-top">
                  {section.currentlyEnrolled ?? "-"}
                  {section.capacity !== null ? ` / ${section.capacity}` : ""}
                </td>
                <td className="px-4 py-3 align-top">{seatState(section)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
