# Schedule Builder Modular Preference Ranking Design

## Goal

Let schedule-builder users define the priority order used to rank generated schedules, so the backend returns results in a way that reflects the user's preferences rather than a single fixed ranking strategy.

## Current State

- `/schedule-builder` currently stores courses, locked sections, excluded sections, and result limit in URL-backed state.
- `ScheduleBuilder.tsx` automatically regenerates schedules when builder inputs change.
- `POST /api/schedules` currently accepts `courses`, `lock_packages`, `exclude_packages`, and `limit`.
- `src/schedule/engine.mjs` currently uses a fixed `compareSchedules` function to rank schedules.
- The engine already performs ranking during generation because `buildSchedules` trims the in-progress result set to the top `limit` schedules using that comparator.
- The current fixed ranking order is effectively:
  - fewer campus days
  - later starts
  - fewer long gaps
  - fewer tight transitions
  - shorter walking distance
  - more open seats
  - earlier finishes

## Product Direction

The first version should make schedule ranking modular and user-driven without redesigning the full generation algorithm.

Chosen product constraints:

- ranking should affect backend generation, not just card ordering in the browser
- the first version should expose exactly 4 rankable rules
- users should always rank all 4 rules; no per-rule enable or disable state in v1
- the preference order should live in the URL with the rest of the builder inputs
- the initial default order should be:
  - later starts
  - fewer campus days
  - fewer long gaps
  - earlier finishes
- the system should be designed so more ranking rules can be added later without redesigning the state model or API contract

## Target User Experience

When a user opens `/schedule-builder`:

1. The page restores the schedule priority order from the URL, or uses the default order if none is present.
2. The left-side settings area shows a `Schedule priorities` control with the 4 rules in order.
3. The user can reorder the rules using explicit `Move up` and `Move down` controls.
4. Changing the order automatically regenerates schedules.
5. The results list reflects the updated priority order.
6. When result limits are small, changing the order can change which schedules appear at all, not just their visible sort order.

This should feel like a natural extension of the current builder rather than a separate advanced mode.

## Chosen Design

The backend ranking comparator should become configurable through an ordered list of stable rule IDs supplied by the schedule builder.

The builder, API route, and engine should all treat preference order as an ordered array of rule identifiers rather than labels. Labels remain a UI concern.

For v1, the supported rule IDs are:

- `later-starts`
- `fewer-campus-days`
- `fewer-long-gaps`
- `earlier-finishes`

The default order is:

1. `later-starts`
2. `fewer-campus-days`
3. `fewer-long-gaps`
4. `earlier-finishes`

The backend engine should normalize any incoming order against the supported rule registry and then apply those rules in order before any remaining fixed tie-breakers.

## Architecture

### Builder State

Add URL-backed preference ordering to `web/src/app/schedule-builder/builder-state.ts`.

Required changes:

- extend `ScheduleBuilderState` with `preferenceOrder: string[]`
- parse the ordered rule IDs from the URL
- serialize the normalized order back into the URL
- include the normalized order in `buildScheduleRequestPayload`
- include it in `buildScheduleRequestSignature` so regeneration happens when priorities change

The builder state layer should own normalization of malformed URL values so shared links remain resilient.

### Builder UI

Keep the UI localized to the existing settings area in `ScheduleBuilder.tsx`.

Implementation shape:

- add a `Schedule priorities` card near the existing result-limit control
- render the 4 rules as an ordered list with visible rank numbers
- use explicit `Move up` and `Move down` buttons for reordering
- include one short explanation that schedules are generated using this top-to-bottom order

This avoids introducing drag-and-drop as a dependency or accessibility problem in the first version while still preserving the mental model of ranked priorities.

### API Contract

Extend `POST /api/schedules` to accept:

- `preference_order?: string[]`

The route should normalize this field before calling the engine. The API should not expose user-facing labels.

### Schedule Engine

Refactor `src/schedule/engine.mjs` so schedule ranking comes from a rule registry instead of one hard-coded comparison order.

Recommended implementation shape:

- define a small ranking rule registry with stable rule IDs and comparison functions
- add a helper that normalizes requested rule order against that registry
- add a helper that compares schedules using the normalized ordered rules
- keep a deterministic fallback tie-break sequence after user-configured rules

The engine should still:

- enumerate valid conflict-free schedules the same way it does today
- keep `lockPackages` and `excludePackages` as hard constraints
- trim to the top `limit` schedules during generation

This makes generation preference-aware without redesigning conflict detection or branch traversal.

## Component Responsibilities

- `builder-state.ts`
  - parse, normalize, serialize, and request-encode preference order
- `ScheduleBuilder.tsx`
  - render controls and trigger regeneration when order changes
- schedule-builder UI component
  - display and reorder the list of priorities
- `web/src/app/api/schedules/route.ts`
  - validate and normalize incoming preference order
- `src/schedule/engine.mjs`
  - interpret normalized rule IDs and rank schedules accordingly

This keeps the feature aligned with the current separation of concerns.

## Data Flow

1. `/schedule-builder` loads and parses the URL.
2. Builder state normalizes the ordered preference rule IDs.
3. The settings UI renders the normalized order.
4. When the user changes the order, the builder updates the URL.
5. The schedule request signature changes.
6. The existing debounced generation effect posts the updated payload to `/api/schedules`.
7. The API normalizes `preference_order` and passes it to the engine.
8. The engine applies that order while ranking and trimming schedules.
9. The response returns schedules already ordered according to the user's priorities.
10. The results cards and selected calendar update from the new ranked result set.

## Ranking Semantics

For v1, the configured rule order should apply only to the 4 exposed rules.

Each rule should map to the existing schedule metrics already produced by the engine:

- `later-starts`
  - prefer higher `earliest_start_minute_local`
- `fewer-campus-days`
  - prefer lower `campus_day_count`
- `fewer-long-gaps`
  - prefer lower `large_idle_gap_count`
- `earlier-finishes`
  - prefer lower `latest_end_minute_local`

After the engine applies those user-configured rules, it should continue with fixed deterministic tie-breakers so results remain stable.

For v1, the fixed tie-break tail should remain:

- fewer tight transitions
- shorter walking distance
- more open seats
- package ID ordering as the final deterministic tie-breaker

This preserves useful secondary ranking behavior without making the v1 UI broader than necessary.

## Error Handling And Fallbacks

Preference-order input should be resilient rather than brittle.

### Builder Normalization

- unknown rule IDs are ignored
- duplicate rule IDs collapse to one instance
- missing supported rules are appended in default order
- an entirely invalid URL falls back to the default order

### API Normalization

- missing `preference_order` uses the default order
- invalid arrays normalize to the supported rule set instead of failing the whole request
- the route should still reject non-array non-string input if it does not match the request shape, consistent with existing API validation

### Engine Fallback

- omitted or invalid preference order uses the default order
- if normalization somehow produces an empty list, use the default order
- locks and exclusions continue to behave exactly as hard constraints, independent of ranking preferences

This three-layer fallback approach is intentional because preference order is URL-backed, shareable state.

## Scope Boundaries

This design does not include:

- a drag-and-drop interaction requirement for v1
- per-rule toggles or disabled states
- exposing additional rules like walking distance or open seats in the first release
- changing conflict detection or candidate enumeration
- adding weighted scoring or numeric sliders
- explaining per-schedule score breakdowns in the results UI
- redesigning the schedule cards or calendar beyond using the updated backend ranking

## Testing Strategy

### Builder State Coverage

- parse and serialize preference order in the URL
- normalize duplicates, unknown IDs, and missing IDs into a complete valid order
- include `preference_order` in request payload generation
- ensure request signatures change when order changes

### API Coverage

- accept valid `preference_order` arrays
- normalize omitted or malformed order values to the default order
- preserve existing request validation behavior for unrelated fields

### Engine Coverage

- default order is used when preferences are omitted
- different preference orders produce different ranking outcomes for the same valid schedule set
- with `limit = 1`, changing preference order can change which schedule survives top-limit trimming
- fixed tie-breakers still provide deterministic ordering when user-configured rules tie

### Builder And Component Coverage

- the schedule priorities UI renders the default order
- reordering updates URL-backed state
- reordering triggers regeneration through the existing debounced request flow
- the rest of the builder behavior remains unchanged

## Success Criteria

This design is successful when all of the following are true:

1. Users can reorder 4 schedule-priority rules from the builder UI.
2. The selected order is saved in the URL and restored on reload.
3. The schedule API accepts and normalizes ordered ranking preferences.
4. The backend engine uses the requested order to rank schedules during generation.
5. With small result limits, changing the priority order can change which schedules are returned.
6. The implementation remains modular so more ranking rules can be added later without redesigning the feature.
