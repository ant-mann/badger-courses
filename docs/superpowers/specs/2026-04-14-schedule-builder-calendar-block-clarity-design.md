# Schedule Builder Calendar Block Clarity Design

## Goal

Make each calendar meeting block clearly identify what type of meeting it is (lecture, lab, discussion) and always show its time, even for short 50-minute sessions where vertical space is limited.

## Current State

`web/src/app/components/ScheduleCalendar.tsx` renders each meeting block with four lines in this order:

1. Course designation (`COMP SCI 577`)
2. Section bundle label (`LEC 001 + DIS 301`)
3. Time range (`9:00–9:50 AM`)
4. Location (`Science Hall`)

The block uses `overflow-hidden`, so short meetings (≈50 min) only show 1–2 lines before clipping. In practice only the course designation is visible for short blocks. The `entry.meetingType` field is available in `ScheduleCalendarEntry` but is never rendered anywhere, so users cannot distinguish a lecture block from a discussion block that share the same course and day.

## Target User Experience

When a user views the selected schedule calendar:

1. Every meeting block shows the course name and meeting type together on the first line, with an abbreviated type badge (`LEC`, `LAB`, `DIS`) floated to the right.
2. The time range appears on the second line, always visible regardless of block height.
3. For taller blocks (longer meetings), the section bundle label and location continue to appear below the time, in their current order.
4. When no meeting type is available, the badge is omitted and the course name spans the full row.

## Chosen Design

### Block content priority

| Priority | Content | Always visible |
|---|---|---|
| 1 | Course designation + type badge | Yes |
| 2 | Time range | Yes |
| 3 | Section bundle label | Only in taller blocks |
| 4 | Location | Only in taller blocks |

### Layout of line 1

The first line uses a flex row with the course name (`font-semibold`, `truncate`) on the left and the type badge on the right. The course name truncates with ellipsis if space is tight — the badge stays visible.

### Meeting type mapping

`entry.meetingType` (from the database) maps to badge labels as follows:

| Raw value | Badge |
|---|---|
| `"CLASS"` | `LEC` |
| `"LAB"` | `LAB` |
| `"DIS"` | `DIS` |
| `null` | *(no badge)* |
| anything else | show raw value as-is |

The `"CLASS"` → `LEC` mapping keeps the badge consistent with the section bundle label format already used on the page (`LEC 001 + DIS 301`).

## Architecture

This change is confined to a single component.

- **`web/src/app/components/ScheduleCalendar.tsx`** — reorder the block content; add type badge logic to the meeting block render path
- No changes to `schedule-data.ts`, the data model, or any other component

## Rendering Behavior

### Block with a known meeting type

```
┌─────────────────────────────────┐
│ COMP SCI 577           [LEC]    │
│ 9:00–9:50 AM                    │
│ LEC 001 + DIS 301      ← taller │
│ Science Hall           ← taller │
└─────────────────────────────────┘
```

### Block with no meeting type

```
┌─────────────────────────────────┐
│ COMP SCI 577                    │
│ 9:00–9:50 AM                    │
│ LEC 001 + DIS 301      ← taller │
│ Science Hall           ← taller │
└─────────────────────────────────┘
```

## Error Handling and Fallbacks

- If `entry.meetingType` is `null`, render no badge; the course name fills the full row width.
- If `entry.meetingType` is an unrecognised value, render the raw value as the badge label.
- The `overflow-hidden` clipping on short blocks remains; the new ordering ensures time is visible before the content clips.

## Testing Strategy

Update `web/src/app/schedule-builder/components.test.tsx`.

Required coverage:

- A meeting block with `meetingType: "CLASS"` renders an `LEC` badge.
- A meeting block with `meetingType: "LAB"` renders a `LAB` badge.
- A meeting block with `meetingType: "DIS"` renders a `DIS` badge.
- A meeting block with `meetingType: null` renders no badge.
- The time range (`startMinutes`/`endMinutes`) appears before the section bundle label in the rendered markup.

## Scope Boundaries

This design does not include:

- Changing the meeting type badge for cards view vs. calendar view (no cards-specific logic)
- Adding tooltips or hover states
- Color-coding meeting types
- Changing the time formatting logic
- Modifying any other component outside `ScheduleCalendar.tsx`

## Success Criteria

1. Every calendar block shows an abbreviated meeting type badge when `meetingType` is known.
2. The time range is always the second visible line, before section bundle and location.
3. Short 50-minute blocks show at minimum: course name, type badge, and time.
4. Blocks with no meeting type render gracefully without a badge.
5. All new test cases pass.
