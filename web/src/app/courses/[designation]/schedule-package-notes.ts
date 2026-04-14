import type { SchedulePackage } from "@/lib/course-data";

export type AnnotatedSchedulePackage = SchedulePackage & {
  packageNote: string | null;
};

function splitNoteFragments(restrictionNote: string | null): string[] {
  if (!restrictionNote) {
    return [];
  }

  return restrictionNote
    .split("|")
    .map((fragment) => fragment.trim())
    .filter(Boolean);
}

export function splitSchedulePackageNotes(schedulePackages: SchedulePackage[]): {
  sharedNotes: string[];
  packages: AnnotatedSchedulePackage[];
} {
  const noteCounts = new Map<string, number>();

  for (const schedulePackage of schedulePackages) {
    for (const note of splitNoteFragments(schedulePackage.restrictionNote)) {
      noteCounts.set(note, (noteCounts.get(note) ?? 0) + 1);
    }
  }

  return {
    sharedNotes: [...noteCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([note]) => note),
    packages: schedulePackages.map((schedulePackage) => ({
      ...schedulePackage,
      packageNote: (() => {
        const uniqueNotes = splitNoteFragments(schedulePackage.restrictionNote).filter(
          (note) => noteCounts.get(note) === 1,
        );

        return uniqueNotes.length > 0 ? uniqueNotes.join(" | ") : null;
      })(),
    })),
  };
}
