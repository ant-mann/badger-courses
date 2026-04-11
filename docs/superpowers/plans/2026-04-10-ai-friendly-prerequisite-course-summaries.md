# AI-Friendly Prerequisite Course Summaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make complex prerequisites such as `COMP SCI 577` queryable as AI-friendly course option groups plus separate non-course escape clauses.

**Architecture:** Extend the conservative prerequisite parser only for the specific course-group patterns needed for `COMP SCI 577`-class rules, then derive a second read model above the prerequisite graph. Persist that summary during `build-course-db` so consumers can query one overview surface instead of reconstructing graph logic at query time.

**Tech Stack:** Node.js ESM, SQLite via `better-sqlite3`, repository test suite via `node --test`

---

## File Map

- Modify: `src/db/prerequisite-helpers.mjs`
  - extend conservative parsing for multi-word subjects, slash subject alternatives, grouped OR course clauses, and grouped shorthand reuse
- Create: `src/db/prerequisite-summary-helpers.mjs`
  - derive AI-facing summary objects from parsed prerequisite output
- Modify: `src/db/build-course-db.mjs`
  - materialize summary rows during DB build alongside graph rows
- Modify: `src/db/schema.sql`
  - add summary table and summary overview view
- Modify: `src/db/import-helpers.mjs`
  - add summary row builder helpers if needed for DB inserts
- Modify: `tests/prerequisite-helpers.test.mjs`
  - add parser coverage for `COMP SCI 577`-class prerequisite patterns
- Create: `tests/prerequisite-summary-helpers.test.mjs`
  - cover summary extraction behavior directly
- Modify: `tests/db-import.test.mjs`
  - assert DB build persistence and overview querying for summary rows
- Modify: `docs/querying-course-db.md`
  - document the new AI-friendly prerequisite query surface

### Task 1: Extend Parser Coverage for `COMP SCI 577`-Class Course Clauses

**Files:**
- Modify: `src/db/prerequisite-helpers.mjs`
- Test: `tests/prerequisite-helpers.test.mjs`

- [ ] **Step 1: Write the first failing parser test for a multi-word subject leaf**

Add this test near the other parser tests in `tests/prerequisite-helpers.test.mjs`:

```js
test('parses a lone multi-word subject course leaf', () => {
  const result = parsePrerequisiteText('COMP SCI 367', {
    courseDesignation: 'COMP SCI 577',
    termCode: '1272',
    courseId: '005770',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.equal(result.unparsedText, null);
  assert.deepEqual(
    result.nodes.map((node) => ({ type: node.node_type, normalized: node.normalized_value, raw: node.raw_value })),
    [{ type: NODE_TYPE.COURSE, normalized: 'COMP SCI 367', raw: 'COMP SCI 367' }],
  );
  assert.deepEqual(result.edges, []);
});
```

- [ ] **Step 2: Run the focused parser test and verify it fails**

Run: `node --test --test-name-pattern "parses a lone multi-word subject course leaf" tests/prerequisite-helpers.test.mjs`

Expected: FAIL because the current parser does not recognize `COMP SCI 367` as a structured course leaf.

- [ ] **Step 3: Implement the minimal parser change for multi-word subject leaves**

Update the course matching logic in `src/db/prerequisite-helpers.mjs` so multi-word subjects are recognized without creating false positives like the existing `COMP SCI 200` regression cases.

Constrain the change to:

- improve course recognition for explicit subject-plus-number leaves
- preserve existing slash guards and false-positive protections
- keep `raw_value` and `normalized_value` fidelity intact

- [ ] **Step 4: Re-run the focused parser test and verify it passes**

Run: `node --test --test-name-pattern "parses a lone multi-word subject course leaf" tests/prerequisite-helpers.test.mjs`

Expected: PASS

- [ ] **Step 5: Add failing parser tests for slash-alternative course groups**

Add these tests to `tests/prerequisite-helpers.test.mjs`:

```js
test('parses slash subject alternatives sharing one number into a grouped course choice', () => {
  const result = parsePrerequisiteText('COMP SCI/MATH 240', {
    courseDesignation: 'COMP SCI 577',
    termCode: '1272',
    courseId: '005770',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.OR));
  assert.deepEqual(
    result.nodes.filter((node) => node.node_type === NODE_TYPE.COURSE).map((node) => node.normalized_value),
    ['COMP SCI 240', 'MATH 240'],
  );
});

test('parses three-way slash subject alternatives sharing one number into a grouped course choice', () => {
  const result = parsePrerequisiteText('COMP SCI/MATH/STAT 475', {
    courseDesignation: 'COMP SCI 577',
    termCode: '1272',
    courseId: '005770',
  });

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.OR));
  assert.deepEqual(
    result.nodes.filter((node) => node.node_type === NODE_TYPE.COURSE).map((node) => node.normalized_value),
    ['COMP SCI 475', 'MATH 475', 'STAT 475'],
  );
});
```

- [ ] **Step 6: Run the new slash-alternative tests and verify they fail**

Run: `node --test --test-name-pattern "slash subject alternatives" tests/prerequisite-helpers.test.mjs`

Expected: FAIL because the current parser deliberately treats slash-delimited forms as unsupported.

- [ ] **Step 7: Implement minimal parser support for safe slash subject alternatives**

Update `src/db/prerequisite-helpers.mjs` to recognize only the specific safe shape:

- one or more explicit subjects separated by `/`
- exactly one shared course number
- no extra trailing prose

The result should produce a structured OR-style course group while preserving `raw_value` slices for each emitted course.

- [ ] **Step 8: Re-run the slash-alternative tests and verify they pass**

Run: `node --test --test-name-pattern "slash subject alternatives" tests/prerequisite-helpers.test.mjs`

Expected: PASS

- [ ] **Step 9: Add a failing parser test for the grouped `COMP SCI 577` course-only path**

Add this test to `tests/prerequisite-helpers.test.mjs`:

```js
test('parses grouped course requirements for comp sci 577 course-only path', () => {
  const result = parsePrerequisiteText(
    '(COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)',
    {
      courseDesignation: 'COMP SCI 577',
      termCode: '1272',
      courseId: '005770',
    },
  );

  assert.equal(result.parseStatus, PARSE_STATUS.PARSED);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.AND));
  assert.equal(result.unparsedText, null);
});
```

- [ ] **Step 10: Run the grouped-course parser test and verify it fails**

Run: `node --test --test-name-pattern "comp sci 577 course-only path" tests/prerequisite-helpers.test.mjs`

Expected: FAIL because the current parser does not build grouped AND/OR graph structure.

- [ ] **Step 11: Implement minimal grouped AND/OR graph support for course-only clauses**

Update `src/db/prerequisite-helpers.mjs` so it can parse the course-only expression shape:

- `(course-choice) and (course-choice)`
- where each grouped course-choice may itself be:
  - explicit OR clauses
  - slash-based subject alternatives
  - shorthand reused-number clauses like `COMP SCI 367 or 400`

Keep the change narrow:

- only build graph structure for clearly grouped course-only clauses
- leave mixed course-plus-non-course full expressions conservative if unresolved
- continue to preserve raw text fidelity on leaf nodes and operators

- [ ] **Step 12: Re-run the grouped-course parser test and verify it passes**

Run: `node --test --test-name-pattern "comp sci 577 course-only path" tests/prerequisite-helpers.test.mjs`

Expected: PASS

- [ ] **Step 13: Add a failing parser test for the full real `COMP SCI 577` prerequisite text**

Add this test to `tests/prerequisite-helpers.test.mjs`:

```js
test('preserves the full comp sci 577 prerequisite as a useful partial when escape clauses remain', () => {
  const result = parsePrerequisiteText(
    '(COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400), or graduate/professional standing, or declared in the Capstone Certificate in Computer Sciences for Professionals',
    {
      courseDesignation: 'COMP SCI 577',
      termCode: '1272',
      courseId: '005770',
    },
  );

  assert.equal(result.parseStatus, PARSE_STATUS.PARTIAL);
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.AND));
  assert.ok(result.nodes.some((node) => node.node_type === NODE_TYPE.STANDING));
  assert.ok(result.unparsedText.includes('Capstone Certificate in Computer Sciences for Professionals'));
});
```

- [ ] **Step 14: Run the full `COMP SCI 577` parser test and verify it fails**

Run: `node --test --test-name-pattern "full comp sci 577 prerequisite" tests/prerequisite-helpers.test.mjs`

Expected: FAIL before the mixed course-plus-escape-clause handling is complete.

- [ ] **Step 15: Implement the minimal parser change to keep the structured course path while preserving unresolved escape clauses**

Update `src/db/prerequisite-helpers.mjs` so the full `COMP SCI 577` text yields:

- recognized grouped course logic for the course-only path
- recognized standing node when present
- conservative partial output when the certificate/program clause remains unresolved
- unresolved tail text preserved honestly in `unparsedText`

- [ ] **Step 16: Re-run the focused `COMP SCI 577` parser test and verify it passes**

Run: `node --test --test-name-pattern "full comp sci 577 prerequisite" tests/prerequisite-helpers.test.mjs`

Expected: PASS

- [ ] **Step 17: Run the full prerequisite parser suite**

Run: `node --test tests/prerequisite-helpers.test.mjs`

Expected: PASS with all prerequisite helper tests green.

- [ ] **Step 18: Commit the parser work**

Run:

```bash
git add src/db/prerequisite-helpers.mjs tests/prerequisite-helpers.test.mjs
git commit -m "Extend prerequisite parsing for AI-facing course groups"
```

### Task 2: Add the AI-Friendly Summary Helper

**Files:**
- Create: `src/db/prerequisite-summary-helpers.mjs`
- Test: `tests/prerequisite-summary-helpers.test.mjs`

- [ ] **Step 1: Write the failing summary-helper tests**

Create `tests/prerequisite-summary-helpers.test.mjs` with this starting coverage:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePrerequisiteText } from '../src/db/prerequisite-helpers.mjs';
import { summarizePrerequisiteForAi } from '../src/db/prerequisite-summary-helpers.mjs';

test('summarizes a structured grouped prerequisite into course groups', () => {
  const parsed = parsePrerequisiteText('(COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)');
  const summary = summarizePrerequisiteForAi(parsed, {
    rawText: '(COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)',
  });

  assert.deepEqual(summary, {
    summaryStatus: 'structured',
    courseGroups: [
      ['COMP SCI 240', 'MATH 240', 'COMP SCI 475', 'MATH 475', 'STAT 475'],
      ['COMP SCI 367', 'COMP SCI 400'],
    ],
    escapeClauses: [],
    rawText: '(COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400)',
  });
});

test('summarizes the real comp sci 577 prerequisite into course groups plus escape clauses', () => {
  const rawText = '(COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400), or graduate/professional standing, or declared in the Capstone Certificate in Computer Sciences for Professionals';
  const parsed = parsePrerequisiteText(rawText);
  const summary = summarizePrerequisiteForAi(parsed, { rawText });

  assert.equal(summary.summaryStatus, 'partial');
  assert.deepEqual(summary.courseGroups, [
    ['COMP SCI 240', 'MATH 240', 'COMP SCI 475', 'MATH 475', 'STAT 475'],
    ['COMP SCI 367', 'COMP SCI 400'],
  ]);
  assert.ok(summary.escapeClauses.includes('graduate/professional standing'));
  assert.ok(summary.escapeClauses.some((clause) => clause.includes('Capstone Certificate in Computer Sciences for Professionals')));
});
```

- [ ] **Step 2: Run the new summary-helper tests and verify they fail**

Run: `node --test tests/prerequisite-summary-helpers.test.mjs`

Expected: FAIL because the helper file does not exist yet.

- [ ] **Step 3: Write the minimal summary helper implementation**

Create `src/db/prerequisite-summary-helpers.mjs` exporting:

- `summarizePrerequisiteForAi(parsedRule, { rawText })`

The helper should:

- derive `summaryStatus` as `structured`, `partial`, or `opaque`
- emit `courseGroups` as arrays of normalized course strings
- emit `escapeClauses` as preserved text clauses for standing/program/certificate alternatives
- keep `rawText` in the return value

Keep the implementation small and targeted to the grouped course-path shapes introduced in Task 1.

- [ ] **Step 4: Re-run the summary-helper tests and verify they pass**

Run: `node --test tests/prerequisite-summary-helpers.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit the summary-helper work**

Run:

```bash
git add src/db/prerequisite-summary-helpers.mjs tests/prerequisite-summary-helpers.test.mjs
git commit -m "Add AI-friendly prerequisite summary helper"
```

### Task 3: Persist Summary Rows During DB Build

**Files:**
- Modify: `src/db/build-course-db.mjs`
- Modify: `src/db/schema.sql`
- Modify: `src/db/import-helpers.mjs`
- Test: `tests/db-import.test.mjs`

- [ ] **Step 1: Write the failing DB integration test for summary persistence**

Add this integration test shape to `tests/db-import.test.mjs` near the other prerequisite build tests:

```js
test('build-course-db materializes AI-friendly prerequisite course summaries for comp sci 577', () => {
  const fixture = buildCourseDbFixture({
    courses: [
      {
        ...makeCourse({
          termCode: '1272',
          courseId: '005770',
          subjectCode: '302',
          catalogNumber: '577',
          courseDesignation: 'COMP SCI 577',
          title: 'Algorithms for Large Data',
        }),
        enrollmentPrerequisites:
          '(COMP SCI/MATH 240 or COMP SCI/MATH/STAT 475) and (COMP SCI 367 or 400), or graduate/professional standing, or declared in the Capstone Certificate in Computer Sciences for Professionals',
      },
    ],
    packageSnapshot: {
      termCode: '1272',
      results: [
        {
          course: { termCode: '1272', subjectCode: '302', courseId: '005770' },
          packages: [
            {
              id: 'cs577-ai-summary',
              termCode: '1272',
              subjectCode: '302',
              courseId: '005770',
              enrollmentClassNumber: 55770,
              lastUpdated: 2000,
              onlineOnly: false,
              isAsynchronous: false,
              packageEnrollmentStatus: { status: 'OPEN', availableSeats: 2, waitlistTotal: 0 },
              enrollmentStatus: { openSeats: 2, waitlistCurrentSize: 0, capacity: 20, currentlyEnrolled: 18 },
              sections: [],
            },
          ],
        },
      ],
    },
  });

  try {
    const row = fixture.db.prepare(`
      SELECT summary_status, course_groups_json, escape_clauses_json, raw_text, unparsed_text
      FROM prerequisite_course_summary_overview_v
      WHERE course_designation = 'COMP SCI 577'
    `).get();

    assert.equal(row.summary_status, 'partial');
    assert.deepEqual(JSON.parse(row.course_groups_json), [
      ['COMP SCI 240', 'MATH 240', 'COMP SCI 475', 'MATH 475', 'STAT 475'],
      ['COMP SCI 367', 'COMP SCI 400'],
    ]);
    assert.ok(JSON.parse(row.escape_clauses_json).includes('graduate/professional standing'));
  } finally {
    fixture.cleanup();
  }
});
```

- [ ] **Step 2: Run the focused DB integration test and verify it fails**

Run: `node --test --test-name-pattern "AI-friendly prerequisite course summaries" tests/db-import.test.mjs`

Expected: FAIL because the summary table/view is not defined yet.

- [ ] **Step 3: Add the summary schema**

Update `src/db/schema.sql` to create:

- `prerequisite_course_summaries`
- `prerequisite_course_summary_overview_v`

Use these columns for the table:

- `rule_id TEXT PRIMARY KEY`
- `term_code TEXT NOT NULL`
- `course_id TEXT NOT NULL`
- `summary_status TEXT NOT NULL`
- `course_groups_json TEXT NOT NULL`
- `escape_clauses_json TEXT NOT NULL`

Join the view to `courses` and `prerequisite_rules` so it exposes:

- course metadata
- parser status and confidence
- summary status
- summary JSON columns
- raw prerequisite text
- unparsed prerequisite text

- [ ] **Step 4: Add row builder support only if needed for DB inserts**

If direct object literals in `build-course-db.mjs` feel repetitive, add one helper such as:

- `makePrerequisiteCourseSummaryRow(summary)`

to `src/db/import-helpers.mjs`

Keep this helper minimal and only add it if it keeps DB insertion code cleaner.

- [ ] **Step 5: Materialize summary rows in `build-course-db.mjs`**

Update `src/db/build-course-db.mjs` so after parsing each prerequisite rule it also:

- calls `summarizePrerequisiteForAi()`
- builds one summary row per prerequisite rule
- inserts summary rows during the same transaction as prerequisite graph rows

- [ ] **Step 6: Re-run the focused DB integration test and verify it passes**

Run: `node --test --test-name-pattern "AI-friendly prerequisite course summaries" tests/db-import.test.mjs`

Expected: PASS

- [ ] **Step 7: Re-run all DB import tests**

Run: `node --test tests/db-import.test.mjs`

Expected: PASS

- [ ] **Step 8: Commit the DB materialization work**

Run:

```bash
git add src/db/build-course-db.mjs src/db/schema.sql src/db/import-helpers.mjs tests/db-import.test.mjs
git commit -m "Persist AI-friendly prerequisite course summaries"
```

### Task 4: Document the New Query Surface

**Files:**
- Modify: `docs/querying-course-db.md`

- [ ] **Step 1: Add the new view to the overview list**

Update `docs/querying-course-db.md` so the view list mentions:

- `prerequisite_rule_overview_v` for rule-level inspection
- `prerequisite_course_summary_overview_v` for AI-friendly prerequisite querying

- [ ] **Step 2: Add an example query for `COMP SCI 577`**

Add this example to `docs/querying-course-db.md`:

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

- [ ] **Step 3: Add one sentence explaining JSON interpretation**

Document that:

- each inner `course_groups_json` array is a one-of set
- the outer array means one set from each group is required
- `escape_clauses_json` lists non-course alternatives that may satisfy or bypass the course-group path

- [ ] **Step 4: Commit the docs update**

Run:

```bash
git add docs/querying-course-db.md
git commit -m "Document AI-friendly prerequisite summary queries"
```

### Task 5: Full Verification and DB Rebuild

**Files:**
- Verify: `tests/prerequisite-helpers.test.mjs`
- Verify: `tests/prerequisite-summary-helpers.test.mjs`
- Verify: `tests/db-import.test.mjs`
- Verify: `docs/querying-course-db.md`
- Verify: `data/fall-2026.sqlite`

- [ ] **Step 1: Run the focused prerequisite parser suite**

Run: `node --test tests/prerequisite-helpers.test.mjs`

Expected: PASS

- [ ] **Step 2: Run the summary-helper suite**

Run: `node --test tests/prerequisite-summary-helpers.test.mjs`

Expected: PASS

- [ ] **Step 3: Run the DB import suite**

Run: `node --test tests/db-import.test.mjs`

Expected: PASS

- [ ] **Step 4: Run the full project test suite**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Rebuild the course database**

Run: `npm run build:course-db`

Expected: PASS and `data/fall-2026.sqlite` refreshed with prerequisite graph rows plus summary rows.

- [ ] **Step 6: Spot-check the target AI query manually**

Run:

```bash
sqlite3 data/fall-2026.sqlite "SELECT course_designation, summary_status, course_groups_json, escape_clauses_json FROM prerequisite_course_summary_overview_v WHERE course_designation = 'COMP SCI 577';"
```

Expected: one row for `COMP SCI 577` with structured or partial summary output, course group JSON, and escape clause JSON.

- [ ] **Step 7: Commit the rebuilt DB if it changed**

Run:

```bash
git add data/fall-2026.sqlite
git commit -m "Refresh course DB with prerequisite summaries"
```

- [ ] **Step 8: Final status check**

Run: `git status --short`

Expected: clean working tree or only intentional uncommitted files.
