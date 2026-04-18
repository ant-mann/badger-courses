# Postgres Schema And Importers Design

## Summary

Design the first subproject of the SQLite/Turso to Postgres/Supabase migration: create Postgres schema files for course and Madgrades data, and add importers that bulk-load the existing SQLite artifacts into Postgres staging tables before swapping them into production tables.

This subproject intentionally stops at the data layer. It does not migrate the web runtime, schedule API, Docker image, or Fly configuration yet.

## Problem

The current system builds two SQLite artifacts and publishes them through Turso-specific workflows:

- `data/fall-2026.sqlite` for course, prerequisite, search, and schedule data
- `data/fall-2026-madgrades.sqlite` for standalone Madgrades history and match data

The next production target is Postgres, but the repository does not yet have:

- Postgres DDL for the course-side runtime objects the app depends on
- Postgres DDL for the standalone Madgrades schema
- a safe SQLite-to-Postgres publish path
- validation that repeated imports leave the target clean and consistent

Without that foundation, the later web-runtime migration would have no stable schema target.

## Goals

- Create a `public` Postgres schema for course-side runtime tables and views.
- Create a `madgrades` Postgres schema for standalone Madgrades tables.
- Preserve near-parity for the course-side tables and views the app already uses.
- Drop SQLite compatibility-only Madgrades tables and views from the course schema.
- Add repeatable publish scripts that read the built SQLite files and bulk-load Postgres.
- Make imports safe to rerun by loading into staging first, validating, then swapping.
- Verify row-count parity between SQLite source tables and Postgres staging tables.

## Non-Goals

- Migrating `web/src/lib/db.ts`, `web/src/lib/env.ts`, or route handlers to Postgres.
- Rewriting search queries to use Postgres full-text search.
- Refactoring the schedule engine.
- Reworking Madgrades matching logic.
- Replacing the existing SQLite builders as the source of truth for this phase.
- Removing Turso references from deploy/runtime configuration in this phase.

## Recommended Approach

Use the existing SQLite artifacts as the source of truth and treat Postgres as a published replica built by dedicated importer scripts.

The importers should not rerun course extraction, schedule materialization, or Madgrades matching. They should read the already-built SQLite databases, copy the required rows into Postgres staging tables in dependency order, validate parity, then transactionally overwrite the live Postgres tables.

This is preferred over a minimal runtime-only schema because later app migration work depends on stable course-detail, prerequisite, and schedule-facing views.

This is preferred over full SQLite parity because the SQLite compatibility-only Madgrades objects exist to support the current fallback model and would add dead weight to the Postgres schema.

## Scope Boundary

This spec covers four new files only:

- `scripts/schema-postgres.sql`
- `scripts/schema-madgrades-postgres.sql`
- `scripts/publish-course-db-postgres.mjs`
- `scripts/publish-madgrades-db-postgres.mjs`

It may also require small package-level wiring in `package.json` so the new importers can run, but it does not change web runtime code.

## Source Artifacts

The importers read from these existing SQLite files:

- `data/fall-2026.sqlite`
- `data/fall-2026-madgrades.sqlite`

Those artifacts are already produced by the current build pipeline:

- `src/db/build-course-db.mjs`
- `src/madgrades/build-madgrades-db.mjs`

That pipeline remains unchanged in this subproject.

## Target Architecture

### Postgres Schemas

Use one Postgres database with two schemas:

- `public` for course data
- `madgrades` for historical grade data and match tables

This keeps the later app runtime on one physical database connection while still separating course and Madgrades ownership.

### Importer Role

Each importer is a publish step only.

Responsibilities:

- ensure the target schema exists
- create fresh staging tables for the relevant live tables
- stream rows from SQLite in batches
- bulk insert into Postgres staging tables
- validate staging counts against SQLite counts
- overwrite live tables from staging
- clean up staging tables on success or failure

### Importer Configuration

This subproject needs a dedicated Postgres connection string for the importer scripts.

Use:

- `SUPABASE_DATABASE_URL` for the importer connection

The importers are long-lived bulk-load jobs and should use a direct connection or session-pooler connection rather than a transaction-pooler connection.

Later runtime-migration phases may split this further into separate app and importer URLs, but this phase should at least document and use `SUPABASE_DATABASE_URL` for the root publish scripts.

### Root Package Wiring

Because the new publish scripts run from the repository root, the root `package.json` must add:

- `postgres` as a dependency

Use `postgres` version `^3.4.5` unless the repository standard changes before implementation.

Non-responsibilities:

- altering upstream data semantics
- recomputing course materialized tables
- recomputing Madgrades matches
- updating app code

## Public Schema Design

### Tables To Port

Port these course-side tables from `src/db/schema.sql` into `public`:

- `refresh_runs`
- `courses`
- `course_cross_listings`
- `packages`
- `sections`
- `meetings`
- `buildings`
- `instructors`
- `section_instructors`
- `prerequisite_rules`
- `prerequisite_nodes`
- `prerequisite_edges`
- `prerequisite_course_summaries`
- `canonical_sections`
- `canonical_meetings`
- `schedulable_packages`

### Views To Port

Keep the course-side views that current search, course detail, and schedule loading rely on:

- `course_overview_v`
- `course_cross_listing_overview_v`
- `section_overview_v`
- `schedule_planning_v`
- `schedule_candidates_v`
- `prerequisite_rule_overview_v`
- `prerequisite_course_summary_overview_v`

These views should stay close to their SQLite shape so later app migration can target a familiar contract.

### Search Table

Create a Postgres `course_search_fts` table instead of a SQLite FTS5 virtual table.

The table should explicitly include the current SQLite FTS payload columns as `TEXT` columns:

- `term_code`
- `course_id`
- `canonical_course_designation`
- `alias_course_designation`
- `alias_course_designation_normalized`
- `alias_course_designation_compact`
- `title`
- `title_normalized`
- `description`

Add one Postgres-only column:

- `ts tsvector NOT NULL`

Add a GIN index on `ts`.

For this subproject, the importer is responsible for reading `SELECT * FROM course_search_fts` from SQLite and populating `ts` during load using:

`to_tsvector('simple', coalesce(alias_course_designation, '') || ' ' || coalesce(alias_course_designation_compact, '') || ' ' || coalesce(title, '') || ' ' || coalesce(description, ''))`

### SQLite-Specific Changes

The Postgres DDL must remove or adapt SQLite-specific constructs:

- drop all `PRAGMA` statements
- replace SQLite-only checks such as `json_valid(...)`
- replace SQLite JSON aggregation usage in views with Postgres equivalents

Where current app code expects JSON strings, Postgres views should cast aggregated JSON back to text so later migration can preserve `JSON.parse` behavior with minimal change.

For example, `json_group_array(...)` should become `json_agg(... ORDER BY ...)::text`, and SQLite `json_array(...)` fallbacks should become Postgres JSON construction cast back to `text` as well.

The schema should also keep boolean-ish columns as `INTEGER` 0/1 fields rather than converting them to Postgres `boolean` in this phase. That avoids unnecessary app-side changes to helpers such as `asNullableBoolean` during later runtime migration.

## Madgrades Schema Design

Create `madgrades` schema objects from the standalone `src/madgrades/schema.sql` model.

### Tables To Port

- `madgrades_refresh_runs`
- `madgrades_courses`
- `madgrades_course_subject_aliases`
- `madgrades_course_names`
- `madgrades_instructors`
- `madgrades_course_grades`
- `madgrades_course_grade_distributions`
- `madgrades_instructor_grades`
- `madgrades_instructor_grade_distributions`
- `madgrades_course_offerings`
- `madgrades_course_matches`
- `madgrades_instructor_matches`

### Explicit Exclusion

Do not port the compatibility Madgrades copies embedded in `src/db/schema.sql`, and do not create the SQLite-only compatibility view `current_term_section_instructor_grade_overview_v`.

The later app migration will query `public` and `madgrades` directly instead of relying on that single-DB fallback path.

## Import Flow

### Course Import Order

The course importer should load staging tables in FK-safe order:

1. `refresh_runs`
2. `buildings`
3. `instructors`
4. `courses`
5. `course_cross_listings`
6. `packages`
7. `sections`
8. `section_instructors`
9. `meetings`
10. `prerequisite_rules`
11. `prerequisite_nodes`
12. `prerequisite_edges`
13. `prerequisite_course_summaries`
14. `canonical_sections`
15. `canonical_meetings`
16. `schedulable_packages`
17. `course_search_fts`

### Madgrades Import Order

The Madgrades importer should load staging tables in FK-safe order:

1. `madgrades_refresh_runs`
2. `madgrades_courses`
3. `madgrades_course_subject_aliases`
4. `madgrades_course_names`
5. `madgrades_instructors`
6. `madgrades_course_grades`
7. `madgrades_course_grade_distributions`
8. `madgrades_instructor_grades`
9. `madgrades_instructor_grade_distributions`
10. `madgrades_course_offerings`
11. `madgrades_course_matches`
12. `madgrades_instructor_matches`

### Batch Loading

Use `better-sqlite3` in read-only mode for the SQLite source and `postgres` for the Postgres target.

Insert batches of roughly 1000 rows at a time using `postgres.js` bulk insert support. The importer should avoid row-by-row inserts.

Staging tables should be created with bare `LIKE live_table` and no `INCLUDING ALL` clause. The staging tables are write-once, read-once tables, so copying indexes onto them would only slow bulk inserts.

## Swap Strategy

The live tables remain untouched until staging has loaded successfully and passed validation.

Recommended swap sequence:

1. create fresh staging tables using bare `LIKE live_table`
2. populate staging tables
3. validate row counts
4. inside a transaction:
   - `TRUNCATE` the live tables using an explicit leaf-first table list, with `CASCADE` only as a safety net
   - `INSERT INTO live SELECT * FROM staging`
5. drop staging tables

The preferred swap is an explicit table list in reverse dependency order rather than relying on implicit cascades alone. That keeps the overwrite surface predictable.

If any importer step fails before the transactional overwrite, the live tables stay unchanged.

If failure happens after staging creation, the importer should make a best effort to drop staging tables before exiting non-zero.

## Validation

Each importer run should perform these checks before swapping:

- row-count parity for every imported base table
- presence of the required view definitions after schema application
- clean second-run behavior with no leftover `_staging` tables

Manual spot checks should cover:

- a course lookup from `course_overview_v`
- a course alias lookup from `course_cross_listing_overview_v`
- section and meeting rows from `section_overview_v` and `schedule_planning_v`
- schedule candidate rows from `schedule_candidates_v`
- Madgrades match and grade rows in the `madgrades` schema

## Error Handling

Importer failures should be hard failures.

The scripts should:

- exit non-zero on schema-application failure
- exit non-zero on staging-load failure
- exit non-zero on row-count mismatch
- print the table name and failing step in the thrown error path

The scripts should not attempt partial recovery beyond dropping staging tables. Silent partial loads are not acceptable.

## Testing Strategy

This subproject should add or update tests that cover:

- Postgres schema application from scratch
- course importer row-count parity against `data/fall-2026.sqlite`
- Madgrades importer row-count parity against `data/fall-2026-madgrades.sqlite`
- clean rerun behavior for both importers

It is acceptable for this phase to rely partly on scripted verification if existing tests are SQLite-oriented, but the implementation plan should explicitly name the verification commands and expected outcomes.

## Risks And Resolved Decisions

### Resolved

- Use one Postgres database with `public` and `madgrades` schemas.
- Start with schema/importers before app-runtime migration.
- Preserve near-parity for course-side runtime objects.
- Drop compatibility-only Madgrades views and tables from the course-side schema.
- Keep SQLite build artifacts as the source of truth for this phase.

### Risks

- Some SQLite views may rely on syntax that needs careful Postgres translation, especially JSON aggregation and boolean coercion.
- `course_search_fts` will no longer be a virtual table, so the importer must own `tsvector` population explicitly.
- Transactional overwrite order must respect foreign keys or use controlled `TRUNCATE ... CASCADE` semantics.
- Repeated runs must clean staging objects reliably or future publishes will become brittle.

## Verification

This subproject is complete when all of the following are true:

- `scripts/schema-postgres.sql` can create the course-side Postgres objects from scratch.
- `scripts/schema-madgrades-postgres.sql` can create the `madgrades` schema from scratch.
- `scripts/publish-course-db-postgres.mjs` imports the course SQLite artifact successfully.
- `scripts/publish-madgrades-db-postgres.mjs` imports the Madgrades SQLite artifact successfully.
- Row counts match between SQLite source tables and Postgres target tables.
- A second importer run completes cleanly with no leftover staging tables.
- Manual queries against the retained `public` views return expected course, prerequisite, section, meeting, and schedule-candidate data.

## Next Spec

After this spec is implemented and verified, the next spec should migrate the web runtime to Postgres by:

- replacing libsql/better-sqlite3 runtime access with `postgres.js`
- rewriting search and course-detail queries against the new Postgres schema
- moving instructor history reads to direct `public` + `madgrades` SQL
- leaving schedule-endpoint refactoring to the third spec
