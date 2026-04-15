# Schedule Builder Section Option Density Design

## Goal

Make the schedule-builder section-option list easier to scan by removing repeated long-form note clutter from every row and by making `LEC`, `LAB`, and `DIS` meetings visually distinct.

## Current State

- The schedule builder renders section options in `web/src/app/components/SectionOptionPanel.tsx`.
- Each section-option row currently shows:
  - the section-combination label
  - one merged meeting-summary paragraph
  - seat and campus-day metadata
  - the full `restrictionNote` text when present
  - lock and exclude actions
- For courses like `CHEM 104`, the `restrictionNote` is long and repeated across many rows.
- That repeated note currently dominates the panel vertically and makes it harder to compare actual schedule differences between rows.
- The merged meeting summary also makes it harder to quickly tell which time belongs to lecture, lab, or discussion.

## Target User Experience

When a user adds a course with many section combinations:

1. They can scan the list primarily by section bundle, meeting structure, and seat availability.
2. They can immediately tell which meeting belongs to `LEC`, `LAB`, or `DIS`.
3. They do not have to read the same long department note under every row.
4. They can still access long-form note content on demand when needed.
5. The existing lock and exclude actions remain easy to reach.

## Chosen Design

The section-option rows should become compact by default.

Each row should show:

- the existing section-combination heading
- a structured meeting block with one line per meeting type
- seat and campus-day metadata
- lock and exclude actions
- a collapsed `More details` disclosure when a long-form note exists

The meeting block should use a two-column layout:

- left column: meeting type label such as `LEC`, `LAB`, or `DIS`
- right column: the corresponding time and building summary

This preserves the compact feel of the row while making the meeting breakdown much easier to scan.

## Row Layout

### Primary Content

The visible summary for each section-option row should prioritize comparison content over explanatory text.

Recommended order inside each row:

1. section-combination title
2. optional state badges such as locked or excluded
3. structured meeting block
4. seat and campus-day metadata
5. optional `More details` disclosure
6. action buttons

The row should remain a single card, not split into nested cards or secondary panels.

### Meeting Presentation

The current single-paragraph meeting summary should be replaced by a per-meeting rendering based on the underlying schedule package data.

Requirements:

- show one visual line per meeting when meeting details exist
- keep the meeting type label fixed-width and visually distinct from the content
- keep the detail side focused on time plus building summary
- preserve graceful fallback behavior if structured meeting details are unavailable

If the schedule package does not expose enough structured data to label meetings reliably in one path, the UI may fall back to the current merged summary string for that specific row rather than guessing.

## Long-Form Note Handling

The long repeated `restrictionNote` content should no longer be rendered inline by default.

Instead:

- if no note exists, show nothing extra
- if a note exists, show a compact `More details` disclosure control beneath the row metadata
- expanding the disclosure reveals the full note text for that row

This keeps note access available without forcing the same large text block into every visible row.

The initial implementation should not try to deduplicate or canonicalize notes across rows. It only needs to hide them by default.

## Architecture

The change should stay localized to the existing section-option rendering path.

Preferred implementation shape:

- keep `SectionOptionPanel` as the main rendering component
- add a small local helper for deriving structured meeting lines from a `SchedulePackage`
- keep fallback behavior close to the row rendering logic rather than introducing a parallel abstraction layer

If the current `SchedulePackage` type already includes enough structured section or meeting data, use that directly. If not, derive the display lines from the existing payload with the minimum extra transformation needed for this panel.

## Error Handling And Fallbacks

- If a row has no structured meeting breakdown available, continue to show the current merged meeting summary string.
- If a row has a meeting breakdown but one meeting lacks a building string, still show the meeting type and time.
- If a row has no long-form note, omit the disclosure entirely.
- Locked and excluded badges must continue to render exactly as they do now.

## Testing Strategy

Update the existing component coverage for `web/src/app/schedule-builder/components.test.tsx` so it verifies the new compact rendering behavior.

Required coverage:

- rows no longer render long notes inline by default
- rows render a `More details` affordance when a note exists
- rows omit the disclosure when no note exists
- meeting details render as distinct labeled lines for `LEC`, `LAB`, and `DIS` when structured data exists
- rows still fall back to the merged summary when structured meeting labeling is unavailable
- lock and exclude controls continue to render correctly

## Scope Boundaries

This design does not include:

- changing schedule-generation logic
- removing note data from the API
- deduplicating note text across packages
- redesigning the overall schedule-builder page layout
- changing lock or exclude behavior

## Success Criteria

This design is successful when all of the following are true:

1. `CHEM 104`-style section lists are significantly shorter and easier to scan.
2. Users can tell which meeting is `LEC`, `LAB`, and `DIS` without parsing a merged sentence.
3. Long-form repeated notes remain available, but only after explicit expansion.
4. Existing lock and exclude actions still work without layout regressions.
5. The change stays localized to the section-option UI without introducing unnecessary new abstractions.
