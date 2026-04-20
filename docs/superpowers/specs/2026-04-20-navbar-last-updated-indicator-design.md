# Navbar Last-Updated Indicator — Design Spec

**Date:** 2026-04-20

## Overview

Add a small "Updated N hours ago" text indicator to the navbar that tells users how fresh the course/enrollment data is.

## Data Source

The `refresh_runs` table in the SQLite database has a `last_refreshed_at` column (ISO 8601 UTC string). Query the single most recent row to get the timestamp.

```sql
SELECT last_refreshed_at FROM refresh_runs ORDER BY refresh_id DESC LIMIT 1
```

## Architecture

`Navbar` becomes an `async` server component. It calls a new `getLastRefreshedAt()` helper in `course-data.ts` (or a dedicated `refresh-data.ts` lib file) that queries the database and returns a `Date | null`. The result is passed to a pure `formatRelativeTime(date: Date): string` utility that produces the display string.

No client-side code, no API route, no hydration.

## Relative Time Formatting

| Age | Display |
|---|---|
| < 60 seconds | "Updated just now" |
| < 60 minutes | "Updated N minutes ago" |
| < 24 hours | "Updated N hours ago" |
| ≥ 24 hours | "Updated N days ago" |

Singular/plural handled correctly ("1 minute ago", not "1 minutes ago").

## UI Placement

Inside `Navbar`, between `<NavLinks />` and `<ThemeToggle />`. Styled as small (`text-xs`), faint (`text-text-faint`), and hidden on very small screens if space is tight.

Example navbar right section:
```
[NavLinks]  [Updated 2 hours ago]  [ThemeToggle]
```

## Error Handling

If `getLastRefreshedAt()` throws or returns `null`, the indicator is omitted entirely. No fallback text, no error state — the navbar renders normally without it.

## Files Affected

- `web/src/app/components/Navbar.tsx` — make async, add indicator element
- `web/src/lib/course-data.ts` (or new `web/src/lib/refresh-data.ts`) — add `getLastRefreshedAt()`
- New utility: `formatRelativeTime(date: Date): string` — can live inline or in a small `time.ts` lib file
