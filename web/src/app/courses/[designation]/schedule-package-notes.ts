import type { SchedulePackage } from "@/lib/course-data";

export type AnnotatedSchedulePackage = SchedulePackage & {
  packageNote: string | null;
};

type SplitSchedulePackageNotesOptions = {
  promotedNotes?: string[];
};

const GLOBAL_NOTE_PATTERNS = [
  /\bcareers?\b/i,
  /\blaptop\b/i,
  /\bcomputer\b/i,
  /\bphone\b/i,
  /https?:\/\//i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
];

function splitNoteFragments(restrictionNote: string | null): string[] {
  if (!restrictionNote) {
    return [];
  }

  return restrictionNote
    .split(" | ")
    .map((fragment) => fragment.trim())
    .filter(Boolean);
}

function isLongFormNote(note: string): boolean {
  return note.length >= 160 || /\n/.test(note);
}

function shouldPromoteNote(note: string, promotedNotes: Set<string>): boolean {
  return promotedNotes.has(note) || isLongFormNote(note) || GLOBAL_NOTE_PATTERNS.some((pattern) => pattern.test(note));
}

export function splitSchedulePackageNotes(
  schedulePackages: SchedulePackage[],
  options: SplitSchedulePackageNotesOptions = {},
): {
  sharedNotes: string[];
  packages: AnnotatedSchedulePackage[];
} {
  const noteCounts = new Map<string, number>();
  const promotedNotes = new Set((options.promotedNotes ?? []).map((note) => note.trim()).filter(Boolean));
  const sharedNotes: string[] = [];
  const sharedNoteSet = new Set<string>();

  for (const schedulePackage of schedulePackages) {
    for (const note of splitNoteFragments(schedulePackage.restrictionNote)) {
      noteCounts.set(note, (noteCounts.get(note) ?? 0) + 1);

      if ((noteCounts.get(note) ?? 0) > 1 || shouldPromoteNote(note, promotedNotes)) {
        if (!sharedNoteSet.has(note)) {
          sharedNoteSet.add(note);
          sharedNotes.push(note);
        }
      }
    }
  }

  return {
    sharedNotes,
    packages: schedulePackages.map((schedulePackage) => ({
      ...schedulePackage,
      packageNote: (() => {
        const uniqueNotes = splitNoteFragments(schedulePackage.restrictionNote).filter(
          (note) => !sharedNoteSet.has(note),
        );

        return uniqueNotes.length > 0 ? uniqueNotes.join(" | ") : null;
      })(),
    })),
  };
}
