# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Repo layout

Pnpm monorepo with two packages:

- **Root** (`uw-madison-courses`) — Node.js ESM scripts for data extraction, SQLite DB building, Madgrades import, publishing to Postgres, and CLI schedule generation. All source files are `.mjs`; no TypeScript.
- **`web/`** (`uw-madison-courses-web`) — Next.js 15 app (React 19, TypeScript, Tailwind v4). Deployed to Fly.io.

Data flows one way: the root pipeline builds local SQLite files, the `publish:*:postgres` scripts load them into Supabase Postgres, and the web app reads only from Postgres. The web package imports nothing from root `src/`.

## Commands

### Root package (run from repo root)

```bash
pnpm test                        # root tests + web tests
pnpm run test:web                # web tests only
node --test "tests/*.test.mjs"   # root tests only (bare `node --test` also picks up web/ .ts tests and fails)
node --test tests/foo.test.mjs   # single root test file

pnpm run extract:courses                         # Playwright scraper → data/courses.json
pnpm run extract:courses -- --headless           # headless mode
pnpm run build:course-db                           # JSON → data/courses.sqlite
pnpm run import:madgrades                          # re-import from cached snapshot
MADGRADES_API_TOKEN=<tok> pnpm run import:madgrades -- --refresh-api  # fresh API pull
SUPABASE_DATABASE_URL=<url> pnpm run publish:course-db:postgres       # data/courses.sqlite → Postgres
SUPABASE_DATABASE_URL=<url> pnpm run publish:madgrades-db:postgres    # data/madgrades.sqlite → Postgres
pnpm run schedule:options -- --db data/courses.sqlite --course "COMP SCI 577"
```

### Web package

```bash
# From repo root:
pnpm --filter uw-madison-courses-web run dev
pnpm --filter uw-madison-courses-web run build
pnpm --filter uw-madison-courses-web run lint
pnpm --filter uw-madison-courses-web run test

# From web/ directory:
pnpm dev | pnpm build | pnpm lint | pnpm test
```

Web test runner is **`tsx --test`** (not jest/vitest). The `test` script in `web/package.json` lists every test file explicitly — new test files must be added to that list or they will not run.

A focused web test:
```bash
# from web/
tsx --test src/app/schedule-builder/builder-state.test.ts
```

## Web database

The web app needs `SUPABASE_DATABASE_URL` (any Postgres connection string) at request time. `next build` needs no database: every route is dynamic.

For local dev without Supabase access, load a throwaway Postgres from the local SQLite files:

```bash
docker run -d --name badger-pg -e POSTGRES_PASSWORD=pw -p 54329:5432 postgres:17
export SUPABASE_DATABASE_URL='postgres://postgres:pw@localhost:54329/postgres'
pnpm run publish:course-db:postgres && pnpm run publish:madgrades-db:postgres
pnpm --filter uw-madison-courses-web run dev
```

## Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `MADGRADES_API_TOKEN` | root scripts | Fresh Madgrades API pull |
| `SUPABASE_DATABASE_URL` | web runtime; fallback for `publish:*:postgres` scripts | Postgres connection string (pooled in production) |
| `SUPABASE_DIRECT_DATABASE_URL` | `publish:*:postgres` scripts | Direct (non-pooled) connection, preferred for bulk imports |
| `SQLITE_BATCH_SIZE` | `publish:*:postgres` scripts | Rows per insert batch, default 250 |

## Testing notes

- Root tests (`tests/*.test.mjs`) use Node.js built-in `node:test` and `node:assert/strict`. Integration tests create in-memory SQLite DBs from `src/db/schema.sql`.
- `tests/helpers/madgrades-db-fixture.mjs` is a shared fixture used by several Madgrades test files.
- Web component tests use `tsx --test` with React (no testing-library setup beyond what tsx provides).
- Web data-layer tests never touch a real database: `web/src/lib/db-test-helpers.ts` (`withDbRows`) answers queries with canned rows keyed on SQL text, so they cover row mapping and schedule logic but not SQL correctness.
- `pnpm run test:prerequisite-helpers` is a convenience shortcut for the prerequisite parser tests only.

## Deployment (Fly.io)

- Config: `fly.toml` at the repo root — app name `uw-madison-courses`, region `ord`. Deploy with `fly deploy` from the repo root.
- Docker build context is **repo root** (not `web/`): `dockerfile = "web/Dockerfile"`. The image contains only the web package.
- `SUPABASE_DATABASE_URL` is a Fly secret, not a `fly.toml` value.
- `.github/workflows/refresh-data.yml` re-extracts and republishes course data to Supabase every 6 hours.

## Key source locations

| Path | What it is |
|---|---|
| `src/db/schema.sql` | Full SQLite schema (tables, views, indexes) |
| `src/db/build-course-db.mjs` | DB builder entry point |
| `src/schedule/engine.mjs` | SQLite schedule generation engine behind the `schedule:options` CLI |
| `src/madgrades/` | Madgrades API client, importer, fuzzy matcher |
| `scripts/schema-postgres.sql`, `scripts/schema-madgrades-postgres.sql` | Postgres schemas applied by the publish scripts |
| `web/src/lib/db.ts` | Singleton `postgres` client |
| `web/src/lib/course-data.ts` | All web queries: search, course detail, instructor history, schedule generation |
| `web/src/app/schedule-builder/` | Schedule builder page, state, and data logic |
| `web/src/app/courses/[designation]/` | Per-course detail page |
| `web/src/app/api/` | API routes (`/api/courses/...`, `/api/schedules`) |
| `docs/querying-course-db.md` | SQL reference and example queries for the DB |

<!-- context7 -->
Use Context7 MCP to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service -- even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer -- your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

## Steps

1. Always start with `resolve-library-id` using the library name and the user's question, unless the user provides an exact library ID in `/org/project` format
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question). Use version-specific IDs when the user mentions a version
3. `query-docs` with the selected library ID and the user's full question (not single words)
4. Answer using the fetched docs
<!-- context7 -->