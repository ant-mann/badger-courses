# Navbar Last-Updated Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small "Updated N hours ago" text to the navbar that shows when enrollment data was last refreshed.

**Architecture:** A pure `formatRelativeTime` utility converts a `Date` to a relative string server-side. A new exported `getLastRefreshedAt()` function queries the `refresh_runs` table via the existing `allCourseRowsRuntime` helper (works for both SQLite and Supabase/Postgres runtimes). `Navbar` becomes an async server component that calls `getLastRefreshedAt()` and renders the result between `<NavLinks />` and `<ThemeToggle />`.

**Tech Stack:** Next.js 15 (server components), TypeScript, better-sqlite3 (tests), node:test + node:assert/strict (test runner)

---

### Task 1: `formatRelativeTime` utility with tests

**Files:**
- Create: `web/src/lib/time.ts`
- Create: `web/src/lib/time.test.ts`
- Modify: `web/package.json` (add both new test files to the `test` script)

- [ ] **Step 1: Write failing tests in `web/src/lib/time.test.ts`**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRelativeTime } from "./time.js";

const BASE = new Date("2026-04-20T12:00:00.000Z");
const at = (offsetMs: number) => new Date(BASE.getTime() - offsetMs);

test("returns 'Updated just now' for 0 seconds ago", () => {
  assert.equal(formatRelativeTime(BASE, BASE), "Updated just now");
});

test("returns 'Updated just now' for 59 seconds ago", () => {
  assert.equal(formatRelativeTime(at(59_000), BASE), "Updated just now");
});

test("returns 'Updated 1 minute ago' for exactly 60 seconds ago", () => {
  assert.equal(formatRelativeTime(at(60_000), BASE), "Updated 1 minute ago");
});

test("returns 'Updated 2 minutes ago' for 2 minutes ago", () => {
  assert.equal(formatRelativeTime(at(2 * 60_000), BASE), "Updated 2 minutes ago");
});

test("returns 'Updated 1 hour ago' for exactly 60 minutes ago", () => {
  assert.equal(formatRelativeTime(at(60 * 60_000), BASE), "Updated 1 hour ago");
});

test("returns 'Updated 5 hours ago' for 5 hours ago", () => {
  assert.equal(formatRelativeTime(at(5 * 60 * 60_000), BASE), "Updated 5 hours ago");
});

test("returns 'Updated 1 day ago' for exactly 24 hours ago", () => {
  assert.equal(formatRelativeTime(at(24 * 60 * 60_000), BASE), "Updated 1 day ago");
});

test("returns 'Updated 3 days ago' for 3 days ago", () => {
  assert.equal(formatRelativeTime(at(3 * 24 * 60 * 60_000), BASE), "Updated 3 days ago");
});
```

- [ ] **Step 2: Add `time.test.ts` and `course-data-refresh.test.ts` to the test script in `web/package.json`**

Find the `"test"` script line and add `src/lib/time.test.ts src/lib/course-data-refresh.test.ts` after `src/lib/course-data.test.ts`:

```json
"test": "tsx --test src/lib/course-designation.test.ts src/lib/env.test.ts src/lib/course-data.test.ts src/lib/time.test.ts src/lib/course-data-refresh.test.ts src/app/api/courses/routes.test.ts src/app/components/NavLinks.test.ts src/app/components/PrerequisiteSummary.test.tsx src/app/courses/[designation]/schedule-package-notes.test.ts src/app/courses/[designation]/shared-enrollment-notes.test.ts src/app/courses/[designation]/instructor-history.test.ts src/app/schedule-builder/builder-state.test.ts src/app/schedule-builder/schedule-data.test.ts src/app/schedule-builder/components.test.tsx src/app/schedule-builder/route-shell.test.tsx"
```

- [ ] **Step 3: Run the tests to verify they fail (module not found)**

```bash
cd /home/chimn/madgrades/web && pnpm test 2>&1 | grep -A3 "time.test"
```

Expected: error like `Cannot find module './time.js'`

- [ ] **Step 4: Create `web/src/lib/time.ts`**

```typescript
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Updated just now";
  if (diffMin < 60) return `Updated ${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
  if (diffHour < 24) return `Updated ${diffHour} ${diffHour === 1 ? "hour" : "hours"} ago`;
  return `Updated ${diffDay} ${diffDay === 1 ? "day" : "days"} ago`;
}
```

- [ ] **Step 5: Run the `time.test.ts` tests to verify they pass**

```bash
cd /home/chimn/madgrades/web && npx tsx --test src/lib/time.test.ts 2>&1
```

Expected: 8 passing tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git -C /home/chimn/madgrades add web/src/lib/time.ts web/src/lib/time.test.ts web/package.json
git -C /home/chimn/madgrades commit -m "feat: add formatRelativeTime utility"
```

---

### Task 2: `getLastRefreshedAt` in `course-data.ts`

**Files:**
- Modify: `web/src/lib/course-data.ts` (add `getLastRefreshedAt` at the bottom)
- Create: `web/src/lib/course-data-refresh.test.ts`

- [ ] **Step 1: Write failing tests in `web/src/lib/course-data-refresh.test.ts`**

```typescript
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { __resetDbsForTests } from "./db.js";
import { getLastRefreshedAt } from "./course-data.js";

let tmpDbPath = "";
const originalSupabaseDatabaseUrl = process.env.SUPABASE_DATABASE_URL;

function setupTmpDb(rows: Array<{ snapshot_run_at: string; last_refreshed_at: string }>) {
  tmpDbPath = path.join(os.tmpdir(), `test-refresh-runs-${Date.now()}.sqlite`);
  const db = new Database(tmpDbPath);
  db.exec(`
    CREATE TABLE refresh_runs (
      refresh_id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_run_at TEXT NOT NULL,
      last_refreshed_at TEXT NOT NULL,
      source_term_code TEXT NOT NULL,
      snapshot_kind TEXT NOT NULL
    )
  `);
  const stmt = db.prepare(
    `INSERT INTO refresh_runs (snapshot_run_at, last_refreshed_at, source_term_code, snapshot_kind)
     VALUES (?, ?, '1272', 'fall-2026-enrollment-packages')`
  );
  for (const row of rows) {
    stmt.run(row.snapshot_run_at, row.last_refreshed_at);
  }
  db.close();

  delete process.env.SUPABASE_DATABASE_URL;
  process.env.TURSO_COURSE_DATABASE_URL = `file:${tmpDbPath}`;
  process.env.MADGRADES_COURSE_REPLICA_PATH = tmpDbPath;
  __resetDbsForTests();
}

afterEach(() => {
  __resetDbsForTests();
  if (originalSupabaseDatabaseUrl !== undefined) {
    process.env.SUPABASE_DATABASE_URL = originalSupabaseDatabaseUrl;
  } else {
    delete process.env.SUPABASE_DATABASE_URL;
  }
  if (tmpDbPath) {
    fs.rmSync(tmpDbPath, { force: true });
    tmpDbPath = "";
  }
});

test("getLastRefreshedAt returns the most recent last_refreshed_at as a Date", async () => {
  setupTmpDb([
    { snapshot_run_at: "2026-04-18T10:00:00.000Z", last_refreshed_at: "2026-04-18T10:05:00.000Z" },
    { snapshot_run_at: "2026-04-19T23:48:26.379Z", last_refreshed_at: "2026-04-20T00:03:28.449Z" },
  ]);
  const result = await getLastRefreshedAt();
  assert.ok(result instanceof Date);
  assert.equal(result.toISOString(), "2026-04-20T00:03:28.449Z");
});

test("getLastRefreshedAt returns null when refresh_runs is empty", async () => {
  setupTmpDb([]);
  const result = await getLastRefreshedAt();
  assert.equal(result, null);
});
```

- [ ] **Step 2: Run the tests to verify they fail (function not exported)**

```bash
cd /home/chimn/madgrades/web && npx tsx --test src/lib/course-data-refresh.test.ts 2>&1
```

Expected: error like `getLastRefreshedAt is not a function` or import error.

- [ ] **Step 3: Add `getLastRefreshedAt` to the bottom of `web/src/lib/course-data.ts`**

Append after the last function in the file:

```typescript
export async function getLastRefreshedAt(): Promise<Date | null> {
  try {
    const rows = await allCourseRowsRuntime(
      "SELECT last_refreshed_at FROM refresh_runs ORDER BY refresh_id DESC LIMIT 1"
    );
    const row = rows[0];
    if (!row || typeof row.last_refreshed_at !== "string") return null;
    const date = new Date(row.last_refreshed_at);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /home/chimn/madgrades/web && npx tsx --test src/lib/course-data-refresh.test.ts 2>&1
```

Expected: 2 passing tests, 0 failures.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
cd /home/chimn/madgrades/web && pnpm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git -C /home/chimn/madgrades add web/src/lib/course-data.ts web/src/lib/course-data-refresh.test.ts
git -C /home/chimn/madgrades commit -m "feat: add getLastRefreshedAt to course-data"
```

---

### Task 3: Update `Navbar` to show the indicator

**Files:**
- Modify: `web/src/app/components/Navbar.tsx`

- [ ] **Step 1: Replace the contents of `web/src/app/components/Navbar.tsx`**

```tsx
import Link from "next/link";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";
import { getLastRefreshedAt } from "@/lib/course-data";
import { formatRelativeTime } from "@/lib/time";

export async function Navbar() {
  const lastRefreshedAt = await getLastRefreshedAt();
  const updatedText = lastRefreshedAt ? formatRelativeTime(lastRefreshedAt) : null;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-3 sm:flex-nowrap sm:px-10 sm:py-0">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue" />
          <span className="font-semibold text-navy">Badger Courses</span>
        </Link>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-1">
          <NavLinks />
          {updatedText && (
            <span className="hidden text-xs text-text-faint sm:block">{updatedText}</span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /home/chimn/madgrades/web && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Start the dev server and verify the indicator appears**

```bash
cd /home/chimn/madgrades/web && pnpm dev 2>&1 &
```

Open `http://localhost:3000` and confirm:
- "Updated N hours ago" text is visible in the navbar on desktop (≥ sm breakpoint), between the nav links and the theme toggle
- Text is hidden on mobile (below sm breakpoint)
- No console errors

- [ ] **Step 4: Commit**

```bash
git -C /home/chimn/madgrades add web/src/app/components/Navbar.tsx
git -C /home/chimn/madgrades commit -m "feat: show last-updated indicator in navbar"
```
