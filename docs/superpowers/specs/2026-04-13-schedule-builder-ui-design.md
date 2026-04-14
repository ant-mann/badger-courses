# Schedule Builder UI Design

## Goal

Build the first interactive browser UI for schedule generation on top of the existing `POST /api/schedules` route so users can create, refine, and compare Fall 2026 schedules without leaving the web app.

## Current State

- The deployed web app already has:
  - a server-rendered course search page at `/`
  - course detail pages at `/courses/[designation]`
  - `GET /api/courses/search`
  - `GET /api/courses/[designation]`
  - `POST /api/schedules`
- The deferred item in `docs/superpowers/plans/2026-04-13-nextjs-web-deployment.md` is an interactive schedule-builder UI.
- The existing schedule API accepts:
  - `courses`
  - `lock_packages`
  - `exclude_packages`
  - `limit`
- The current course detail page already exposes schedule candidate data as `schedulePackages`, which is enough to drive a first UI for locking and excluding generated schedule inputs.
- The existing web app favors:
  - direct server-side DB access in server components
  - small focused client components where interactivity is needed
  - URL-backed search state
  - simple card-based layouts with Tailwind utility classes

## Product Direction

This first version should optimize for usability rather than minimum implementation effort or power-user depth.

Chosen product constraints:

- entry point: dedicated page
- results review: both ranked cards and calendar view in v1
- builder controls: users can lock and exclude section combinations before generation
- persistence: full builder input state should live in the URL
- terminology: user-facing copy should use `section` language, not `package`

Generated schedules themselves should not be encoded into the URL.

## User Experience

### Main Flow

1. The user opens `/schedule-builder`.
2. The page restores builder inputs from the URL if present.
3. The user searches for and adds courses, up to the backend limit of `8`.
4. For each added course, the UI shows available section combinations that can be:
   - left unconstrained
   - locked
   - excluded
5. The builder generates schedules from the current normalized inputs.
6. The results area shows ranked schedule cards and a calendar view for the selected result.
7. The user refines constraints and immediately sees updated results without losing context.

### Page Layout

Use a dedicated two-pane schedule-builder page.

- Left pane: builder inputs
  - course search and add flow
  - selected course chips or rows
  - per-course section-combination controls
  - result-limit control
  - generation status or action affordance
- Right pane: generated results
  - count and status summary
  - cards/calendar view toggle
  - ranked schedule cards
  - full weekly calendar for the currently selected result

This layout is the recommended compromise between usability and scope:

- inputs remain visible while reviewing results
- the user can compare schedules without losing the active constraints
- the cards/calendar split fits the current visual language better than a multi-step wizard

### Mobile Behavior

The page should collapse from two panes into a single vertical flow on smaller screens.

- Inputs render first.
- Results render below the controls.
- The selected schedule calendar remains available below the results list.
- View toggles and control labels should stay large enough for touch interaction.

The mobile version should preserve the same information model rather than becoming a separate wizard.

## Terminology

The backend and current data helpers use `package` identifiers, but the browser UI should not expose that term.

User-facing copy should prefer:

- `section options`
- `section combination`
- `locked sections`
- `excluded sections`

The UI still needs to carry the underlying `sourcePackageId` values through to `lock_packages` and `exclude_packages` when calling the schedule API.

The safest wording for v1 is `section combination` when a choice includes multiple linked meetings such as lecture plus discussion or lab. If a card already makes the grouping obvious, shorter `section` wording is acceptable in headings and status text.

## Architecture

### Route Structure

Add a dedicated route:

- `web/src/app/schedule-builder/page.tsx`

This page should render a client-side builder shell that handles URL synchronization, incremental fetching, and interactive results.

### Component Shape

Keep the implementation small and aligned with the existing app structure.

Recommended components:

- `ScheduleBuilder`
  - client shell for input state, URL sync, API calls, and result selection
- `CoursePicker`
  - interactive search and add flow using course search data
- `SelectedCourseList`
  - summary rows for currently selected courses
- `SectionOptionPanel`
  - per-course lock/exclude controls using course detail schedule candidates
- `ScheduleResults`
  - result count, empty/error states, view toggle, and selection state
- `ScheduleResultCard`
  - one ranked schedule summary
- `ScheduleCalendar`
  - weekly calendar for the selected result across all applicable meeting days

These can be separate files or collapsed where appropriate. The main requirement is to keep responsibilities clear and avoid building a monolithic client file that mixes search, constraints, and rendering logic.

### Data Sources

Use the existing surfaces wherever possible.

- Course search suggestions can come from `GET /api/courses/search`.
- Per-course section-combination controls can be derived from existing course detail data, likely via `GET /api/courses/[designation]` or a shared helper-backed server payload if that reduces repeated client fetches.
- Generated schedules should come from `POST /api/schedules`.

The builder should not invent a parallel schedule data model. It should adapt from the existing API response and helper types with the minimum transformation needed for rendering.

## State Model

The URL should be the source of truth for builder inputs.

Persist these inputs in the URL:

- selected courses
- locked section-combination IDs
- excluded section-combination IDs
- result limit
- active results view

Do not persist these in the URL:

- generated schedules
- request status
- selected result card index
- transient error banners

The builder shell should parse URL state on load, normalize it, and then derive API request payloads from that normalized state.

## Data Flow

1. `/schedule-builder` loads and parses current URL params.
2. The builder shell normalizes selected courses, locked IDs, excluded IDs, limit, and the current results view.
3. The UI loads any supporting course data needed to render existing constraints.
4. As the user types in the course picker, the client requests course suggestions.
5. When the user adds or removes a course, or changes lock/exclude state, the builder updates URL-backed input state.
6. The builder sends the normalized input payload to `POST /api/schedules`.
7. The response populates ranked result cards.
8. The selected result drives the weekly calendar rendering.
9. When the user picks a different result card, only the selected-result UI changes; the URL and generated result set do not need to change.

## Interaction Model

Generation should be automatic on meaningful builder input changes, using lightweight debouncing so the page does not fire a request on every keystroke.

The UX contract is:

- users always understand what inputs are active
- users never lose their current constraints after generation
- results refresh predictably when constraints change
- the UI shows a clear loading state while a new result set is in flight

Typing inside the course search box should not trigger schedule generation by itself. Generation should happen after a course is added or removed, or after lock/exclude/limit/view state changes in a way that affects the active builder state.

## Schedule Results

### Ranked Cards

The cards view should be the primary scannable surface.

Each result card should show at least:

- rank or stable ordering
- chosen section combination for each course
- useful schedule summary metadata already implied by the generator output, such as campus days or other available ranking signals
- clear selection state

### Calendar View

The calendar should render the currently selected generated schedule across all applicable weekdays and meeting times.

Requirements:

- show every meeting in the selected result, not a sample subset
- place repeated meetings on each matching weekday
- handle schedules that do not use all weekdays cleanly
- remain readable when courses use multiple meetings in one week

The cards and calendar should work together rather than as separate result modes. The card list supports comparison, and the calendar helps verify the spatial weekly shape of the selected option.

## Error Handling And Constraints

The UI should enforce existing backend constraints before the request reaches the server where possible.

### Builder Validation

- block duplicate courses
- block blank or invalid additions
- enforce the `8`-course maximum
- enforce the `50`-result maximum
- preserve normalized designation formatting internally

### Empty And Error States

- If a course has no available section combinations, show a clear message in that course's control area.
- If generation returns no schedules, explain that no conflict-free schedules match the selected courses and locked/excluded sections.
- Encourage the user to relax constraints rather than leaving the page blank.
- If the API returns validation or server errors, keep all current builder inputs intact and show a retryable error banner.
- If supporting course data fails to load for one selected course, show a local error state for that course instead of collapsing the full builder.

## Testing Strategy

Testing should focus on correctness of state handling and clarity of the interactive flow.

### UI And State Tests

- URL parsing and serialization for courses, locked IDs, excluded IDs, limit, and view
- add/remove course flows
- duplicate and max-course validation
- lock/exclude state transitions
- API payload generation from normalized builder state
- result selection behavior

### Rendering Tests

- empty state before generation
- no-results state after generation
- retryable API error state
- section-combination rendering for one course and multiple courses
- calendar rendering across all applicable weekdays for a selected schedule

### Integration Coverage

- one browser-level or component-level smoke test for the primary workflow if the web app test setup supports it
- confirm that refreshing the page restores builder inputs from the URL
- confirm that generated results are not required in the URL for reload behavior

## Non-Goals For V1

Keep the first version focused.

- no saved schedules
- no schedule comparison workspace beyond current cards plus selected calendar
- no calendar export or print formatting
- no new backend persistence model
- no redesign of the schedule API contract unless implementation reveals a concrete gap

## Success Criteria

- A user can open `/schedule-builder` and build schedules without leaving the browser.
- A user can add courses, lock or exclude section combinations, and generate updated results.
- A user can compare results in cards and inspect the selected option in a full weekly calendar.
- Reloading the page preserves builder inputs through the URL.
- The UI uses section-oriented terminology even though the API still uses package IDs internally.
- The implementation fits the existing Next.js app structure without introducing unnecessary parallel abstractions.
