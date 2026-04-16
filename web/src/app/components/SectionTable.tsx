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
      <div className="rounded-3xl border border-border bg-muted p-5 text-sm text-text-weak">
        No sections found for this course.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Section</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">Seats</th>
              <th className="px-4 py-3 font-medium">Waitlist</th>
              <th className="px-4 py-3 font-medium">Enrollment</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sections.map((section) => (
              <tr key={`${section.sectionType}-${section.sectionNumber}-${section.sectionClassNumber ?? "na"}`}>
                <td className="px-4 py-3 align-top font-medium">
                  <div className="flex flex-col gap-1">
                    <span>
                      {section.sectionType} {section.sectionNumber}
                    </span>
                    {section.sectionTitle ? (
                      <span className="font-normal text-text-weak">{section.sectionTitle}</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-text-weak">
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
