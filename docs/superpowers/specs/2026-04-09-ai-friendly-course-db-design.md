# AI-Friendly Course Database Design

## Goal

Make the Fall 2026 course snapshot usable for local LLM-driven exploration without requiring the model to read or reason over massive nested JSON files directly.

The short-term target is a local, read-only data layer that an LLM can query reliably from inside this workspace. The long-term target is to keep the structure clean enough that the same database can later support a website or local API without redesigning the underlying data model.

## User and Primary Use Case

The primary user is a power user rather than a casual student browser.

The first version should optimize for:

- flexible read-only querying by a local LLM
- high-quality structured access to course, section, meeting, and seat data
- low friction for future schedule analysis and website work

The first version should not optimize for:

- beginner-friendly browsing UX
- live minute-by-minute availability updates
- direct write workflows or editing

## Confirmed Constraints

- The current extracted data lives in:
  - `data/fall-2026-courses.json`
  - `data/fall-2026-enrollment-packages.json`
- Availability data goes stale because enrollment changes over time
- Freshness target for the first version is daily, not real-time
- The local LLM should be able to explore the data by querying a database directly from the project directory
- The first version should be read-only from the LLM's perspective

## Recommended Approach

Use SQLite as the primary local database, built from the existing JSON snapshots, with two layers:

1. normalized base tables for correctness and future extensibility
2. AI-friendly read-only views for simple, reliable LLM querying

This is preferred over leaving the dataset in raw JSON because the current files are too large and too nested for reliable ad hoc LLM use.

This is preferred over DuckDB-first because SQLite provides a better path toward future app and website work while still being easy for local analysis.

This is preferred over adding search or embeddings first because that introduces complexity before the actual local query patterns are known.

## Data Architecture

### Source of Truth

Keep the extracted JSON files as raw snapshots:

- `data/fall-2026-courses.json`
- `data/fall-2026-enrollment-packages.json`

These remain the archival source inputs for rebuilds and debugging.

### SQLite Database

Create a local SQLite database file:

- `data/fall-2026.sqlite`

This database becomes the primary query surface for the local LLM.

### Base Tables

The database should include normalized base tables that preserve the structure needed for future features:

- `courses`
- `packages`
- `sections`
- `meetings`
- `instructors`
- `section_instructors`
- `buildings`
- `refresh_runs` or another metadata table for snapshot freshness

### AI-Friendly Views

The database should include read-only views designed to be easy for an LLM to query without reconstructing the full relational model:

- `course_overview_v`
- `section_overview_v`
- `availability_v`
- `schedule_planning_v`
- `online_courses_v`

The exact names can change, but the pattern should remain:

- expose flattened, queryable, high-signal rows
- hide unnecessary join complexity
- preserve the base tables underneath for edge cases

## Table Responsibilities

### `courses`

One row per course-level record.

Should include fields like:

- `term_code`
- `course_id`
- `subject_code`
- `subject_short_description`
- `catalog_number`
- `course_designation`
- `title`
- `description`
- `minimum_credits`
- `maximum_credits`
- `enrollment_prerequisites`
- `currently_taught`
- `last_taught`

### `packages`

One row per enrollment package record.

Should include package-level availability and package identity fields such as:

- `term_code`
- `course_id`
- `subject_code`
- `enrollment_class_number`
- `package_status`
- `package_available_seats`
- `package_waitlist_total`
- `online_only`
- `is_asynchronous`

### `sections`

One row per section inside a package.

Should include:

- section identity
- class number
- section number
- type such as lecture or discussion
- instruction mode
- session code
- published flag
- seat counts
- waitlist counts

This table is important because scheduling questions depend on sections rather than only on course-level records.

### `meetings`

One row per class or exam meeting.

Should include:

- meeting type
- start and end time
- meeting days
- start and end dates
- exam date when present
- room
- building code
- building name
- street address
- latitude
- longitude

This table is essential for schedule-building and walking-distance questions.

### `buildings`

Deduplicated building/location records where possible.

Should include:

- `building_code`
- `building_name`
- `street_address`
- `latitude`
- `longitude`

This supports future campus-distance and route-style reasoning without repeating the same location metadata excessively.

### `instructors` and `section_instructors`

Separate instructor identity from section assignment.

This keeps the model flexible for questions like:

- which instructors teach a course
- which sections a specific instructor teaches
- how many sections are attached to a given instructor

## Derived Fields

Add high-signal derived fields so the LLM does not need to recompute them repeatedly:

- `is_full`
- `has_waitlist`
- `has_open_seats`
- `is_online_only`
- `is_exam`
- `days_compact`
- `location_known`
- `meeting_minutes`

These can live in views rather than physical tables if that keeps the implementation simpler.

## AI Query Layer

The LLM-facing layer should prefer views first and base tables second.

The intended workflow is:

1. read a short schema guide in the repo
2. query the AI-friendly views first
3. drop to base tables only when a question needs lower-level detail

This design reduces the chance that a model will get lost in nested JSON or produce error-prone joins for common questions.

## Documentation for Local LLM Use

Add a short guide such as:

- `docs/querying-course-db.md`

That guide should explain:

- where the SQLite file lives
- which views to query first
- what the freshness fields mean
- that availability is snapshot data, not live truth
- when to use base tables instead of views

The guide should also include example SQL for common prompts like:

- all open sections in a subject
- online-only sections
- full sections with waitlists
- sections of one course
- low-walking schedule exploration using meeting locations

## Freshness and Update Strategy

### First Version

Use a daily full refresh.

That means:

- re-run the extractor once per day
- rebuild the SQLite database from the fresh JSON snapshot
- record refresh metadata inside the database

This is intentionally simpler than trying to split seat updates from structural data updates in the first version.

### Freshness Metadata

Track freshness explicitly with fields or tables such as:

- `snapshot_run_at`
- `last_refreshed_at`
- `source_term_code`
- `snapshot_kind`

This lets the LLM answer with time awareness, for example:

- availability is from today's snapshot
- this snapshot is one day old

### Why Daily Full Refresh Is Recommended

- it is easy to understand
- it minimizes sync complexity
- it is respectful to the upstream source
- it gives enough freshness for current needs

If daily refresh later proves too expensive or too stale, the system can evolve into split refresh modes without redesigning the schema.

## Scheduling and Location Reasoning

The database should preserve enough meeting and building detail to support schedule-assistance queries later.

Examples include:

- find sections with the shortest walking distance between classes
- avoid schedules that jump across campus
- prefer online or nearby buildings on certain days
- compare schedules by compactness and travel burden

Because not every record will have perfect location data, the design should support:

- exact geographic reasoning when latitude and longitude exist
- fallback reasoning based on building name or address when coordinates are missing
- graceful handling of online-only and incomplete-location sections

## Scope Boundaries

This design is specifically for a local, read-only, AI-friendly query layer.

It does not yet include:

- a public website
- a local API service
- authentication or multi-user features
- embeddings or semantic search
- aggressive incremental refresh logic

Those can be layered later if the SQLite-first structure proves useful.

## Risks and Tradeoffs

### Schema Complexity

A normalized schema can still be intimidating to an LLM if used directly. That is why the read-only AI views and schema guide are part of the design rather than optional extras.

### Snapshot Staleness

Daily refresh means availability is useful but not truly live. The design must make freshness visible so AI answers do not overstate certainty.

### Data Volume

The package-detail snapshot is large. Importing into SQLite is still the right move, but the importer should be careful about table structure and indexes so local querying remains fast.

## Success Criteria

The design is successful when:

- a local LLM can query `data/fall-2026.sqlite` without needing to inspect huge JSON blobs directly
- common questions can be answered from AI-friendly views with minimal join complexity
- building and meeting location data is available for future schedule reasoning
- daily rebuilds keep the snapshot fresh enough for current needs
- the schema remains clean enough to support a future website or API layer
