# Schedule Builder Padded Time Window Design

## Goal

Make the schedule-builder calendar use a stable `9:00 AM` to `5:00 PM` default time range while automatically expanding with one extra hour of padding when a selected schedule has classes outside that window.

## Current State

- `web/src/app/components/ScheduleCalendar.tsx` currently derives its time window directly from the earliest start and latest end in the selected schedule entries.
- The current `deriveTimeWindow` helper rounds the earliest start down to the previous hour and the latest end up to the next hour.
- This means the calendar auto-zooms vertically to each selected schedule.
- After the recent fixed-week change, the weekday columns are stable, but the vertical time range still shifts whenever early or late classes appear.

## Target User Experience

When a user reviews generated schedules on `/schedule-builder`:

1. A typical daytime schedule uses a stable `9:00 AM` to `5:00 PM` calendar window.
2. A schedule with early classes expands upward only when needed.
3. A schedule with late classes expands downward only when needed.
4. When expansion happens, the overflowing side includes one extra hour of breathing room so meetings are not pressed against the edge.
5. Existing empty states and meeting placement remain unchanged.

## Chosen Design

The calendar should start from a fixed baseline time window:

- start: `9:00 AM`
- end: `5:00 PM`

If the selected schedule contains a meeting that starts before `9:00 AM`, the calendar should expand upward by:

1. rounding the earliest meeting start down to the previous full hour
2. subtracting one additional hour of padding from that rounded value

If the selected schedule contains a meeting that ends after `5:00 PM`, the calendar should expand downward by:

1. rounding the latest meeting end up to the next full hour
2. adding one additional hour of padding to that rounded value

If both conditions are true, the start and end should expand independently.

## Examples

- A schedule whose meetings all fall between `9:00 AM` and `5:00 PM` renders exactly `9:00 AM` through `5:00 PM`.
- A schedule with an earliest class at `8:30 AM` renders from `7:00 AM` through `5:00 PM`.
- A schedule with a latest class ending at `6:20 PM` renders from `9:00 AM` through `8:00 PM`.
- A schedule with an earliest class at `7:10 AM` and a latest class ending at `8:40 PM` renders from `6:00 AM` through `10:00 PM`.

## Architecture

This change should stay localized to the existing calendar display logic.

Implementation shape:

- keep `ScheduleCalendar` as the rendering component
- keep the fixed seven-day weekday rendering already in place
- update `deriveTimeWindow` so it starts from the fixed `9:00 AM` to `5:00 PM` baseline instead of tightly fitting the meetings
- keep `buildTimeLabels`, `getOffsetPercent`, and event placement logic unchanged

This is intentionally a time-window rule change, not a layout redesign.

## Rendering Behavior

### Baseline Daytime Schedules

When all meetings are inside the baseline window:

- the first visible time label is `9:00 AM`
- the last visible time label is `5:00 PM`
- the calendar height reflects that fixed eight-hour range

### Early And Late Schedule Expansion

When meetings overflow the baseline window:

- expansion happens only on the side that overflowed
- the overflowing side rounds outward to a full hour before padding is added
- the extra padding is exactly one hour on each overflowing side
- meeting cards continue using the existing offset and height calculations relative to the resulting expanded window

## Error Handling And Fallbacks

- If there is no selected schedule, keep the existing selection prompt.
- If a selected schedule has no calendar meetings, keep the existing no-meetings message.
- If all meetings are inside the baseline window, do not add any extra padding.
- If only the early side overflows, expand only the start time.
- If only the late side overflows, expand only the end time.

## Testing Strategy

Update the existing calendar coverage in `web/src/app/schedule-builder/components.test.tsx`.

Required coverage:

- a daytime-only schedule renders `9:00 AM` through `5:00 PM`
- an early meeting expands the start time by rounding outward and adding one extra hour of padding
- a late meeting expands the end time by rounding outward and adding one extra hour of padding
- a schedule with both early and late overflow expands both sides independently
- the existing empty-state coverage remains intact
- the existing equal-duration meeting height coverage remains intact

## Scope Boundaries

This design does not include:

- adding a user control for choosing the visible time range
- changing the fixed seven-day weekday behavior
- changing how meetings are grouped or rendered inside each day column
- changing card view summaries or schedule ranking logic
- redesigning the surrounding schedule-builder layout

## Success Criteria

This design is successful when all of the following are true:

1. The calendar shows `9:00 AM` through `5:00 PM` for normal daytime schedules.
2. Early and late classes remain visible without being crowded against the top or bottom edge.
3. Expansion happens only when needed and only on the overflowing side.
4. Existing empty-state behavior remains unchanged.
5. The implementation stays localized to the calendar time-window logic and its tests.
