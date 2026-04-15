# Schedule Builder Fixed-Week Calendar Design

## Goal

Keep the schedule-builder calendar layout stable by always rendering a full seven-day week, even when the selected schedule only uses a subset of weekdays.

## Current State

- `web/src/app/components/ScheduleCalendar.tsx` renders a weekly grid for the selected generated schedule.
- The current calendar uses `getVisibleWeekdays` from `web/src/app/schedule-builder/schedule-data.ts` and then filters that list down to weekdays that actually appear in the selected schedule entries.
- Existing component coverage in `web/src/app/schedule-builder/components.test.tsx` explicitly asserts that weekday-only schedules omit unused columns.
- This means the calendar width and weekday columns shift when a user changes the selected schedule or adds sections that introduce new meeting days.

## Target User Experience

When a user reviews generated schedules on `/schedule-builder`:

1. The calendar always shows `Mon` through `Sun` in a fixed order.
2. Unused days remain visible as empty columns instead of disappearing.
3. Adding, removing, or switching schedules does not cause the weekly grid to reflow horizontally.
4. Existing empty states remain unchanged when there is no selected schedule or when the selected schedule has no calendar meetings.

## Chosen Design

The shared `ScheduleCalendar` component should always render all seven weekday columns whenever it is showing a schedule with calendar entries.

The fixed weekday order is:

- `M`
- `T`
- `W`
- `R`
- `F`
- `S`
- `U`

Days without meetings should render as normal empty lanes with the same background, borders, and time grid lines as populated days. Meeting cards should continue to render only in the lanes that have matching entries.

## Architecture

This change should stay localized to the existing schedule calendar rendering path.

Implementation shape:

- keep `ScheduleCalendar` as the rendering component
- stop deriving rendered columns from the selected entries
- use a fixed seven-day ordered list for the calendar headers and day lanes
- leave meeting-entry derivation, time-window calculation, and event placement logic unchanged

This is intentionally a display-layer change, not a schedule-data-model redesign.

## Rendering Behavior

### Selected Schedule With Entries

When `schedule` is present and `entries.length > 0`:

- render all seven weekday headers
- render seven day columns in the same order as the headers
- continue filtering meeting cards per weekday within each column
- preserve the current time-axis labels and hourly grid lines

### Empty States

Do not change the current two empty states:

- when no schedule is selected, keep the existing prompt to select a generated schedule
- when a schedule is selected but no calendar meetings are available, keep the existing no-meetings message

## Error Handling And Fallbacks

- If a weekday has no entries, render an empty column rather than omitting it.
- If a schedule has weekend meetings, they continue to render in `Sat` and `Sun`, but those columns are now always present.
- If a schedule has only weekday meetings, `Sat` and `Sun` remain visible and empty.
- If a schedule has no entries at all, continue using the existing empty-state path instead of rendering an empty seven-column grid.

## Testing Strategy

Update the existing `ScheduleCalendar` coverage in `web/src/app/schedule-builder/components.test.tsx`.

Required coverage:

- a weekday-only schedule still renders `Mon` through `Sun`
- `Sat` and `Sun` headers are present even when they have no meetings
- the old expectation that unused weekdays are omitted is removed
- the existing empty-state coverage remains intact
- the existing equal-duration meeting height coverage remains intact

The tests should pin this as a fixed-week layout change only, without broadening scope into unrelated schedule-builder behavior.

## Scope Boundaries

This design does not include:

- adding a user toggle between adaptive and fixed week layouts
- changing schedule generation or meeting parsing
- changing calendar time-range behavior
- redesigning the schedule-builder page layout outside the weekly calendar
- introducing different behavior for cards view versus calendar view

## Success Criteria

This design is successful when all of the following are true:

1. The selected schedule calendar always shows `Mon` through `Sun`.
2. Empty days remain visible as stable columns.
3. Adding or switching schedules no longer changes the weekday column count.
4. Existing empty states still render correctly.
5. The implementation stays localized to the calendar display path and its tests.
