# Madgrades Import Progress Design

## Goal

Make `scripts/import-madgrades.mjs --refresh-api` feel continuously alive during long runs by adding more forward progress indicators without changing the final machine-readable JSON output.

## Constraints

- Progress output stays on `stderr`.
- Final JSON result stays on `stdout`.
- Keep messages concise and monotonic.
- Do not add noisy per-item logs.
- Prefer small changes in existing importer code paths.

## Recommended Approach

Use richer phase-level progress plus counts for long-running steps.

This adds visibility in three places:

1. Before each meaningful phase starts.
2. When counts are known for a phase.
3. During long loops using periodic progress updates.

## Progress Coverage

Add or refine progress messages for:

- loading local courses and instructors
- fetching remote course and instructor indexes
- normalizing fetched indexes for matching
- matching local courses and instructors
- deduping matched course and instructor targets
- fetching matched course data
- fetching matched instructor data
- normalizing matched course payloads
- normalizing matched instructor payloads
- assembling snapshot row groups with counts
- writing snapshot files
- importing snapshot into SQLite

## Message Shape

Prefer messages like:

- `Loaded 4872 local courses and 3011 local instructors.`
- `Fetched Madgrades indexes: 18234 courses, 9754 instructors.`
- `Matching local records against Madgrades indexes...`
- `Matched 3080 courses and 2975 instructors.`
- `Deduped to 3080 unique course fetches and 2975 unique instructor fetches.`
- `Normalizing 3080 matched courses...`
- `Normalized courses (100/3080)...`
- `Prepared snapshot rows: 3080 courses, 3080 course grades, 2975 instructors, 2975 instructor grades.`
- `Importing snapshot into SQLite...`
- `Madgrades import complete.`

## Implementation Notes

- Reuse the existing progress reporter pattern for normalization loops, not just fetch loops.
- Add a small helper for count summaries if it keeps messages consistent.
- Only add DB import sub-phase messages if they can be emitted without invasive refactoring of the table replacement helper.
- If `replaceMadgradesTables()` is currently too opaque for granular progress, emit a pre-import row summary before calling it instead of forcing a larger refactor.

## Error Handling

- Do not swallow errors.
- Keep existing error behavior unchanged.
- Progress output may stop at the failing phase naturally.

## Testing

Update CLI progress-output tests to assert a few of the new messages while keeping them resilient to exact counts where appropriate.

## Out Of Scope

- terminal spinners
- ANSI progress bars
- per-request timing breakdowns
- changing JSON output structure
- background refresh behavior
