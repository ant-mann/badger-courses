# uw-madison-courses

A toolset for extracting UW–Madison course and enrollment data and building a local SQLite database you can explore with an AI assistant or query directly.

## Overview

This project targets **Fall 2026** enrollment data from the [UW–Madison public enrollment site](https://public.enroll.wisc.edu). The intended workflow is:

1. **Extract** – scrape all course and enrollment data locally to a JSON file.
2. **Build** – import the JSON into a structured SQLite database ready for queries.
3. **Explore** – point your AI assistant (Cursor, Claude Desktop, Copilot, etc.) at the project directory and the SQLite database to ask questions, build schedules, and explore course availability in natural language.

The project also ships a programmatic **schedule generator** that finds conflict-free section combinations from the database and ranks them by quality metrics (fewest campus days, latest start time, minimal idle gaps, tight transitions, etc.).

### Current scope

The toolset is entirely **local and offline-first**. You run the extractor once to pull down a snapshot of enrollment data, build the database on your machine, and then use whatever query tool or AI you prefer against the local files. There is no server, no hosted API, and no login required beyond the initial browser-based scrape.

### Future plans

The long-term goal is a **web application** that lets any UW–Madison student make advanced queries against the enrollment database and interactively build custom schedules — without needing to install anything locally.

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

## Using an AI with the Local Data

After running steps 1 and 2 above you have everything an AI assistant needs to answer questions about UW–Madison courses.

**Recommended approach**

1. Open the project directory in your AI-enabled editor or chat client (e.g. Cursor, Claude Desktop, VS Code + Copilot).
2. Point the AI at `data/fall-2026.sqlite` as the database source and `docs/querying-course-db.md` as the query reference.
3. Ask questions in plain English — the AI can write and run SQL against the local database, explore availability, compare sections, and suggest schedules.

**Example prompts**

- *"Which CS 300-level courses still have open seats?"*
- *"Build me a schedule with COMP SCI 577, STAT 340, and MATH 340 that avoids Fridays."*
- *"Show me all online or asynchronous options for breadth requirements."*
- *"What instructors teach ECON 101 this fall and which section has the most open seats?"*

See [`docs/querying-course-db.md`](docs/querying-course-db.md) for the recommended views and patterns to steer the AI toward — this file is designed to be included in an AI context window.

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

