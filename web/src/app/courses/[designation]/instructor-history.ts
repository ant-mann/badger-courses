import type { InstructorHistoryItem } from "@/lib/course-data";

export function getInstructorHistoryRowsForDisplay(
  instructorHistory: InstructorHistoryItem[],
): InstructorHistoryItem[] {
  const lectureRows = instructorHistory.filter((item) => item.sectionType === "LEC");
  const rowsToDisplay = lectureRows.length > 0 ? lectureRows : instructorHistory;
  const seenRows = new Set<string>();

  return rowsToDisplay.filter((item) => {
    const rowKey = [
      item.sectionType,
      item.sectionNumber,
      item.instructorDisplayName ?? "unknown",
    ].join("|");

    if (seenRows.has(rowKey)) {
      return false;
    }

    seenRows.add(rowKey);
    return true;
  });
}
