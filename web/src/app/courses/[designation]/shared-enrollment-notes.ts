export type CollapsibleEnrollmentSection = {
  title: "Instructor description" | "Notes" | "Textbooks";
  notes: string[];
};

const TEXTBOOK_PATTERNS = [
  /\btextbook\b/i,
  /\btexts?\b/i,
  /\bbooks?\b/i,
  /\bo'reilly\b/i,
  /\blibrary\b/i,
  /\bedition\b/i,
  /\bhardcopy\b/i,
];

const INSTRUCTOR_DESCRIPTION_PATTERNS = [
  /physical attendance/i,
  /team project/i,
  /typical weekly schedule/i,
  /\bkeywords\b/i,
  /\bformat\b/i,
  /software engineering/i,
  /agile/i,
  /scrum/i,
  /pair programming/i,
  /practical exam/i,
  /mid-?term/i,
  /final exam/i,
];

const ADMIN_METADATA_PATTERNS = [
  /\bcareers?\b/i,
  /\bcontact us\b/i,
  /\bphone\b/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
];

function isLongFormNote(note: string): boolean {
  return note.length >= 160 || /\n/.test(note);
}

function matchesAnyPattern(note: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(note));
}

function normalizeEnrollmentNote(note: string): string {
  if (/^All careers,\s*except Grads$/i.test(note.trim())) {
    return "Open to all student careers except graduate students.";
  }

  return note;
}

export function organizeSharedEnrollmentNotes(notes: string[]): {
  visibleNotes: string[];
  collapsibleSections: CollapsibleEnrollmentSection[];
} {
  const sectionNotes = new Map<CollapsibleEnrollmentSection["title"], string[]>();
  const visibleNotes: string[] = [];

  for (const rawNote of notes) {
    const note = normalizeEnrollmentNote(rawNote);

    if (matchesAnyPattern(note, TEXTBOOK_PATTERNS)) {
      sectionNotes.set("Textbooks", [...(sectionNotes.get("Textbooks") ?? []), note]);
      continue;
    }

    if (matchesAnyPattern(note, ADMIN_METADATA_PATTERNS)) {
      sectionNotes.set("Notes", [...(sectionNotes.get("Notes") ?? []), note]);
      continue;
    }

    if (isLongFormNote(note) && matchesAnyPattern(note, INSTRUCTOR_DESCRIPTION_PATTERNS)) {
      sectionNotes.set("Instructor description", [...(sectionNotes.get("Instructor description") ?? []), note]);
      continue;
    }

    if (isLongFormNote(note)) {
      sectionNotes.set("Notes", [...(sectionNotes.get("Notes") ?? []), note]);
      continue;
    }

    visibleNotes.push(note);
  }

  const collapsibleSections: CollapsibleEnrollmentSection[] = [];

  for (const title of ["Instructor description", "Notes", "Textbooks"] as const) {
    const sectionItems = sectionNotes.get(title);
    if (sectionItems && sectionItems.length > 0) {
      collapsibleSections.push({
        title,
        notes: sectionItems,
      });
    }
  }

  return {
    visibleNotes,
    collapsibleSections,
  };
}
