# Next.js Web App Deployment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the UW-Madison course database as a Next.js web application. MVP scope covers course search, course detail pages, and a schedule-builder API. Interactive schedule-building UI is deferred.

**Architecture:** Extract the schedule engine from `scripts/schedule-options.mjs` into an importable module under `src/schedule/`. Add a `web/` Next.js 15 workspace that reads the existing SQLite database server-side through `better-sqlite3`. The web app should query the DB directly from shared server helpers instead of making loopback HTTP requests to its own API.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS v4, TypeScript, Node.js 22+, `better-sqlite3`, npm workspaces

---

## Implementation notes before coding

1. Keep the existing repo's direct-entrypoint guard pattern: `path.resolve(process.argv[1]) === __filename`.
2. Do not run `PRAGMA journal_mode = WAL` on a read-only web DB connection.
3. Split DB env vars by purpose:
   - `MADGRADES_DB_PATH`: runtime path the web app opens.
   - `MADGRADES_DB_SOURCE_PATH`: optional local source path for prebuild copy/download.
   - `MADGRADES_DB_URL`: optional remote source URL for prebuild download.
4. In `web/next.config.ts`, use `fileURLToPath(new URL(...))` for aliases rather than `.pathname`.
5. The course search implementation is a LIKE-based MVP, not FTS5. Keep FTS5 as deferred work.
6. Server components should query shared DB helpers directly rather than `fetch()`ing local API routes.

---

## Phase 0: Refactor schedule-options.mjs

### Task 1: Extract schedule engine into an importable module

**Files:**
- Create: `src/schedule/engine.mjs`
- Modify: `scripts/schedule-options.mjs`
- Modify: `tests/schedule-options.test.mjs`

- [ ] Move all non-CLI schedule logic from `scripts/schedule-options.mjs` into `src/schedule/engine.mjs`.
- [ ] Export the existing helpers plus a new high-level `generateSchedules(db, options)` entrypoint.
- [ ] Rewrite `scripts/schedule-options.mjs` as a thin CLI wrapper that imports schedule engine helpers (`parseArgs`, `generateSchedules`, and any shared constants it needs).
- [ ] Keep the direct-execution guard consistent with `build-course-db.mjs` and `extract-fall-2026-courses.mjs`.
- [ ] Update `tests/schedule-options.test.mjs` to import `src/schedule/engine.mjs` directly instead of regex-patching the CLI file.
- [ ] Run `node -e "import('./src/schedule/engine.mjs').then((m) => console.log(Object.keys(m).sort().join(', ')))"`.
- [ ] Run `node --test tests/schedule-options.test.mjs`.
- [ ] Run `node --test`.

---

## Phase 1: Workspace and web app scaffold

### Task 2: Add npm workspace and scaffold `web/`

**Files:**
- Modify: `package.json`
- Create: `web/package.json`
- Create: `web/next.config.ts`
- Create: `web/tsconfig.json`
- Create: `web/src/app/**`
- Create: `web/src/lib/**`
- Modify: `web/.gitignore`

- [ ] Add `"workspaces": ["web"]` to the root `package.json`.
- [ ] Scaffold the Next.js 15 app in `web/` with TypeScript, App Router, Tailwind, ESLint, and `src/` layout.
- [ ] Configure `web/next.config.ts` with `serverExternalPackages: ['better-sqlite3']`.
- [ ] Add aliases for `@madgrades/schedule` and `@madgrades/db-helpers` using `fileURLToPath(new URL(...))`.
- [ ] Create `web/src/lib/env.ts` with runtime validation for `MADGRADES_DB_PATH` and source resolution helpers for build-time download.
- [ ] Create `web/src/lib/db.ts` as a read-only singleton without WAL pragma changes.
- [ ] Ignore `web/.env.local`.
- [ ] Run `npm install` from the repo root.
- [ ] Run `npm run build` from `web/`.
- [ ] Run `node --test` from the repo root.

---

## Phase 2: Shared server-side course data helpers

### Task 3: Add reusable query helpers for course search and detail data

**Files:**
- Create: `web/src/lib/course-data.ts`

- [ ] Create a shared server-side module for course search, course detail, and schedule package queries.
- [ ] Parse JSON columns (`cross_list_designations_json`, prerequisite JSON) in one place.
- [ ] Keep search implementation LIKE-based for MVP.
- [ ] Support three search modes: query-only, subject-only, and subject+query.
- [ ] Return plain serializable objects for both API routes and server components.
- [ ] Add lightweight runtime guards for invalid inputs where needed.

---

## Phase 3: API routes

### Task 4: Add course search and detail API routes

**Files:**
- Create: `web/src/app/api/courses/search/route.ts`
- Create: `web/src/app/api/courses/[designation]/route.ts`

- [ ] Add `GET /api/courses/search` with `q`, `subject`, and `limit` query params.
- [ ] Use the shared course-data helper rather than embedding SQL in the route.
- [ ] Cap search results at 50.
- [ ] Add `GET /api/courses/[designation]` returning course overview, sections, meetings, prerequisites, instructor history, and schedule packages.
- [ ] Return `404` JSON when the designation does not exist.
- [ ] Verify both routes manually in local dev.

### Task 5: Add schedule-builder API route

**Files:**
- Create: `web/src/app/api/schedules/route.ts`

- [ ] Add `POST /api/schedules` accepting `courses`, `lock_packages`, `exclude_packages`, and `limit`.
- [ ] Validate request shape and normalize course designations to uppercase trimmed strings.
- [ ] Enforce `MAX_COURSES = 8` and `MAX_LIMIT = 50`.
- [ ] Call `generateSchedules()` from `@madgrades/schedule`.
- [ ] Return JSON schedules and a short cache header.
- [ ] Verify the route manually with `curl`.

---

## Phase 4: MVP frontend pages

### Task 6: Build the search page

**Files:**
- Modify: `web/src/app/page.tsx`
- Create: `web/src/app/components/SearchBar.tsx`
- Create: `web/src/app/components/CourseCard.tsx`

- [ ] Build a client `SearchBar` component that syncs the query to the URL.
- [ ] Build a presentational `CourseCard` component for search results.
- [ ] Make `web/src/app/page.tsx` query the shared server-side course-data helper directly.
- [ ] Avoid fetching the app's own API route from the server component.
- [ ] Show empty, loading, no-results, and error states.
- [ ] Verify the page in the browser.

### Task 7: Build the course detail page

**Files:**
- Create: `web/src/app/courses/[designation]/page.tsx`
- Create: `web/src/app/components/SectionTable.tsx`
- Create: `web/src/app/components/PrerequisiteSummary.tsx`

- [ ] Build the detail page as a server component.
- [ ] Query the shared course-data helper directly.
- [ ] Render course header, description, prerequisites, section table, instructor history, and schedule packages.
- [ ] Use `notFound()` for missing courses.
- [ ] Verify the page in the browser.

---

## Phase 5: Database distribution and deployment config

### Task 8: Add build-time DB acquisition

**Files:**
- Modify: `.gitignore`
- Create: `web/scripts/download-db.mjs`
- Modify: `web/package.json`
- Create: `web/.env.local.example`

- [ ] Add `*.sqlite` to `.gitignore`.
- [ ] Create `web/scripts/download-db.mjs` supporting:
  - copy from `MADGRADES_DB_SOURCE_PATH`
  - download from `MADGRADES_DB_URL`
- [ ] Write the copied/downloaded DB to `web/data/fall-2026.sqlite`.
- [ ] Set runtime `MADGRADES_DB_PATH` to that `web/data` path for production.
- [ ] Add `prebuild` to `web/package.json`.
- [ ] Provide a `web/.env.local.example` that documents both runtime and source env vars.

### Task 9: Add Fly.io deployment config

**Files:**
- Create: `web/Dockerfile`
- Create: `web/fly.toml`
- Create: `web/.dockerignore`

- [ ] Build a Docker image that installs root workspace deps, builds `web/`, and includes `web/data/fall-2026.sqlite`.
- [ ] Keep `MADGRADES_DB_PATH=/app/web/data/fall-2026.sqlite` in the runtime image.
- [ ] Add a `.dockerignore` for `.next`, `node_modules`, and local env files.
- [ ] Add `fly.toml` targeting `ord`.
- [ ] Verify `web/` production build locally before any deploy command.

---

## Deferred

1. Interactive schedule-builder UI
2. FTS5-backed full-text course search
3. Saved schedules and comparison
4. Calendar export / print views
5. Accessibility audit
6. Turso/libSQL migration
