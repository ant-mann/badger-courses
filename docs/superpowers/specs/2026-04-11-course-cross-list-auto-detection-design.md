# Course Cross-List Auto-Detection Design

## Goal

Automatically detect cross-listed courses from the raw source data, preserve one canonical course row per `(term_code, course_id)`, and expose all cross-listed designations as explicit aliases for query and AI use.

## Current State

The DB already uses `(term_code, course_id)` as the canonical course identity in `courses`.

That means the build naturally collapses multiple source designations that share the same `courseId` into one stored course row.

This is already enough to avoid duplicate course rows, but it has two important gaps:

- cross-listed aliases are not preserved explicitly
- alias lookups like `COMP SCI 240` do not have a first-class DB surface that resolves back to the canonical course row with the full alias set

The raw source confirms that shared `courseId` is the real cross-list signal in this dataset.

Examples from `fall-2026-courses.json`:

- `courseId = 011630` maps to `COMP SCI 240` and `MATH 240`
- many other `courseId` values map to multiple designations across subjects

## Target User Experience

If a user or query asks for `COMP SCI 240`, the system should resolve that designation to the canonical `(term_code, course_id)` course row and also expose the full cross-list group, including `MATH 240`.

The same should work in reverse for any alias in the group.

Consumers should be able to:

- look up a course by any cross-listed designation
- see the canonical course row once
- inspect all aliases for that course id

## Design Principles

1. Use only shared `courseId` as the cross-list auto-detection rule.
2. Keep `(term_code, course_id)` as the canonical course identity.
3. Preserve every observed source designation for that canonical course id.
4. Do not infer cross-lists from fuzzy signals like title similarity or catalog number similarity.
5. Make alias lookup cheap and explicit in SQL.

## Proposed Architecture

### 1. Keep `courses` canonical

The `courses` table should remain one row per `(term_code, course_id)`.

That row is the canonical stored course record.

No duplicate `courses` rows should be introduced for cross-listed aliases.

### 2. Add explicit cross-list alias storage

Add a new table to materialize every designation observed for a canonical course id.

Recommended table:

- `course_cross_listings`

Recommended columns:

- `term_code`
- `course_id`
- `course_designation`
- `full_course_designation`
- `subject_code`
- `catalog_number`
- `is_primary`

Recommended key behavior:

- one row per observed alias designation per canonical `(term_code, course_id)`
- foreign key from `(term_code, course_id)` to `courses`
- unique constraint on `(term_code, course_id, course_designation)`
- unique constraint on `(term_code, course_designation)` so one alias resolves to one canonical course row within a term

### 3. Mark one alias as primary

The canonical `courses.course_designation` should remain the primary display designation.

The matching alias row in `course_cross_listings` should be marked with `is_primary = 1`.

All other aliases for the same `(term_code, course_id)` should have `is_primary = 0`.

This preserves the current canonical row behavior while making aliases explicit.

### 4. Build aliases directly from raw source groups

During `build-course-db`, raw course records should be grouped by `(termCode, courseId)` before insertion.

For each canonical group:

- keep one canonical row in `courses`
- emit one alias row in `course_cross_listings` for each unique source designation in the group

This includes designations that may not survive as the canonical row designation.

### 5. Add alias-aware query views

Add a view that resolves any alias designation back to the canonical course row.

Recommended view:

- `course_cross_listing_overview_v`

Recommended view columns:

- `term_code`
- `course_id`
- `canonical_course_designation`
- `alias_course_designation`
- `full_course_designation`
- `subject_code`
- `catalog_number`
- `title`
- `is_primary`

This view should support lookups like:

```sql
SELECT *
FROM course_cross_listing_overview_v
WHERE alias_course_designation = 'COMP SCI 240';
```

That query should return the canonical course row context for the shared `courseId`, including that `MATH 240` is in the same alias group.

### 6. Expose alias aggregation for canonical course queries

`course_overview_v` should remain canonical-row oriented, but it should gain a cross-list summary column so consumers do not need a second query for common cases.

Recommended additional columns:

- `cross_list_designations_json`
- `cross_list_count`

This lets a canonical course query surface its alias set directly.

## Data Flow

1. `build-course-db.mjs` reads raw course source rows
2. source rows are grouped by `(termCode, courseId)`
3. one canonical `courses` row is written per group
4. every observed designation in the group is written to `course_cross_listings`
5. views expose:
   - canonical course queries with alias aggregation
   - alias-to-canonical lookups

## Canonical Row Selection

This design does not change how the canonical course row is chosen today, except that the chosen designation must also be marked as `is_primary` in the cross-list table.

The implementation should follow the current build behavior unless a current ambiguity is discovered during implementation.

That keeps this change focused on preserving and exposing aliases, not redefining course canonicalization.

## Query Contract

### Canonical course query

```sql
SELECT course_designation, title, cross_list_designations_json
FROM course_overview_v
WHERE course_designation = 'MATH 240';
```

Expected shape:

- canonical course row for `course_id = 011630`
- alias list includes both `COMP SCI 240` and `MATH 240`

### Alias lookup query

```sql
SELECT canonical_course_designation, alias_course_designation, course_id
FROM course_cross_listing_overview_v
WHERE alias_course_designation = 'COMP SCI 240';
```

Expected shape:

- one row resolving `COMP SCI 240` back to canonical `course_id = 011630`
- canonical row context is available without duplicating the course record in `courses`

## Error Handling and Conservative Rules

- Only same-`courseId` records are treated as cross-listed.
- If a course has only one designation for a term, it still gets either:
  - one primary alias row, or
  - no cross-list row if implementation chooses to store only multi-designation groups.

The recommended behavior is to store all designations, including singleton primary rows, because it simplifies alias lookup logic and keeps the model uniform.

- No fuzzy fallback inference should be added.

## Testing Strategy

### Build/integration tests

Extend `tests/db-import.test.mjs` to assert:

- `COMP SCI 240` and `MATH 240` share one canonical `(term_code, course_id)`
- both designations are materialized in `course_cross_listings`
- alias lookup by either designation resolves to the canonical course row
- `course_overview_v` exposes the aggregated alias list

### Helper tests

If alias-row helpers are introduced in `import-helpers.mjs`, add focused tests for:

- grouping unique designations by `(termCode, courseId)`
- primary alias marking
- duplicate alias deduplication inside one course group

### Regression tests

Add at least one non-cross-listed course case to verify:

- canonical row behavior is unchanged
- alias metadata does not create duplicate course rows

## Scope Boundaries

This design intentionally does not include:

- fuzzy cross-list inference from title or number similarity
- historical cross-list tracking across different terms with different `courseId` values
- prerequisite graph rewriting based on alias equivalence
- schedule/package deduplication changes beyond the existing canonical `(term_code, course_id)` model

## Open Decisions Resolved

- Cross-list auto-detection should use shared `courseId` only.
- The DB should keep one canonical course row and also expose explicit cross-list aliases.
- Alias lookups should resolve to the canonical course row rather than returning duplicated course rows.
