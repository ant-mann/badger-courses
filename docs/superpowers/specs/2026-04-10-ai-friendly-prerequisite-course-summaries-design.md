# AI-Friendly Prerequisite Course Summaries Design

## Goal

Make courses like `COMP SCI 577` queryable in an AI-friendly way by turning prerequisite text into structured course option groups plus separate non-course escape clauses.

## Current State

The repo now stores prerequisite data in three durable tables:

- `prerequisite_rules`
- `prerequisite_nodes`
- `prerequisite_edges`

It also exposes `prerequisite_rule_overview_v` for rule-level inspection.

This is enough for storage and debugging, but not enough for direct AI queries like:

- "what courses are required for `COMP SCI 577`?"
- "what are the course-only groups for this prerequisite?"

The main blocker is that the current parser is intentionally conservative and does not yet reliably structure:

- multi-word subjects like `COMP SCI`
- slash subject alternatives like `COMP SCI/MATH 240`
- shared-number slash alternatives like `COMP SCI/MATH/STAT 475`
- nested grouped boolean course logic mixed with non-course escape clauses

## Target User Experience

An AI or downstream query should be able to ask for one course and receive a structured answer that prioritizes course-only groups, while still exposing non-course alternatives separately.

For `COMP SCI 577`, the intended logical interpretation is:

- one of: `COMP SCI 240`, `MATH 240`, `COMP SCI 475`, `MATH 475`, `STAT 475`
- and one of: `COMP SCI 367`, `COMP SCI 400`
- unless one of these escape clauses applies:
  - `graduate/professional standing`
  - `declared in the Capstone Certificate in Computer Sciences for Professionals`

The AI-facing surface should make that answer easy without requiring raw-text interpretation.

## Design Principles

1. Preserve the conservative parser stance.
2. Keep raw prerequisite text as the source of truth.
3. Separate course-group logic from non-course escape clauses.
4. Do not fabricate course structure from unsupported text.
5. Materialize a durable read model so AI and SQL consumers do not need to rebuild logic at query time.

## Proposed Architecture

### 1. Extend the parser for course-group cases we now care about

The parser in `src/db/prerequisite-helpers.mjs` should be extended to recognize a narrow additional set of safe patterns needed for `COMP SCI 577`-class prerequisites:

- multi-word subjects like `COMP SCI 367`
- slash subject alternatives sharing one course number, for example:
  - `COMP SCI/MATH 240`
  - `COMP SCI/MATH/STAT 475`
- grouped boolean course clauses such as:
  - `(A or B) and (C or D)`
- shorthand number reuse inside grouped multi-word-subject clauses such as:
  - `(COMP SCI 367 or 400)`

This parser work should remain conservative.

If a clause is still not confidently understood, the parser should continue to emit `partial` output and preserve the unresolved shape in `unparsedText`.

### 2. Add a summary layer above the graph

The graph tables remain the durable source of truth. A new summary helper should consume a parsed prerequisite rule and produce an AI-facing summary object.

Recommended new helper file:

- `src/db/prerequisite-summary-helpers.mjs`

This helper should produce a normalized summary with these concepts:

- `summaryStatus`
- `courseGroups`
- `escapeClauses`
- `rawText`

#### `summaryStatus`

This is separate from parser `parseStatus` and reflects whether the AI-facing course-group summary is usable.

Suggested values:

- `structured`
- `partial`
- `opaque`

Interpretation:

- `structured`: course groups and escape clauses are trustworthy and queryable
- `partial`: some useful structure exists, but unresolved text remains
- `opaque`: only raw text should be trusted

#### `courseGroups`

Represents course-only requirement groups.

Contract:

- each group means "one of these courses"
- the list of groups means "one group from each group-set is required"

For `COMP SCI 577`, this should look conceptually like:

```json
[
  ["COMP SCI 240", "MATH 240", "COMP SCI 475", "MATH 475", "STAT 475"],
  ["COMP SCI 367", "COMP SCI 400"]
]
```

This intentionally does not try to flatten the boolean logic into a single prose string.

#### `escapeClauses`

Represents non-course alternatives that can satisfy or bypass the course-group path.

Examples:

- `graduate/professional standing`
- `declared in the Capstone Certificate in Computer Sciences for Professionals`

These remain text clauses, not fully normalized ontology objects.

That is enough for AI use while avoiding over-modeling.

### 3. Materialize the summary into the DB

The summary should be persisted during `build-course-db` rather than computed ad hoc.

Recommended storage:

- a new table for summary rows
- a new view for easy course-level querying

Recommended table shape:

- `prerequisite_course_summaries`

Recommended columns:

- `rule_id`
- `term_code`
- `course_id`
- `summary_status`
- `course_groups_json`
- `escape_clauses_json`

Recommended view:

- `prerequisite_course_summary_overview_v`

Recommended view columns:

- `term_code`
- `subject_code`
- `catalog_number`
- `course_id`
- `course_designation`
- `title`
- `rule_id`
- `parse_status`
- `parse_confidence`
- `summary_status`
- `course_groups_json`
- `escape_clauses_json`
- `raw_text`
- `unparsed_text`

This keeps the new read model easy for both SQL users and AI clients.

## Data Flow

1. `build-course-db.mjs` reads `courses.enrollment_prerequisites`
2. `parsePrerequisiteText()` produces graph-oriented parse output
3. graph rows are inserted into `prerequisite_rules`, `prerequisite_nodes`, and `prerequisite_edges`
4. the new summary helper derives AI-facing course groups and escape clauses
5. summary rows are inserted into `prerequisite_course_summaries`
6. `prerequisite_course_summary_overview_v` exposes a course-level query surface

## Query Contract

The target query for AI should be simple:

```sql
SELECT *
FROM prerequisite_course_summary_overview_v
WHERE course_designation = 'COMP SCI 577';
```

The consumer should not need to traverse `prerequisite_nodes` and `prerequisite_edges` for normal use.

Those lower-level tables remain available for debugging and future graph-first work.

## Error Handling and Conservative Fallbacks

If parser support is incomplete for a course:

- keep `parse_status` and `unparsed_text` honest
- persist whatever course-group structure is confidently known
- mark `summary_status` as `partial` or `opaque`
- never invent course groups from ambiguous syntax

This matters because complex prerequisite text often mixes course clauses with standing, consent, or program enrollment logic.

## Testing Strategy

### Parser tests

Extend `tests/prerequisite-helpers.test.mjs` with focused cases for:

- multi-word subjects like `COMP SCI 367`
- slash alternatives sharing one number like `COMP SCI/MATH 240`
- three-way slash alternatives like `COMP SCI/MATH/STAT 475`
- grouped conjunctions of OR course groups
- mixed structured course groups plus escape clauses

### Summary-helper tests

Add `tests/prerequisite-summary-helpers.test.mjs` for:

- fully structured course-group extraction
- extraction of escape clauses
- partial-summary behavior when unresolved text remains

### DB integration tests

Extend `tests/db-import.test.mjs` to assert that:

- `COMP SCI 577`-style prerequisite text materializes correctly
- summary rows are inserted during DB build
- `prerequisite_course_summary_overview_v` returns the expected course groups and escape clauses

### Documentation tests

Update `docs/querying-course-db.md` with example summary queries.

## Scope Boundaries

This design intentionally does not include:

- prerequisite transitive closure across courses
- program-requirement graph integration
- full semantic normalization of program/certificate/consent clauses
- recommendation ranking

The goal is narrower: make complex course prerequisites easy for AI to query in structured form.

## Open Decisions Resolved

- AI-facing output should prioritize course-only groups.
- Non-course alternatives should be preserved as separate escape-clause text.
- The new AI-facing result should be materialized in the DB, not computed only at query time.

## Success Criteria

This design is successful when all of the following are true:

1. `COMP SCI 577` can be queried from a dedicated overview surface.
2. The query result exposes course groups in machine-friendly form.
3. The query result also exposes non-course escape clauses separately.
4. The parser remains conservative when it does not understand a clause.
5. The database build persists both graph-level and summary-level prerequisite data.
