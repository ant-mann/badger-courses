# uw-madison-courses

A toolset for extracting UW–Madison course and enrollment data, building a local SQLite database, and generating conflict-free schedule combinations.

## Overview

This project targets **Fall 2026** enrollment data from the [UW–Madison public enrollment site](https://public.enroll.wisc.edu). It provides three main capabilities:

1. **Course extraction** – scrapes the enrollment search API with Playwright and saves raw course JSON.
2. **Database build** – imports the raw JSON into a structured SQLite database with canonical views for reporting and schedule planning.
3. **Schedule generation** – enumerates conflict-free section combinations from the database and ranks them by quality metrics (fewest campus days, latest start time, minimal idle gaps, tight transitions, etc.).

## Project Structure

```
uw-madison-courses/
├── data/
│   ├── fall-2026-courses.json          # Raw course records (extracted)
│   └── fall-2026.sqlite                # Built SQLite database
├── docs/
│   ├── querying-course-db.md           # SQL reference and example queries
│   └── superpowers/                    # Agent plans and specs
├── scripts/
│   ├── extract-fall-2026-courses.mjs   # Playwright-based course extractor
│   └── schedule-options.mjs            # Schedule combination generator
├── src/
│   ├── extractor-helpers.mjs           # API request/response utilities
│   └── db/
│       ├── build-course-db.mjs         # Database builder (JSON → SQLite)
│       ├── import-helpers.mjs          # Row-normalization helpers
│       ├── schedule-helpers.mjs        # Time/day/distance utilities
│       └── schema.sql                  # Full DB schema (tables, views, indexes)
└── tests/
    ├── extractor.test.mjs
    ├── db-import.test.mjs
    └── schedule-options.test.mjs
```

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- [Playwright](https://playwright.dev/) browser binaries (installed automatically via `npm install`)

```bash
npm install
npx playwright install chromium
```

## Usage

### 1. Extract course data

Scrapes all Fall 2026 courses from the enrollment search API and writes them to `data/fall-2026-courses.json`.

```bash
# Headed browser (default — lets you observe the session)
npm run extract:fall-2026

# Headless browser
npm run extract:fall-2026 -- --headless

# Also fetch per-course enrollment package details
npm run extract:fall-2026 -- --headless --include-packages
```

### 2. Build the course database

Imports the extracted JSON into `data/fall-2026.sqlite`.

```bash
npm run build:course-db
```

This creates all tables, canonical de-duplication views, and pre-computes schedule-planning fields (timezone-aware start/end minutes, days bitmasks, meeting summaries, etc.).

### 3. Generate schedule options

Finds conflict-free section combinations for a set of courses and ranks them.

```bash
npm run schedule:options -- \
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

## Database Schema

The SQLite database (`data/fall-2026.sqlite`) contains the following key tables and views:

### Base Tables

| Table | Description |
|-------|-------------|
| `courses` | One row per course (term + course ID) |
| `packages` | Enrollment packages (section bundles) |
| `sections` | Individual sections within a package |
| `meetings` | Per-section meeting times and locations |
| `buildings` | Building coordinates for walking-distance calculations |
| `instructors` / `section_instructors` | Instructor assignments |
| `canonical_sections` | De-duplicated sections across package copies |
| `canonical_meetings` | De-duplicated meetings with precomputed local times |
| `schedulable_packages` | Pre-aggregated package rows for fast schedule search |
| `refresh_runs` | Snapshot metadata (when the DB was last built) |

### Views

| View | Description |
|------|-------------|
| `course_overview_v` | Course-level summary with section/availability counts |
| `section_overview_v` | Canonical section rows with enrollment state |
| `availability_v` | Package-level seat and waitlist status |
| `schedule_planning_v` | Section + meeting + building joined for planning queries |
| `online_courses_v` | Courses with any online/asynchronous package |
| `schedule_candidates_v` | Alias of `schedulable_packages`; primary input to the schedule generator |

See [`docs/querying-course-db.md`](docs/querying-course-db.md) for example SQL queries.

## Running Tests

```bash
npm test
```

## Key Dependencies

| Package | Purpose |
|---------|---------|
| [`playwright`](https://playwright.dev/) | Headless browser for authenticated API scraping |
| [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) | Synchronous SQLite driver for Node.js |

