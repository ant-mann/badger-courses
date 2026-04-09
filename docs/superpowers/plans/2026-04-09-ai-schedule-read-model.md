# AI Schedule Read Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materialize a fast schedule read model during `build-course-db`, expose AI-first schedule query surfaces, and add a pruning-based schedule enumeration script.

**Architecture:** Keep the existing raw import pipeline and analytical views intact, then build schedule-focused materialized tables from the canonical DB layer after the base import completes. Reuse the tested canonical selection semantics already encoded in `section_overview_v` / `schedule_planning_v`, and move schedule ranking/conflict logic into deterministic derived tables plus a small Node helper CLI.

**Tech Stack:** Node.js ESM, `better-sqlite3`, SQLite SQL/materialized tables, Node test runner

---

### Task 1: Add schedule read model coverage to the test suite

**Files:**
- Modify: `tests/db-import.test.mjs`
- Create: `tests/schedule-options.test.mjs`

- [ ] **Step 1: Write failing DB materialization tests**

```js
test('build-course-db materializes canonical schedule tables and schedule candidates', () => {
  const fixture = buildCourseDbFixture({
    courses: [/* schedule fixture courses */],
    packageSnapshot: { termCode: '1272', results: [/* schedule fixture packages */] },
  });

  try {
    const canonicalSectionCount = fixture.db.prepare('SELECT COUNT(*) FROM canonical_sections').pluck().get();
    const candidateRows = fixture.db.prepare(`
      SELECT source_package_id, section_bundle_label, meeting_count, campus_day_count
      FROM schedule_candidates_v
      ORDER BY course_designation, source_package_id
    `).all();

    assert.equal(canonicalSectionCount, 4);
    assert.deepEqual(candidateRows.map((row) => row.section_bundle_label), [
      'COMP SCI 577 LEC 001',
      'ENGL 462 LEC 001',
      'STAT 340 LEC 002 + DIS 323',
    ]);
  } finally {
    fixture.cleanup();
  }
});

test('build-course-db materializes conflicts and bounded transitions', () => {
  const fixture = buildCourseDbFixture({
    courses: [/* conflicting fixture */],
    packageSnapshot: { termCode: '1272', results: [/* package fixture */] },
  });

  try {
    const conflicts = fixture.db.prepare(`
      SELECT left_package_id, right_package_id, shared_days_mask
      FROM schedule_conflicts
      ORDER BY left_package_id, right_package_id
    `).all();
    const transitions = fixture.db.prepare(`
      SELECT from_package_id, to_package_id, gap_minutes, is_tight_transition
      FROM package_transitions
      ORDER BY from_package_id, to_package_id
    `).all();

    assert.equal(conflicts.length, 1);
    assert.equal(transitions.length, 1);
  } finally {
    fixture.cleanup();
  }
});
```

- [ ] **Step 2: Run DB tests to verify they fail**

Run: `node --test tests/db-import.test.mjs`
Expected: FAIL with SQLite errors such as `no such table: canonical_sections` and `no such table: schedule_conflicts`

- [ ] **Step 3: Write failing helper-script tests**

```js
test('schedule-options returns only conflict-free ranked schedules', () => {
  const fixture = buildCourseDbFixture({
    courses: [/* ranking fixture courses */],
    packageSnapshot: { termCode: '1272', results: [/* ranking fixture packages */] },
  });

  try {
    const output = execFileSync(process.execPath, [
      path.join(repoRoot, 'scripts', 'schedule-options.mjs'),
      '--db',
      path.join(fixture.root, 'data', 'fall-2026.sqlite'),
      '--course', 'STAT 340',
      '--course', 'ENGL 462',
      '--course', 'COMP SCI 577',
      '--lock-package', '1272:220:003210:stat340-main',
    ], { encoding: 'utf8' });

    const parsed = JSON.parse(output);
    assert.equal(parsed.schedules.length > 0, true);
    assert.equal(parsed.schedules.every((schedule) => schedule.conflict_count === 0), true);
  } finally {
    fixture.cleanup();
  }
});
```

- [ ] **Step 4: Run helper-script tests to verify they fail**

Run: `node --test tests/schedule-options.test.mjs`
Expected: FAIL with `Cannot find module` for `scripts/schedule-options.mjs` or missing output fields

- [ ] **Step 5: Commit the red tests**

```bash
git add tests/db-import.test.mjs tests/schedule-options.test.mjs
git commit -m "test: cover schedule read model"
```

### Task 2: Materialize canonical schedule tables during DB build

**Files:**
- Modify: `src/db/schema.sql`
- Modify: `src/db/build-course-db.mjs`
- Test: `tests/db-import.test.mjs`

- [ ] **Step 1: Add the new schedule tables, indexes, and compatibility view**

```sql
CREATE TABLE canonical_sections (...);
CREATE TABLE canonical_meetings (...);
CREATE TABLE schedulable_packages (...);
CREATE TABLE schedule_conflicts (...);
CREATE TABLE package_transitions (...);

CREATE INDEX idx_canonical_sections_designation
  ON canonical_sections(course_designation, section_type, section_number);
CREATE INDEX idx_canonical_sections_course_package
  ON canonical_sections(term_code, course_id, source_package_id);
CREATE INDEX idx_canonical_meetings_package_time
  ON canonical_meetings(source_package_id, days_mask, start_minute_local, end_minute_local);
CREATE INDEX idx_schedulable_packages_designation_open
  ON schedulable_packages(course_designation, has_temporary_restriction, open_seats);
CREATE INDEX idx_schedulable_packages_designation_day_start
  ON schedulable_packages(course_designation, campus_day_count, earliest_start_minute_local);
CREATE INDEX idx_schedule_conflicts_left_right
  ON schedule_conflicts(left_package_id, right_package_id);
CREATE INDEX idx_schedule_conflicts_right_left
  ON schedule_conflicts(right_package_id, left_package_id);
CREATE INDEX idx_package_transitions_from_to
  ON package_transitions(from_package_id, to_package_id);

CREATE VIEW schedule_candidates_v AS
SELECT *
FROM schedulable_packages;
```

- [ ] **Step 2: Run the DB tests and verify the new tables still fail due to missing population logic**

Run: `node --test tests/db-import.test.mjs`
Expected: FAIL with assertions about zero rows / missing derived data rather than missing table definitions

- [ ] **Step 3: Implement minimal schedule materialization helpers and call them from `buildCourseDatabase`**

```js
function materializeCanonicalSections(db) {
  db.prepare(`
    INSERT INTO canonical_sections (
      term_code, subject_code, catalog_number, course_id, course_designation, title,
      minimum_credits, maximum_credits, section_class_number, source_package_id,
      source_package_last_updated, section_number, section_type, instruction_mode,
      session_code, open_seats, waitlist_current_size, capacity, currently_enrolled,
      has_open_seats, has_waitlist, is_full
    )
    SELECT
      so.term_code, so.subject_code, so.catalog_number, so.course_id, so.course_designation, so.title,
      c.minimum_credits, c.maximum_credits, so.section_class_number, so.source_package_id,
      so.source_package_last_updated, so.section_number, so.section_type, so.instruction_mode,
      so.session_code, so.open_seats, so.waitlist_current_size, so.capacity, so.currently_enrolled,
      so.has_open_seats, so.has_waitlist, so.is_full
    FROM section_overview_v so
    JOIN courses c
      ON c.term_code = so.term_code AND c.course_id = so.course_id
  `).run();
}

function materializeCanonicalMeetings(db) {
  db.prepare(`
    INSERT INTO canonical_meetings (...)
    SELECT ...
    FROM canonical_sections cs
    JOIN meetings m
      ON m.package_id = cs.source_package_id
     AND m.section_class_number = cs.section_class_number
    LEFT JOIN buildings b
      ON b.building_code = m.building_code
  `).run();
}

function materializeScheduleReadModel(db) {
  materializeCanonicalSections(db);
  materializeCanonicalMeetings(db);
  materializeSchedulablePackages(db);
  materializeScheduleConflicts(db);
  materializePackageTransitions(db);
}
```

- [ ] **Step 4: Run the focused DB tests and verify they pass**

Run: `node --test tests/db-import.test.mjs`
Expected: PASS for the new canonical/materialized-table assertions and all existing DB import tests

- [ ] **Step 5: Commit the materialized schedule layer**

```bash
git add src/db/schema.sql src/db/build-course-db.mjs tests/db-import.test.mjs
git commit -m "feat: materialize schedule read model"
```

### Task 3: Add schedule derivation helpers for local time, restrictions, and ranking inputs

**Files:**
- Create: `src/db/schedule-helpers.mjs`
- Modify: `src/db/build-course-db.mjs`
- Test: `tests/db-import.test.mjs`

- [ ] **Step 1: Write failing unit-style DB tests around DST-aware local time, restriction parsing, and transition metrics**

```js
test('build-course-db derives America/Chicago local minutes and temporary restriction flags', () => {
  const fixture = buildCourseDbFixture({ /* fixture with restriction text and post-DST exam */ });

  try {
    const row = fixture.db.prepare(`
      SELECT timezone_name, start_minute_local, end_minute_local, restriction_note, has_temporary_restriction
      FROM canonical_meetings cm
      JOIN schedulable_packages sp
        ON sp.source_package_id = cm.source_package_id
      WHERE cm.source_package_id = ?
        AND cm.meeting_type = 'CLASS'
      ORDER BY cm.meeting_index
      LIMIT 1
    `).get('1272:220:003210:stat340-main');

    assert.equal(row.timezone_name, 'America/Chicago');
    assert.equal(row.has_temporary_restriction, 1);
  } finally {
    fixture.cleanup();
  }
});
```

- [ ] **Step 2: Run the DB tests to verify the derivation assertions fail**

Run: `node --test tests/db-import.test.mjs`
Expected: FAIL on local-minute values, restriction parsing, or transition thresholds

- [ ] **Step 3: Implement shared schedule helper functions and wire them into materialization**

```js
export function meetingTimeToMinutes(meetingTimeValue) {
  if (typeof meetingTimeValue !== 'number') return null;
  return Math.trunc(meetingTimeValue / 60000);
}

export function makeDaysMask(meetingDays) {
  const DAY_BITS = { M: 1, T: 2, W: 4, R: 8, F: 16, S: 32, U: 64 };
  return [...String(meetingDays ?? '')].reduce((mask, day) => mask | (DAY_BITS[day] ?? 0), 0);
}

export function parseTemporaryRestrictionFlag(restrictionNote) {
  return /restriction\s+(will be|to be)\s+removed|removed\s+on\s+[A-Z][a-z]+\s+\d+/i.test(restrictionNote ?? '') ? 1 : 0;
}

export function haversineMeters(left, right) {
  // minimal haversine implementation
}
```

- [ ] **Step 4: Re-run the DB tests and verify they pass**

Run: `node --test tests/db-import.test.mjs`
Expected: PASS with deterministic DST-aware time fields, restriction flags, and transition metrics

- [ ] **Step 5: Commit the helper layer**

```bash
git add src/db/schedule-helpers.mjs src/db/build-course-db.mjs tests/db-import.test.mjs
git commit -m "feat: derive schedule ranking fields"
```

### Task 4: Add the pruning-first schedule enumeration script

**Files:**
- Create: `scripts/schedule-options.mjs`
- Modify: `package.json`
- Test: `tests/schedule-options.test.mjs`

- [ ] **Step 1: Run the helper-script tests and confirm the missing-script failure is still red**

Run: `node --test tests/schedule-options.test.mjs`
Expected: FAIL because `scripts/schedule-options.mjs` does not exist yet

- [ ] **Step 2: Implement the minimal DFS/backtracking schedule enumerator**

```js
const args = parseArgs(process.argv.slice(2));
const db = new Database(args.db ?? defaultDbPath, { readonly: true });
const candidates = loadCandidates(db, args.course);
const conflicts = loadConflictSet(db);
const transitions = loadTransitions(db);

function search(groupIndex, selected) {
  if (groupIndex === groupedCourses.length) {
    rankedSchedules.push(rankSchedule(selected, transitions));
    return;
  }

  for (const candidate of groupedCourses[groupIndex].packages) {
    if (conflictsWithSelection(candidate.source_package_id, selected, conflicts)) continue;
    if (violatesConstraints(candidate, args)) continue;
    search(groupIndex + 1, [...selected, candidate]);
  }
}
```

- [ ] **Step 3: Run the script tests and verify they pass**

Run: `node --test tests/schedule-options.test.mjs`
Expected: PASS with conflict-free schedules sorted by the configured ranking stack

- [ ] **Step 4: Add an npm script for convenience**

```json
{
  "scripts": {
    "schedule:options": "node scripts/schedule-options.mjs"
  }
}
```

- [ ] **Step 5: Commit the schedule helper CLI**

```bash
git add scripts/schedule-options.mjs package.json tests/schedule-options.test.mjs
git commit -m "feat: add schedule options helper"
```

### Task 5: Update AI guidance and verify the full workflow

**Files:**
- Modify: `docs/querying-course-db.md`
- Test: `tests/db-import.test.mjs`
- Test: `tests/schedule-options.test.mjs`

- [ ] **Step 1: Update the docs to route schedule generation to the new read model**

```md
- For section/package selection: query `schedule_candidates_v`
- For overlap checks: query `schedule_conflicts`
- For location-aware ranking: query `package_transitions`
- Use raw `canonical_meetings` only for debugging edge cases
- Do not derive local time with ad hoc timezone math; use persisted local-minute fields and summaries
```

- [ ] **Step 2: Run the full automated test suite**

Run: `npm test`
Expected: PASS for all extractor, DB import, and schedule helper tests

- [ ] **Step 3: Rebuild the SQLite database and smoke-test the new schedule surface**

Run: `npm run build:course-db`
Expected: JSON summary output with the database rebuilt successfully

- [ ] **Step 4: Run representative read-model queries**

Run: `node -e "import Database from 'better-sqlite3'; const db = new Database('data/fall-2026.sqlite', { readonly: true }); console.log(db.prepare(\"SELECT COUNT(*) AS count FROM schedule_candidates_v\").get()); console.log(db.prepare(\"SELECT COUNT(*) AS count FROM schedule_conflicts\").get()); console.log(db.prepare(\"SELECT COUNT(*) AS count FROM package_transitions\").get()); db.close();"`
Expected: Non-zero schedule candidate/conflict counts and a successful query against all three new surfaces

- [ ] **Step 5: Commit docs and final verification changes**

```bash
git add docs/querying-course-db.md
git commit -m "docs: guide ai schedule queries"
```
