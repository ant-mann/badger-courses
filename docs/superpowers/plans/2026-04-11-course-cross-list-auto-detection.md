# Course Cross-List Auto-Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect cross-listed courses from shared `courseId`, persist explicit alias rows, and expose alias-aware lookup/query surfaces without duplicating canonical course rows.

**Architecture:** Keep `courses` as the canonical `(term_code, course_id)` table, add a `course_cross_listings` alias table keyed back to that canonical identity, and expose cross-list data through a dedicated overview view plus aggregated alias columns on `course_overview_v`. Build aliases directly from raw source groups using only shared `courseId`.

**Tech Stack:** Node.js, `better-sqlite3`, SQLite views/tables, node:test

---

## File Structure

- Modify: `src/db/build-course-db.mjs`
  - derive canonical course groups from raw `(termCode, courseId)` source rows
  - emit cross-list alias rows during DB build
  - insert the new alias rows before views rely on them
- Modify: `src/db/import-helpers.mjs`
  - add row-builder helpers for cross-list alias rows
  - keep helper responsibilities narrow and data-shape oriented
- Modify: `src/db/schema.sql`
  - add `course_cross_listings`
  - add indexes/constraints
  - add `course_cross_listing_overview_v`
  - extend `course_overview_v` with aggregated cross-list metadata
- Modify: `tests/db-import.test.mjs`
  - add integration coverage for canonical row retention, alias row materialization, alias lookup, and overview aggregation
- Modify: `docs/querying-course-db.md`
  - document alias lookup and canonical overview queries

## Task 1: Add Schema Support For Cross-List Aliases

**Files:**
- Modify: `src/db/schema.sql`
- Test: `tests/db-import.test.mjs`

- [ ] **Step 1: Write the failing schema/integration test for cross-list storage**

Add a new test near the existing DB materialization tests in `tests/db-import.test.mjs` using a fixture with two raw course records sharing one `courseId`:

```js
test('build-course-db materializes cross-listed aliases for a shared course id', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '011630',
        subjectCode: '302',
        catalogNumber: '240',
        courseDesignation: 'COMP SCI 240',
        title: 'Introduction to Discrete Mathematics',
      }),
      makeCourse({
        termCode: '1272',
        courseId: '011630',
        subjectCode: '600',
        catalogNumber: '240',
        courseDesignation: 'MATH 240',
        title: 'Introduction to Discrete Mathematics',
      }),
    ],
    packageSnapshot: { termCode: '1272', results: [] },
  });

  try {
    const rows = fixture.db
      .prepare(`
        SELECT course_designation, is_primary
        FROM course_cross_listings
        WHERE term_code = '1272' AND course_id = '011630'
        ORDER BY course_designation
      `)
      .all();

    assert.deepEqual(rows, [
      { course_designation: 'COMP SCI 240', is_primary: 1 },
      { course_designation: 'MATH 240', is_primary: 0 },
    ]);
  } finally {
    fixture.cleanup();
  }
});
```

- [ ] **Step 2: Run the test to verify it fails for the missing table**

Run: `node --test tests/db-import.test.mjs --test-name-pattern "cross-listed aliases"`

Expected: FAIL with an error like `no such table: course_cross_listings`

- [ ] **Step 3: Add the new alias table and constraints to the schema**

Update `src/db/schema.sql` by adding the table after `courses`:

```sql
CREATE TABLE course_cross_listings (
  term_code TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_designation TEXT NOT NULL,
  full_course_designation TEXT,
  subject_code TEXT,
  catalog_number TEXT,
  is_primary INTEGER NOT NULL,
  PRIMARY KEY (term_code, course_id, course_designation),
  UNIQUE (term_code, course_designation),
  FOREIGN KEY (term_code, course_id)
    REFERENCES courses (term_code, course_id)
    ON DELETE CASCADE
);
```

Add supporting indexes near the other indexes:

```sql
CREATE INDEX idx_course_cross_listings_course ON course_cross_listings(term_code, course_id);
CREATE INDEX idx_course_cross_listings_designation ON course_cross_listings(term_code, course_designation);
```

- [ ] **Step 4: Run the same test again to verify the schema now exists**

Run: `node --test tests/db-import.test.mjs --test-name-pattern "cross-listed aliases"`

Expected: FAIL again, but now because no rows are inserted yet.

- [ ] **Step 5: Commit the schema-only groundwork**

```bash
git add src/db/schema.sql tests/db-import.test.mjs
git commit -m "Add course cross-listing schema"
```

## Task 2: Materialize Cross-List Alias Rows During DB Build

**Files:**
- Modify: `src/db/build-course-db.mjs`
- Modify: `src/db/import-helpers.mjs`
- Test: `tests/db-import.test.mjs`

- [ ] **Step 1: Write the failing helper/integration assertions for canonical plus alias materialization**

Extend the same DB test so it also asserts:

```js
const canonicalCourses = fixture.db
  .prepare(`
    SELECT term_code, course_id, course_designation, title
    FROM courses
    WHERE term_code = '1272' AND course_id = '011630'
  `)
  .all();

assert.equal(canonicalCourses.length, 1);
assert.equal(canonicalCourses[0].course_designation, 'COMP SCI 240');
```

This pins the expected behavior: one canonical row in `courses`, plus explicit aliases in `course_cross_listings`.

- [ ] **Step 2: Run the targeted test to verify row materialization is still missing**

Run: `node --test tests/db-import.test.mjs --test-name-pattern "cross-listed aliases"`

Expected: FAIL because the alias rows are not inserted.

- [ ] **Step 3: Add a row builder for cross-list alias rows**

In `src/db/import-helpers.mjs`, add a focused helper near `makeCourseRow`:

```js
export function makeCourseCrossListingRows(courses = [], primaryCourseDesignation = null) {
  const seen = new Set();

  return courses.flatMap((course) => {
    const termCode = course.termCode;
    const courseId = course.courseId;
    const courseDesignation = course.courseDesignation ?? null;
    if (!termCode || !courseId || !courseDesignation) return [];

    const key = `${termCode}:${courseId}:${courseDesignation}`;
    if (seen.has(key)) return [];
    seen.add(key);

    return [{
      term_code: termCode,
      course_id: courseId,
      course_designation: courseDesignation,
      full_course_designation: course.fullCourseDesignation ?? null,
      subject_code: course.subject?.subjectCode ?? null,
      catalog_number: course.catalogNumber ?? null,
      is_primary: courseDesignation === primaryCourseDesignation ? 1 : 0,
    }];
  });
}
```

- [ ] **Step 4: Wire cross-list alias collection into the DB build**

In `src/db/build-course-db.mjs`:

1. import the new helper:

```js
import {
  // ...existing helpers...
  makeCourseCrossListingRows,
} from './import-helpers.mjs';
```

2. derive alias rows from the raw `courses` array after `courseRows` are built:

```js
const courseCrossListingRows = courseRows.flatMap((courseRow) => {
  const sourceGroup = courses.filter(
    (course) => course.termCode === courseRow.term_code && course.courseId === courseRow.course_id,
  );
  return makeCourseCrossListingRows(sourceGroup, courseRow.course_designation);
});
```

3. add the insert statement:

```js
const insertCourseCrossListing = db.prepare(`
  INSERT INTO course_cross_listings (
    term_code, course_id, course_designation, full_course_designation,
    subject_code, catalog_number, is_primary
  ) VALUES (
    @term_code, @course_id, @course_designation, @full_course_designation,
    @subject_code, @catalog_number, @is_primary
  )
`);
```

4. insert rows immediately after canonical `courses`:

```js
for (const row of courseRows) insertCourse.run(row);
for (const row of courseCrossListingRows) insertCourseCrossListing.run(row);
```

- [ ] **Step 5: Run the targeted test to verify alias rows now materialize**

Run: `node --test tests/db-import.test.mjs --test-name-pattern "cross-listed aliases"`

Expected: PASS

- [ ] **Step 6: Commit the build materialization work**

```bash
git add src/db/build-course-db.mjs src/db/import-helpers.mjs tests/db-import.test.mjs
git commit -m "Materialize course cross-listing aliases"
```

## Task 3: Add Alias-Aware Query Views And Aggregation

**Files:**
- Modify: `src/db/schema.sql`
- Test: `tests/db-import.test.mjs`

- [ ] **Step 1: Write the failing integration test for alias lookup and overview aggregation**

Add two assertions to the same fixture-based DB test:

```js
const aliasLookup = fixture.db
  .prepare(`
    SELECT canonical_course_designation, alias_course_designation, course_id, is_primary
    FROM course_cross_listing_overview_v
    WHERE alias_course_designation = 'MATH 240'
  `)
  .get();

assert.deepEqual(aliasLookup, {
  canonical_course_designation: 'COMP SCI 240',
  alias_course_designation: 'MATH 240',
  course_id: '011630',
  is_primary: 0,
});

const overviewRow = fixture.db
  .prepare(`
    SELECT course_designation, cross_list_count, cross_list_designations_json
    FROM course_overview_v
    WHERE term_code = '1272' AND course_id = '011630'
  `)
  .get();

assert.equal(overviewRow.course_designation, 'COMP SCI 240');
assert.equal(overviewRow.cross_list_count, 2);
assert.deepEqual(JSON.parse(overviewRow.cross_list_designations_json), ['COMP SCI 240', 'MATH 240']);
```

- [ ] **Step 2: Run the targeted test to verify the views/columns are missing**

Run: `node --test tests/db-import.test.mjs --test-name-pattern "cross-listed aliases"`

Expected: FAIL with `no such view` or `no such column`.

- [ ] **Step 3: Add the overview view and extend `course_overview_v`**

Update `src/db/schema.sql`.

Add the new view before `course_overview_v` or immediately after it:

```sql
CREATE VIEW course_cross_listing_overview_v AS
SELECT
  ccl.term_code,
  ccl.course_id,
  c.course_designation AS canonical_course_designation,
  ccl.course_designation AS alias_course_designation,
  ccl.full_course_designation,
  ccl.subject_code,
  ccl.catalog_number,
  c.title,
  ccl.is_primary
FROM course_cross_listings ccl
JOIN courses c
  ON c.term_code = ccl.term_code AND c.course_id = ccl.course_id;
```

Then rewrite `course_overview_v` so it joins aggregated alias metadata:

```sql
WITH cross_list_agg AS (
  SELECT
    term_code,
    course_id,
    json_group_array(course_designation) AS cross_list_designations_json,
    COUNT(*) AS cross_list_count
  FROM (
    SELECT term_code, course_id, course_designation
    FROM course_cross_listings
    ORDER BY course_designation
  )
  GROUP BY term_code, course_id
)
SELECT
  c.term_code,
  c.subject_code,
  c.catalog_number,
  c.course_id,
  c.course_designation,
  c.title,
  c.minimum_credits,
  c.maximum_credits,
  COALESCE(cla.cross_list_designations_json, json_array(c.course_designation)) AS cross_list_designations_json,
  COALESCE(cla.cross_list_count, 1) AS cross_list_count,
  COUNT(DISTINCT so.section_class_number) AS section_count,
  MAX(so.has_open_seats) AS has_any_open_seats,
  MAX(so.has_waitlist) AS has_any_waitlist,
  MAX(so.is_full) AS has_any_full_section
FROM courses c
LEFT JOIN section_overview_v so
  ON so.term_code = c.term_code AND so.course_id = c.course_id
LEFT JOIN cross_list_agg cla
  ON cla.term_code = c.term_code AND cla.course_id = c.course_id
GROUP BY
  c.term_code, c.subject_code, c.catalog_number, c.course_id,
  c.course_designation, c.title, c.minimum_credits, c.maximum_credits,
  cla.cross_list_designations_json, cla.cross_list_count;
```

- [ ] **Step 4: Run the targeted test to verify alias lookup and aggregation now pass**

Run: `node --test tests/db-import.test.mjs --test-name-pattern "cross-listed aliases"`

Expected: PASS

- [ ] **Step 5: Commit the view/query-surface work**

```bash
git add src/db/schema.sql tests/db-import.test.mjs
git commit -m "Add cross-list lookup views"
```

## Task 4: Add Regression Coverage For Non-Cross-Listed Courses

**Files:**
- Modify: `tests/db-import.test.mjs`

- [ ] **Step 1: Write the failing regression test for singleton courses**

Add a second small fixture test:

```js
test('build-course-db keeps singleton courses canonical while still exposing one alias designation', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      makeCourse({
        termCode: '1272',
        courseId: '003210',
        subjectCode: '220',
        catalogNumber: '340',
        courseDesignation: 'STAT 340',
        title: 'Data Science Modeling',
      }),
    ],
    packageSnapshot: { termCode: '1272', results: [] },
  });

  try {
    const count = fixture.db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM course_cross_listings
        WHERE term_code = '1272' AND course_id = '003210'
      `)
      .get();

    assert.equal(count.count, 1);
  } finally {
    fixture.cleanup();
  }
});
```

- [ ] **Step 2: Run the targeted regression test to verify current behavior**

Run: `node --test tests/db-import.test.mjs --test-name-pattern "singleton courses canonical"`

Expected: PASS if singleton alias rows already work; otherwise FAIL and reveal the gap.

- [ ] **Step 3: If needed, make the minimal build fix for singleton alias rows**

If the test fails, keep the implementation uniform by preserving the existing Task 2 approach:

```js
return makeCourseCrossListingRows(sourceGroup, courseRow.course_designation);
```

That should already emit the primary designation for singletons too.

- [ ] **Step 4: Run the focused integration tests again**

Run: `node --test tests/db-import.test.mjs --test-name-pattern "(cross-listed aliases|singleton courses canonical)"`

Expected: PASS

- [ ] **Step 5: Commit the regression coverage**

```bash
git add tests/db-import.test.mjs
git commit -m "Test cross-list alias regression cases"
```

## Task 5: Document Cross-List Queries And Run Full Verification

**Files:**
- Modify: `docs/querying-course-db.md`
- Test: `tests/db-import.test.mjs`
- Verify: `tests/prerequisite-helpers.test.mjs`
- Verify: `tests/prerequisite-summary-helpers.test.mjs`
- Verify: full suite

- [ ] **Step 1: Add documentation for canonical and alias queries**

Append a short section to `docs/querying-course-db.md` with concrete examples:

```md
## Querying Cross-Listed Courses

Resolve an alias designation back to the canonical course row:

```sql
SELECT canonical_course_designation, alias_course_designation, course_id
FROM course_cross_listing_overview_v
WHERE alias_course_designation = 'COMP SCI 240';
```

See all aliases on a canonical course row:

```sql
SELECT course_designation, cross_list_designations_json, cross_list_count
FROM course_overview_v
WHERE course_designation = 'MATH 240';
```
```

- [ ] **Step 2: Run the DB integration suite**

Run: `node --test tests/db-import.test.mjs`

Expected: PASS

- [ ] **Step 3: Run adjacent prerequisite suites to catch view/schema regressions**

Run: `node --test tests/prerequisite-helpers.test.mjs`

Expected: PASS

Run: `node --test tests/prerequisite-summary-helpers.test.mjs`

Expected: PASS

- [ ] **Step 4: Run the full project suite**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Rebuild the DB and spot-check the real cross-list case**

Run: `npm run build:course-db`

Expected: PASS and JSON summary output

Then run:

```bash
sqlite3 data/fall-2026.sqlite "SELECT canonical_course_designation, alias_course_designation, course_id, is_primary FROM course_cross_listing_overview_v WHERE alias_course_designation IN ('COMP SCI 240', 'MATH 240') ORDER BY alias_course_designation;"
```

Expected rows:

```text
COMP SCI 240|COMP SCI 240|011630|1
COMP SCI 240|MATH 240|011630|0
```

- [ ] **Step 6: Commit docs after verification**

```bash
git add docs/querying-course-db.md
git commit -m "Document cross-list course queries"
```

## Self-Review

- Spec coverage check:
  - canonical course identity preserved: Tasks 1-3
  - explicit alias storage: Tasks 1-2
  - alias lookup to canonical row: Task 3
  - alias aggregation on canonical overview: Task 3
  - same-`courseId` only rule: Tasks 2 and 4
  - tests and docs: Tasks 4-5
- Placeholder scan:
  - no unresolved placeholder markers or deferred implementation notes remain
- Type consistency:
  - table name: `course_cross_listings`
  - view name: `course_cross_listing_overview_v`
  - overview columns: `cross_list_designations_json`, `cross_list_count`
