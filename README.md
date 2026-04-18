# uw-madison-courses

A toolset for extracting UW–Madison course and enrollment data and building a local SQLite database you can explore with an AI assistant or query directly.

🌐 **Live web app → [uw-madison-courses.fly.dev](https://uw-madison-courses.fly.dev/)**

## Overview

This project targets **Fall 2026** enrollment data from the [UW–Madison public enrollment site](https://public.enroll.wisc.edu). The intended workflow is:

1. **Extract** – scrape all course and enrollment data locally to a JSON file.
2. **Build** – import the JSON into a structured SQLite database ready for queries.
3. **Explore** – point your AI assistant (Cursor, Claude Desktop, Copilot, etc.) at the project directory and the SQLite database to ask questions, build schedules, and explore course availability in natural language.

The project also ships a programmatic **schedule generator** that finds conflict-free section combinations from the database and ranks them by quality metrics (fewest campus days, latest start time, minimal idle gaps, tight transitions, etc.).

### Current scope

The core data pipeline is **local and offline-first**. You run the extractor once to pull down a snapshot of enrollment data, build the databases on your machine, and then use whatever query tool or AI you prefer against the local files. There is no login required beyond the initial browser-based scrape. Separately, the deployed web app runs on Fly and serves requests against a hosted Supabase database.

### Live web app

The project is deployed at **[uw-madison-courses.fly.dev](https://uw-madison-courses.fly.dev/)** — no installation required. The web app lets any UW–Madison student make advanced queries against the enrollment database and interactively build custom schedules directly in the browser.

The long-term goal is to keep expanding the web app's features: richer schedule-building tools, prerequisite visualization, historical grade overlays, and more.

## Project Structure

```
uw-madison-courses/
├── data/
│   ├── fall-2026-courses.json                  # Raw course records (extracted)
│   ├── fall-2026-enrollment-packages.json      # Per-course package snapshots (optional)
│   ├── fall-2026.sqlite                        # Built course/enrollment SQLite database
│   ├── fall-2026-madgrades.sqlite              # Standalone Madgrades history + match database
│   └── madgrades/                              # Cached Madgrades API snapshots
│       └── <snapshot-id>/                      # One folder per snapshot run
├── docs/
│   ├── querying-course-db.md                   # SQL reference and example queries
│   └── superpowers/                            # Agent plans and specs
├── scripts/
│   ├── extract-fall-2026-courses.mjs           # Playwright-based course extractor
│   ├── import-madgrades.mjs                    # Madgrades historical grade importer
│   └── schedule-options.mjs                    # Schedule combination generator
├── src/
│   ├── extractor-helpers.mjs                   # API request/response utilities
│   ├── db/
│   │   ├── build-course-db.mjs                 # Database builder (JSON → SQLite)
│   │   ├── import-helpers.mjs                  # Row-normalization helpers
│   │   ├── prerequisite-helpers.mjs            # Prerequisite text parser
│   │   ├── prerequisite-summary-helpers.mjs    # AI-friendly prerequisite summaries
│   │   ├── schedule-helpers.mjs                # Time/day/distance utilities
│   │   └── schema.sql                          # Full DB schema (tables, views, indexes)
│   └── madgrades/
│       ├── api-client.mjs                      # Madgrades REST API client
│       ├── import-helpers.mjs                  # Madgrades row-normalization helpers
│       ├── import-runner.mjs                   # Orchestrates the full Madgrades import
│       ├── match-helpers.mjs                   # Course/instructor fuzzy-matching logic
│       └── snapshot-helpers.mjs                # Snapshot read/write utilities
└── tests/
    ├── db-import.test.mjs
    ├── extractor.test.mjs
    ├── helpers/
    │   └── madgrades-db-fixture.mjs            # Shared DB fixture for Madgrades tests
    ├── madgrades-api-client.test.mjs
    ├── madgrades-cli.test.mjs
    ├── madgrades-db.test.mjs
    ├── madgrades-import.test.mjs
    ├── madgrades-match-helpers.test.mjs
    ├── madgrades-snapshot-helpers.test.mjs
    ├── prerequisite-helpers.test.mjs
    ├── prerequisite-summary-helpers.test.mjs
    ├── schedule-helpers.test.mjs
    └── schedule-options.test.mjs
```

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- [Playwright](https://playwright.dev/) browser binaries (installed automatically via `pnpm install`)

```bash
pnpm install
npx playwright install chromium
```

## Usage

### 1. Extract course data

Scrapes all Fall 2026 courses from the enrollment search API and writes them to `data/fall-2026-courses.json`.

```bash
# Headed browser (default — lets you observe the session)
pnpm run extract:fall-2026

# Headless browser
pnpm run extract:fall-2026 -- --headless

# Also fetch per-course enrollment package details
pnpm run extract:fall-2026 -- --headless --include-packages
```

### 2. Build the local databases

Build the course database first, then build or refresh the standalone Madgrades database when you need historical grade data.

```bash
pnpm run build:course-db
pnpm run build:madgrades-db
pnpm run rebuild:madgrades-matches
```

`pnpm run build:course-db` writes `data/fall-2026.sqlite` with the enrollment/course tables used by the schedule builder and search tools. `pnpm run build:madgrades-db` writes `data/fall-2026-madgrades.sqlite` from the latest cached or freshly refreshed Madgrades snapshot. After rebuilding the course DB, `pnpm run rebuild:madgrades-matches` refreshes only the local-to-Madgrades match tables without re-importing historical grade rows.

### 3. Import Madgrades historical grade data *(optional)*

Refreshes the standalone Madgrades database from [Madgrades](https://madgrades.com/). Requires a free Madgrades API token.

```bash
# Re-import from the latest saved snapshot (no API call needed after the first run)
pnpm run import:madgrades

# Fetch a fresh snapshot from the Madgrades API and import it
MADGRADES_API_TOKEN=<your-token> pnpm run import:madgrades -- --refresh-api
```

Snapshots are cached under `data/madgrades/` and can be re-imported into `data/fall-2026-madgrades.sqlite` at any time after rebuilding `data/fall-2026.sqlite`. These local SQLite files are the source artifacts for the optional publish/import workflows below. The deployed web runtime is separate: the Fly app connects to Supabase in production.

To refresh the legacy Turso-backed mirror databases (not the deployed runtime path):

```bash
pnpm run build:madgrades-db
pnpm run rebuild:madgrades-matches
pnpm run publish:course-db
pnpm run publish:madgrades-db
```

The publish commands now refresh the existing Turso databases in place via the Turso CLI. They require:

- `turso auth login`
- `sqlite3` on your `PATH`
- `TURSO_COURSE_DATABASE_URL` and `TURSO_MADGRADES_DATABASE_URL`

The scripts resolve the configured database names from `turso db list`, dump the local SQLite files, clear remote user tables/views, and load the new dump through `turso db shell`. They no longer use the one-time `/v1/upload` API path.

For the Postgres/Supabase migration work, the repo also includes Postgres schema and importer scripts:

```bash
pnpm run publish:course-db:postgres
pnpm run publish:madgrades-db:postgres
```

These scripts require `SUPABASE_DATABASE_URL` and are for loading the hosted Postgres database from the local SQLite artifacts. The deployed web runtime is configured separately in the deployment section below. In remote verification, the reachable Supabase pooler connections enforced a `2min` statement timeout, so the imports only completed reliably with a smaller SQLite batch size override:

```bash
SUPABASE_DATABASE_URL='postgresql://<user>:<password>@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require' \
SQLITE_BATCH_SIZE=50 \
node scripts/publish-course-db-postgres.mjs

SUPABASE_DATABASE_URL='postgresql://<user>:<password>@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require' \
SQLITE_BATCH_SIZE=50 \
node scripts/publish-madgrades-db-postgres.mjs
```

Use a percent-encoded password in the Postgres URL when it contains reserved characters. The Postgres publish scripts default to the local SQLite artifacts at `data/fall-2026.sqlite` and `data/fall-2026-madgrades.sqlite`.

### 4. Generate schedule options

Finds conflict-free section combinations for a set of courses and ranks them.

```bash
pnpm run schedule:options -- \
  --db data/fall-2026.sqlite \
  --course "COMP SCI 577" \
  --course "STAT 340" \
  --course "ENGL 462"
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--db <path>` | Path to the SQLite database (required) |
| `--course <designation>` | Course to include, e.g. `COMP SCI 577` (repeatable, at least one required) |
| `--lock-package <id>` | Pin a specific package/section bundle (repeatable) |
| `--exclude-package <id>` | Exclude a specific package/section bundle (repeatable) |
| `--limit <n>` | Maximum number of schedules to return (default: 25) |

Output is a single line of JSON:

```json
{
  "schedules": [
    {
      "package_ids": ["..."],
      "packages": [...],
      "campus_day_count": 3,
      "earliest_start_minute_local": 540,
      "large_idle_gap_count": 0,
      "tight_transition_count": 0,
      "total_walking_distance_meters": 412,
      "total_open_seats": 18,
      "latest_end_minute_local": 930
    }
  ]
}
```

Schedules are ranked by (in priority order): fewest campus days → latest start time → fewest large idle gaps → fewest tight transitions → least total walking distance → most open seats → earliest end time.

## Using an AI with the Local Data

After running steps 1-2 (and optionally 3) above you have everything an AI assistant needs to answer questions about UW-Madison courses.

**Recommended approach**

1. Open the project directory in your AI-enabled editor or chat client (e.g. Cursor, Claude Desktop, VS Code + Copilot).
2. Point the AI at `data/fall-2026.sqlite` for course/enrollment queries and optionally `data/fall-2026-madgrades.sqlite` for historical GPA queries, along with `docs/querying-course-db.md` as the query reference.
3. Ask questions in plain English — the AI can write and run SQL against the local database, explore availability, compare sections, and suggest schedules.

**Example prompts**

- *"Which CS 300-level courses still have open seats?"*
- *"Build me a schedule with COMP SCI 577, STAT 340, and MATH 340 that avoids Fridays."*
- *"Show me all online or asynchronous options for breadth requirements."*
- *"What instructors teach ECON 101 this fall and which section has the most open seats?"*

See [`docs/querying-course-db.md`](docs/querying-course-db.md) for the recommended views and patterns to steer the AI toward — this file is designed to be included in an AI context window.

## Database Schema

The project now builds two SQLite databases:

- `data/fall-2026.sqlite` for course, enrollment, prerequisite, and schedule-planning data
- `data/fall-2026-madgrades.sqlite` for standalone Madgrades history and match tables

### Course DB Tables (`data/fall-2026.sqlite`)

| Table | Description |
|-------|-------------|
| `courses` | One row per course (term + course ID) |
| `course_cross_listings` | Cross-listing aliases for each course |
| `packages` | Enrollment packages (section bundles) |
| `sections` | Individual sections within a package |
| `meetings` | Per-section meeting times and locations |
| `buildings` | Building coordinates for walking-distance calculations |
| `instructors` / `section_instructors` | Instructor assignments |
| `canonical_sections` | De-duplicated sections across package copies |
| `canonical_meetings` | De-duplicated meetings with precomputed local times |
| `schedulable_packages` | Pre-aggregated package rows for fast schedule search |
| `refresh_runs` | Snapshot metadata (when the DB was last built) |
| `prerequisite_rules` | Raw prerequisite text + parse status |
| `prerequisite_nodes` / `prerequisite_edges` | Parsed prerequisite AST |
| `prerequisite_course_summaries` | AI-friendly course-group summaries |

### Madgrades DB Tables (`data/fall-2026-madgrades.sqlite`)

| Table | Description |
|-------|-------------|
| `madgrades_courses` | Madgrades course records |
| `madgrades_instructors` | Madgrades instructor records |
| `madgrades_course_grades` | Per-term course-level GPA summaries |
| `madgrades_course_offerings` | Per-term instructor-section grade rows |
| `madgrades_course_grade_distributions` / `madgrades_instructor_grade_distributions` | Letter-grade breakdowns |
| `madgrades_instructor_grades` | Per-term instructor-level GPA summaries |
| `madgrades_course_matches` / `madgrades_instructor_matches` | Match links between local and Madgrades records |
| `madgrades_refresh_runs` | Madgrades snapshot metadata |

### Course DB Views (`data/fall-2026.sqlite`)

| View | Description |
|------|-------------|
| `course_overview_v` | Course-level summary with section/availability counts |
| `course_cross_listing_overview_v` | Cross-list alias → canonical course lookup |
| `section_overview_v` | Canonical section rows with enrollment state |
| `availability_v` | Package-level seat and waitlist status |
| `schedule_planning_v` | Section + meeting + building joined for planning queries |
| `online_courses_v` | Courses with any online/asynchronous package |
| `schedule_candidates_v` | Alias of `schedulable_packages`; primary input to the schedule generator |
| `prerequisite_rule_overview_v` | Raw prerequisite parse inspection |
| `prerequisite_course_summary_overview_v` | AI-friendly prerequisite course groups |

See [`docs/querying-course-db.md`](docs/querying-course-db.md) for example SQL queries.

## Running Tests

```bash
pnpm test
```

## Deployment

Fly deploys `web/Dockerfile` from the repo root. The production runner image does not bundle a runtime SQLite database; it connects to Supabase at request time.

Configure `SUPABASE_DATABASE_URL` for the deployed web runtime via Fly-managed secrets/config before the Fly production cutover. The checked-in `web/fly.toml` keeps an empty placeholder only to document the required variable name; do not commit a real production Postgres URL there.

The Docker build still copies `data/fall-2026.sqlite` into the build stage because `next build` requires a local SQLite file. That file is not copied into the final runner image. The `publish:*:postgres` scripts above are the separate importer workflow for refreshing the hosted Supabase database from local SQLite snapshots.

## Key Dependencies

| Package | Purpose |
|---------|---------|
| [`playwright`](https://playwright.dev/) | Headless browser for authenticated API scraping |
| [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) | Synchronous SQLite driver for Node.js |
