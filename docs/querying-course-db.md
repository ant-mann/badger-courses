# Querying the Course Database

## Start Here

- Primary database: `data/fall-2026.sqlite`
- For AI schedule generation, use the schedule read model first:
  - `schedule_candidates_v` for section/package selection
  - `scripts/schedule-options.mjs` for candidate-local schedule enumeration, overlap checks, and transition-aware ranking
  - `canonical_meetings` for candidate-local debugging or custom schedule logic
  - Do not derive local meeting times with ad hoc timezone math; use persisted `*_minute_local` fields and `meeting_summary_local`
- Query the analytical views first for general reporting:
  - `course_overview_v`
  - `course_cross_listing_overview_v` for alias-to-canonical cross-list lookups
  - `section_overview_v`
  - `availability_v`
  - `schedule_planning_v`
  - `online_courses_v`
- For prerequisite queries:
  - `prerequisite_rule_overview_v` for rule-level parse inspection
  - `prerequisite_course_summary_overview_v` for AI-friendly prerequisite course groups plus escape clauses
- For AI-facing non-schedule queries, prefer the canonical views above over raw `packages`, `sections`, or `meetings`.
- Use the base tables only when a view does not expose the detail you need.
- Raw `sections.section_class_number` values stay canonical when the source provides a real class number.
- If every copy of a logical section omits the class number and each package contributes at most one row for that course-scoped fallback identity (`termCode` + `courseId` + `sectionNumber` + `type` + `sessionCode`), the importer writes a stable synthetic negative identifier so those missing-number copies still collapse correctly in `section_overview_v` and `course_overview_v`.
- If a package repeats the same missing-number fallback identity more than once, those duplicates are treated as ambiguous and get package-scoped synthetic negative identifiers instead. They stay separate across packages even if duplicate order happens to line up between snapshots.
- If copies mix real and missing class numbers, the importer reuses the real class number only when there is a unique full identity match on course scope plus `sectionNumber`, `type`, and `sessionCode`. Otherwise the missing copy keeps its synthetic negative identifier and remains separate in canonical views.
- Raw `sections`, `meetings`, and `section_instructors` still preserve per-package detail even when the canonical views collapse duplicate copies to one logical section.
- Do not query raw `meetings` directly for schedule questions unless you intentionally want every package copy. For canonical meeting rows, use `schedule_planning_v`, which already follows the selected `source_package_id`.
- `online_courses_v` is course-level over package freshness, not section tie-breaks: it treats a course as online/asynchronous when any package in that course's freshest `package_last_updated` set is flagged `online_only` or `is_asynchronous`.
- If multiple packages share the freshest timestamp, `online_courses_v` checks all of them even when `section_overview_v` breaks tied section sources down to a single package row.
- Older dropped-only package copies can still appear in `section_overview_v` when no newer section row replaces them, but stale packages never keep a course in `online_courses_v`.
- `schedulable_packages` is the materialized package-level source behind `schedule_candidates_v`; it already carries bundle labels, seat state, restriction notes, day counts, start/end minutes, and meeting summaries for AI schedule selection.
- Global `schedule_conflicts` / `package_transitions` tables are intentionally not materialized. That keeps `build-course-db` dependable after each refresh; schedule overlap and transition logic should run only on the small candidate set selected for a specific search.

## Freshness

- Availability is snapshot data, not live enrollment truth.
- Check `refresh_runs` to see when the database was last rebuilt.

```sql
SELECT *
FROM refresh_runs
ORDER BY last_refreshed_at DESC
LIMIT 1;
```

## Useful Queries

### Open sections in a subject

```sql
SELECT *
FROM section_overview_v
WHERE subject_code = '232'
  AND has_open_seats = 1
ORDER BY catalog_number, section_number;
```

### Full package snapshots with waitlists

```sql
SELECT *
FROM availability_v
WHERE is_full = 1
  AND has_waitlist = 1
ORDER BY subject_code, catalog_number;
```

### Courses whose freshest package timestamp set includes any online-only or asynchronous package

```sql
SELECT *
FROM online_courses_v
ORDER BY subject_code, catalog_number, course_id;
```

### Schedule planning rows with known locations

```sql
SELECT *
FROM schedule_planning_v
WHERE location_known = 1
ORDER BY subject_code, catalog_number, section_number;
```

### Canonical meeting dates and exam timing for one section

```sql
SELECT *
FROM schedule_planning_v
WHERE course_id = '025942'
  AND section_class_number = 22285
ORDER BY meeting_index;
```

### AI package candidates for a schedule search

```sql
SELECT *
FROM schedule_candidates_v
WHERE course_designation IN ('STAT 340', 'ENGL 462', 'COMP SCI 577')
ORDER BY course_designation, campus_day_count, earliest_start_minute_local;
```

### Candidate packages for a schedule search

```sql
SELECT *
FROM schedule_candidates_v
WHERE course_designation IN ('STAT 340', 'ENGL 462', 'COMP SCI 577')
ORDER BY course_designation, campus_day_count, earliest_start_minute_local;
```

### Candidate-local canonical meetings for custom schedule logic

```sql
SELECT *
FROM canonical_meetings
WHERE source_package_id IN (
  '1272:220:003210:stat340-main',
  '1272:350:004620:engl462-main'
)
ORDER BY source_package_id, start_date, start_minute_local;
```

### AI-friendly prerequisite summary for one course

```sql
SELECT
  course_designation,
  summary_status,
  course_groups_json,
  escape_clauses_json,
  raw_text,
  unparsed_text
FROM prerequisite_course_summary_overview_v
WHERE course_designation = 'COMP SCI 577';
```

Interpretation:
- each inner array in `course_groups_json` is a one-of course set
- the outer array means one set from each group is required
- `escape_clauses_json` lists non-course alternatives that may satisfy or bypass the course-group path

### Resolve a cross-listed alias back to the canonical course row

```sql
SELECT canonical_course_designation, alias_course_designation, course_id, is_primary
FROM course_cross_listing_overview_v
WHERE alias_course_designation = 'COMP SCI 240';
```

Use the returned `course_id` as the canonical key for follow-up overview queries. Some designations are reused across distinct course ids in the source dataset, so an alias lookup can return more than one row.

### See all aliases on the canonical course row

```sql
SELECT course_designation, cross_list_designations_json, cross_list_count
FROM course_overview_v
WHERE term_code = '1272'
  AND course_id = '011630';
```
