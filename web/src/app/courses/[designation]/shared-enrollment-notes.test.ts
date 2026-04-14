import test from "node:test";
import assert from "node:assert/strict";

import { organizeSharedEnrollmentNotes } from "./shared-enrollment-notes";

test("organizeSharedEnrollmentNotes keeps short enrollment restrictions visible and collapses long-form metadata", () => {
  const result = organizeSharedEnrollmentNotes([
    "Open only to Computer Sciences students.",
    `PHYSICAL ATTENDANCE in class accounts for approximately 20% of the CS506 grade.

Students are required to commit to working closely with their teams.

Typical weekly schedule might be:
0: Introduction to SWE concepts and the SDLC
1: Agile/Scrum`,
    "NOTE that the Meyer and Martin books are both freely available on-line to UW students and staff through the UW Library's sitewide license for the O'Reilly Technical Library. Buy a hardcopy volume of Ousterhout's A Philosophy of Software Design.",
  ]);

  assert.deepEqual(result.visibleNotes, ["Open only to Computer Sciences students."]);
  assert.deepEqual(result.collapsibleSections, [
    {
      title: "Instructor description",
      notes: [
        `PHYSICAL ATTENDANCE in class accounts for approximately 20% of the CS506 grade.

Students are required to commit to working closely with their teams.

Typical weekly schedule might be:
0: Introduction to SWE concepts and the SDLC
1: Agile/Scrum`,
      ],
    },
    {
      title: "Textbooks",
      notes: [
        "NOTE that the Meyer and Martin books are both freely available on-line to UW students and staff through the UW Library's sitewide license for the O'Reilly Technical Library. Buy a hardcopy volume of Ousterhout's A Philosophy of Software Design.",
      ],
    },
  ]);
});

test("organizeSharedEnrollmentNotes sends unmatched long notes to a generic collapsed notes section", () => {
  const result = organizeSharedEnrollmentNotes([
    "Declared majors only.",
    `Students should expect substantial weekly reflection writing and a portfolio check at the end of the semester.

Bring examples from prior studio work to the critique sessions.`,
  ]);

  assert.deepEqual(result.visibleNotes, ["Declared majors only."]);
  assert.deepEqual(result.collapsibleSections, [
    {
      title: "Notes",
      notes: [
        `Students should expect substantial weekly reflection writing and a portfolio check at the end of the semester.

Bring examples from prior studio work to the critique sessions.`,
      ],
    },
  ]);
});

test("organizeSharedEnrollmentNotes collapses short admin metadata instead of surfacing it as primary guidance", () => {
  const result = organizeSharedEnrollmentNotes([
    "All careers, except Grads",
    "You may contact us at enrollment@ischool.wisc.edu or by phone at (608) 263-2900.",
  ]);

  assert.deepEqual(result.visibleNotes, []);
  assert.deepEqual(result.collapsibleSections, [
    {
      title: "Notes",
      notes: [
        "Open to all student careers except graduate students.",
        "You may contact us at enrollment@ischool.wisc.edu or by phone at (608) 263-2900.",
      ],
    },
  ]);
});
