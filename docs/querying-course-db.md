# Querying the Course Database

## Start Here

- Primary database: `data/fall-2026.sqlite`
- Term code for Fall 2026 is `'1272'`.
- There are ~5,031 courses, ~26,898 sections, ~3,587 instructors, and 98 buildings in the database.

### View routing guide

| Goal | Use |
|---|---|
| Course-level info (credits, cross-lists, open seat summary) | `course_overview_v` |
| Cross-list alias → canonical course lookup | `course_cross_listing_overview_v` |
| Section-level seat counts, instruction mode | `section_overview_v` |
| Package-level seat counts, online flags | `availability_v` |
| Meeting times, locations, exam dates | `schedule_planning_v` |
| Online/asynchronous courses | `online_courses_v` |
| AI schedule generation (bundles + time summaries) | `schedule_candidates_v` |
| Prerequisite course groups (AI-friendly) | `prerequisite_course_summary_overview_v` |
| Raw prerequisite parse inspection | `prerequisite_rule_overview_v` |

- For AI-facing non-schedule queries, prefer the canonical views above over raw `packages`, `sections`, or `meetings`.
- Use base tables only when a view does not expose the detail you need.
- Do not query raw `meetings` directly for schedule questions unless you intentionally want every package copy. For canonical meeting rows, use `schedule_planning_v`, which already follows the selected `source_package_id`.
- Do not derive local meeting times with ad hoc timezone math; use persisted `*_minute_local` fields and `meeting_summary_local`.

### Key column notes

- `course_designation` — the human-readable course label, e.g. `'COMP SCI 577'`. Use this for most lookups.
- `subject_code` — numeric code, e.g. `'266'` for Computer Sciences. Prefer `course_designation` unless you need all courses within a department.
- `section_class_number` — the registrar class number (e.g. `35469`). Synthetic negative values appear only when the source omits a real number.
- `has_open_seats`, `is_full`, `has_waitlist` — all 0/1 integers. `NULL` means the seat count is unknown.
- `*_minute_local` — minutes since midnight in local time (America/Chicago). Divide by 60 for hours, mod 60 for minutes.
- `campus_day_count` in `schedule_candidates_v` — number of distinct in-person meeting days per week; 0 means fully online.
- `meeting_summary_local` in `schedule_candidates_v` — human-readable schedule string, e.g. `'TR 9:30 AM-10:45 AM @ Morgridge Hall'`.
- `section_bundle_label` in `schedule_candidates_v` — human-readable bundle label, e.g. `'COMP SCI 577 LEC 001 + DIS 311'`.

### Package / section identity

- Raw `sections.section_class_number` values stay canonical when the source provides a real class number.
- If every copy of a logical section omits the class number and each package contributes at most one row for that course-scoped fallback identity (`termCode` + `courseId` + `sectionNumber` + `type` + `sessionCode`), the importer writes a stable synthetic negative identifier so those missing-number copies still collapse correctly in `section_overview_v` and `course_overview_v`.
- If a package repeats the same missing-number fallback identity more than once, those duplicates are treated as ambiguous and get package-scoped synthetic negative identifiers instead.
- Raw `sections`, `meetings`, and `section_instructors` still preserve per-package detail even when the canonical views collapse duplicate copies to one logical section.

### Online course flag semantics

- `online_courses_v` is course-level over package freshness, not section tie-breaks: it treats a course as online/asynchronous when any package in that course's freshest `package_last_updated` set is flagged `online_only` or `is_asynchronous`.
- If multiple packages share the freshest timestamp, `online_courses_v` checks all of them even when `section_overview_v` breaks tied section sources down to a single package row.
- Older dropped-only package copies can still appear in `section_overview_v` when no newer section row replaces them, but stale packages never keep a course in `online_courses_v`.

### Schedule generation notes

- For AI schedule generation, use the schedule read model first:
  - `schedule_candidates_v` for section/package selection
  - `scripts/schedule-options.mjs` for candidate-local schedule enumeration, overlap checks, and transition-aware ranking
  - `canonical_meetings` for candidate-local debugging or custom schedule logic
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

---

### Does a course exist / basic info

**"Is COMP SCI 577 offered this semester? What is it?"**

```sql
SELECT course_designation, title, minimum_credits, maximum_credits,
       section_count, has_any_open_seats, cross_list_designations_json
FROM course_overview_v
WHERE course_designation = 'COMP SCI 577';
```

**"What courses does the Computer Sciences department offer?"**

```sql
SELECT course_designation, title, minimum_credits, maximum_credits, section_count
FROM course_overview_v
WHERE subject_code = '266'   -- 266 = COMPUTER SCIENCES
ORDER BY catalog_number;
```

> To look up a subject code from its name: `SELECT DISTINCT subject_code, subject_short_description, subject_description FROM courses WHERE subject_description LIKE '%Computer%'`

---

### Seat availability

**"Which sections of COMP SCI 577 still have open seats?"**

```sql
SELECT section_number, section_type, open_seats, capacity, currently_enrolled,
       has_open_seats, has_waitlist, instruction_mode
FROM section_overview_v
WHERE course_designation = 'COMP SCI 577'
ORDER BY section_type, section_number;
```

**"Which sections of MATH 221 are full but have a waitlist?"**

```sql
SELECT section_number, section_type, capacity, currently_enrolled,
       waitlist_current_size, has_waitlist
FROM section_overview_v
WHERE course_designation = 'MATH 221'
  AND is_full = 1
  AND has_waitlist = 1
ORDER BY section_number;
```

**"Show me all courses with any open seat in the Mathematics department."**

```sql
SELECT course_designation, title, section_count, has_any_open_seats
FROM course_overview_v
WHERE subject_code = '600'   -- 600 = MATHEMATICS
  AND has_any_open_seats = 1
ORDER BY catalog_number;
```

**"Which courses campus-wide have the most waitlisted sections?"**

```sql
SELECT course_designation, title, COUNT(*) AS waitlisted_sections
FROM section_overview_v
WHERE is_full = 1 AND has_waitlist = 1
GROUP BY course_designation
ORDER BY waitlisted_sections DESC
LIMIT 20;
```

---

### Meeting times and locations

**"When and where does COMP SCI 354 meet?"**

```sql
SELECT section_number, section_type, meeting_days,
       meeting_time_start, meeting_time_end,
       building_name, street_address, room, location_known,
       has_open_seats
FROM schedule_planning_v
WHERE course_designation = 'COMP SCI 354'
ORDER BY section_type, section_number, meeting_index;
```

**"What are the meeting times for section 311 of COMP SCI 577 (class number 35469)?"**

```sql
SELECT *
FROM schedule_planning_v
WHERE course_designation = 'COMP SCI 577'
  AND section_class_number = 35469
ORDER BY meeting_index;
```

**"Show me all COMP SCI 577 package bundles with their full schedule summaries."**

```sql
SELECT source_package_id, section_bundle_label, open_seats, is_full,
       campus_day_count, earliest_start_minute_local, latest_end_minute_local,
       meeting_summary_local
FROM schedule_candidates_v
WHERE course_designation = 'COMP SCI 577'
ORDER BY campus_day_count, earliest_start_minute_local;
```

---

### Schedule building / conflict avoidance

**"Find all open packages for COMP SCI 577, MATH 221, and STAT 240 sorted for schedule planning."**

```sql
SELECT course_designation, section_bundle_label, open_seats, is_full,
       campus_day_count, earliest_start_minute_local, latest_end_minute_local,
       has_temporary_restriction, meeting_summary_local
FROM schedule_candidates_v
WHERE course_designation IN ('COMP SCI 577', 'MATH 221', 'STAT 240')
ORDER BY course_designation, campus_day_count, earliest_start_minute_local;
```

**"I only want classes that meet two or fewer days a week and start after 10 AM (600 minutes)."**

```sql
SELECT course_designation, section_bundle_label, campus_day_count,
       earliest_start_minute_local, meeting_summary_local, open_seats
FROM schedule_candidates_v
WHERE campus_day_count <= 2
  AND earliest_start_minute_local >= 600
  AND open_seats > 0
ORDER BY course_designation, earliest_start_minute_local;
```

**"Show me the canonical meeting rows for a specific set of packages (for overlap checking)."**

```sql
SELECT *
FROM canonical_meetings
WHERE source_package_id IN (
  '1272:266:004289:35469',
  '1272:266:004289:35471'
)
ORDER BY source_package_id, start_date, start_minute_local;
```

---

### Online / asynchronous courses

**"What courses are fully online or asynchronous?"**

```sql
SELECT course_designation, title, minimum_credits, maximum_credits
FROM online_courses_v
ORDER BY subject_code, catalog_number;
```

**"Is COMP SCI 200 offered online?"**

```sql
SELECT course_designation, title
FROM online_courses_v
WHERE course_designation = 'COMP SCI 200';
-- Returns a row if online; returns no rows if not.
```

**"Which sections of COMP SCI 300 are online vs in-person?"**

```sql
SELECT section_number, section_type, instruction_mode, open_seats, is_full
FROM section_overview_v
WHERE course_designation = 'COMP SCI 300'
ORDER BY section_type, section_number;
-- instruction_mode values: 'Classroom Instruction', 'Online Only', 'Online (some classroom)'
```

---

### Prerequisites

**"What are the prerequisites for COMP SCI 577?"**

```sql
SELECT course_designation, summary_status,
       course_groups_json, escape_clauses_json,
       raw_text, unparsed_text
FROM prerequisite_course_summary_overview_v
WHERE course_designation = 'COMP SCI 577';
```

Interpretation:
- each inner array in `course_groups_json` is a one-of course set (choose one from the list)
- the outer array means one course from **each** group is required
- `escape_clauses_json` lists non-course alternatives (e.g. graduate standing) that may satisfy or bypass the course-group path
- `summary_status` is `'ok'` when fully parsed, `'partial'` when some text could not be parsed

Example result for COMP SCI 577:
- `course_groups_json`: `[["COMP SCI 240","MATH 240","COMP SCI 475","MATH 475","STAT 475"],["COMP SCI 367","COMP SCI 400"]]`
  → one course from group 1 AND one from group 2
- `escape_clauses_json`: `["graduate/professional standing","declared in the Capstone Certificate in Computer Sciences for Professionals"]`

**"Which courses have no prerequisites?"**

```sql
SELECT c.course_designation, c.title
FROM courses c
LEFT JOIN prerequisite_rules pr
  ON pr.term_code = c.term_code AND pr.course_id = c.course_id
WHERE pr.rule_id IS NULL
ORDER BY c.course_designation
LIMIT 20;
```

**"Inspect the raw prerequisite parse for MATH 221."**

```sql
SELECT course_designation, parse_status, parse_confidence, raw_text, unparsed_text
FROM prerequisite_rule_overview_v
WHERE course_designation = 'MATH 221';
```

---

### Cross-listed courses

**"MATH 240 and COMP SCI 240 — are they the same course?"**

```sql
SELECT canonical_course_designation, alias_course_designation, course_id, is_primary
FROM course_cross_listing_overview_v
WHERE alias_course_designation IN ('COMP SCI 240', 'MATH 240');
```

Use the returned `course_id` as the canonical key for follow-up queries. Some designations are reused across distinct course IDs in the source dataset, so an alias lookup can return more than one row.

**"What are all the aliases for the canonical COMP SCI 240 course?"**

```sql
SELECT course_designation, cross_list_designations_json, cross_list_count
FROM course_overview_v
WHERE course_designation = 'COMP SCI 240';
```

---

### Instructors

**"Who teaches COMP SCI 577 and which sections do they teach?"**

```sql
SELECT so.section_number, so.section_type,
       i.first_name, i.last_name, i.email,
       so.open_seats, so.capacity
FROM section_overview_v so
LEFT JOIN section_instructors si
  ON si.package_id = so.source_package_id
 AND si.section_class_number = so.section_class_number
LEFT JOIN instructors i ON i.instructor_key = si.instructor_key
WHERE so.course_designation = 'COMP SCI 577'
ORDER BY so.section_type, so.section_number;
```

**"What courses does instructor Silwal teach?"**

```sql
SELECT DISTINCT c.course_designation, c.title
FROM section_instructors si
JOIN instructors i ON i.instructor_key = si.instructor_key
JOIN sections s
  ON s.package_id = si.package_id
 AND s.section_class_number = si.section_class_number
JOIN courses c
  ON c.term_code = s.term_code AND c.course_id = s.course_id
WHERE i.last_name = 'Silwal'
ORDER BY c.course_designation;
```

---

### Searching by topic or keyword

**"What courses are about machine learning?"**

```sql
SELECT course_designation, title, minimum_credits
FROM courses
WHERE title LIKE '%machine learning%'
   OR description LIKE '%machine learning%'
ORDER BY course_designation;
```

**"What statistics courses are available?"**

```sql
SELECT course_designation, title, minimum_credits, maximum_credits
FROM course_overview_v
WHERE course_designation LIKE 'STAT%'
ORDER BY catalog_number;
```

---

### Credits

**"Which courses offer variable credits?"**

```sql
SELECT course_designation, title, minimum_credits, maximum_credits
FROM course_overview_v
WHERE minimum_credits != maximum_credits
ORDER BY course_designation
LIMIT 20;
```

**"What 3-credit CS courses are available with open seats?"**

```sql
SELECT course_designation, title, section_count, has_any_open_seats
FROM course_overview_v
WHERE subject_code = '266'
  AND minimum_credits = 3
  AND maximum_credits = 3
  AND has_any_open_seats = 1
ORDER BY catalog_number;
```

---

### Section types

Valid `section_type` values: `LEC` (lecture), `DIS` (discussion), `LAB` (lab), `SEM` (seminar), `IND` (independent study), `FLD` (field).

**"How many lecture sections vs discussion sections does COMP SCI 577 have?"**

```sql
SELECT section_type, COUNT(*) AS section_count,
       SUM(has_open_seats) AS sections_with_open_seats
FROM section_overview_v
WHERE course_designation = 'COMP SCI 577'
GROUP BY section_type;
```

---

### Database metadata and freshness check

```sql
SELECT *
FROM refresh_runs
ORDER BY last_refreshed_at DESC
LIMIT 1;
```
