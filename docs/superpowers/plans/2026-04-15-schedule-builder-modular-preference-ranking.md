# Schedule Builder Modular Preference Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let schedule-builder users reorder 4 schedule-priority rules, persist that order in the URL, and have the backend use it while choosing the top generated schedules.

**Architecture:** Add a small shared preference-definition module on the web side for URL state, UI labels, and request payloads, then thread a `preference_order` array through `POST /api/schedules` into the schedule engine. Refactor the engine's fixed comparator into an ordered rule registry so the generator still explores the same conflict-free schedules but keeps the top `limit` results according to the user's chosen order.

**Tech Stack:** Next.js 15, React 19, TypeScript, Node test runner, TSX test runner, plain JavaScript schedule engine, pnpm

---

## File Structure

- Create: `web/src/app/schedule-builder/preferences.ts`
  - Defines the 4 supported preference rule IDs, labels, default order, and web-side normalization helper.
- Modify: `web/src/app/schedule-builder/builder-state.ts`
  - Adds URL-backed `preferenceOrder`, request payload support, and a small state helper for moving a rule up or down.
- Modify: `web/src/app/schedule-builder/builder-state.test.ts`
  - Pins URL parsing, serialization, request payload generation, and reorder behavior for schedule priorities.
- Create: `web/src/app/components/SchedulePriorityList.tsx`
  - Renders the priority list card with numbered rows and `Move up` / `Move down` controls.
- Modify: `web/src/app/schedule-builder/ScheduleBuilder.tsx`
  - Renders the new priority card and updates URL-backed state when the user moves a rule.
- Modify: `web/src/app/schedule-builder/components.test.tsx`
  - Verifies the new priority card markup and copy.
- Modify: `web/src/app/api/schedules/route.ts`
  - Accepts `preference_order`, normalizes it, and passes it to the engine.
- Modify: `web/src/app/api/courses/routes.test.ts`
  - Pins API-side normalization and request acceptance for `preference_order`.
- Modify: `src/schedule/engine.mjs`
  - Replaces the fixed ranking order with a preference-driven comparator and engine-side fallback normalization.
- Modify: `tests/schedule-options.test.mjs`
  - Verifies default fallback order, custom order behavior, and `limit = 1` top-schedule trimming.

### Task 1: Add URL-Backed Preference State

**Files:**
- Create: `web/src/app/schedule-builder/preferences.ts`
- Modify: `web/src/app/schedule-builder/builder-state.ts`
- Modify: `web/src/app/schedule-builder/builder-state.test.ts`
- Test: `web/src/app/schedule-builder/builder-state.test.ts`

- [ ] **Step 1: Write the failing builder-state tests**

In `web/src/app/schedule-builder/builder-state.test.ts`, update the import block to add `movePreferenceRule`:

```ts
import {
  buildCourseDetailsRequestSignature,
  buildScheduleRequestPayload,
  buildScheduleRequestSignature,
  movePreferenceRule,
  parseBuilderState,
  removeCourse,
  serializeBuilderState,
  setExcludedSection,
  setLockedSection,
  type ScheduleBuilderState,
} from "./builder-state";
```

Update `makeState` so the default object includes the new preference order:

```ts
function makeState(overrides: Partial<ScheduleBuilderState> = {}): ScheduleBuilderState {
  return {
    courses: ["COMP SCI 577", "MATH 240"],
    lockedSections: [],
    excludedSections: [],
    preferenceOrder: [
      "later-starts",
      "fewer-campus-days",
      "fewer-long-gaps",
      "earlier-finishes",
    ],
    limit: 25,
    ...overrides,
  };
}
```

Update the existing `parseBuilderState normalizes url-backed builder inputs` test setup and expectation to include repeated `priority` params:

```ts
searchParams.append("priority", "fewer-long-gaps");
searchParams.append("priority", "later-starts");
searchParams.append("priority", "later-starts");
searchParams.append("priority", "not-a-rule");

assert.deepEqual(parseBuilderState(searchParams), {
  courses: ["COMP SCI 577", "MATH 240"],
  lockedSections: [{ courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-1" }],
  excludedSections: [
    { courseDesignation: "COMP SCI 577", sourcePackageId: "pkg-2" },
  ],
  preferenceOrder: [
    "fewer-long-gaps",
    "later-starts",
    "fewer-campus-days",
    "earlier-finishes",
  ],
  limit: 50,
});
```

Update the existing `serializeBuilderState emits normalized url params` test to assert the repeated `priority` params:

```ts
assert.deepEqual(searchParams.getAll("priority"), [
  "fewer-long-gaps",
  "later-starts",
  "fewer-campus-days",
  "earlier-finishes",
]);
```

Update the existing `buildScheduleRequestPayload uses schedule api field names` expectation so it includes the new API field:

```ts
assert.deepEqual(payload, {
  courses: ["COMP SCI 577", "MATH 240"],
  lock_packages: ["pkg-1"],
  exclude_packages: ["pkg-2", "pkg-3"],
  preference_order: [
    "later-starts",
    "fewer-campus-days",
    "fewer-long-gaps",
    "earlier-finishes",
  ],
  limit: 10,
});
```

Add these new tests after `buildScheduleRequestSignature stays stable for equivalent builder inputs`:

```ts
test("buildScheduleRequestSignature changes when preference order changes", () => {
  const firstSignature = buildScheduleRequestSignature(makeState());
  const secondSignature = buildScheduleRequestSignature(
    makeState({
      preferenceOrder: [
        "fewer-campus-days",
        "later-starts",
        "fewer-long-gaps",
        "earlier-finishes",
      ],
    }),
  );

  assert.notEqual(firstSignature, secondSignature);
});

test("movePreferenceRule swaps adjacent rules and stops at bounds", () => {
  assert.deepEqual(
    movePreferenceRule(makeState(), "fewer-campus-days", -1).preferenceOrder,
    [
      "fewer-campus-days",
      "later-starts",
      "fewer-long-gaps",
      "earlier-finishes",
    ],
  );

  assert.deepEqual(
    movePreferenceRule(makeState(), "later-starts", -1).preferenceOrder,
    [
      "later-starts",
      "fewer-campus-days",
      "fewer-long-gaps",
      "earlier-finishes",
    ],
  );
});
```

- [ ] **Step 2: Run the focused builder-state tests to verify they fail**

Run: `pnpm --dir web exec tsx --test src/app/schedule-builder/builder-state.test.ts`

Expected: FAIL because `ScheduleBuilderState` and `buildScheduleRequestPayload` do not yet include `preferenceOrder`, and `movePreferenceRule` does not exist.

- [ ] **Step 3: Write the minimal preference-state implementation**

Create `web/src/app/schedule-builder/preferences.ts` with this content:

```ts
export const DEFAULT_SCHEDULE_PREFERENCE_ORDER = [
  "later-starts",
  "fewer-campus-days",
  "fewer-long-gaps",
  "earlier-finishes",
] as const;

export type SchedulePreferenceRuleId =
  (typeof DEFAULT_SCHEDULE_PREFERENCE_ORDER)[number];

export const SCHEDULE_PREFERENCE_RULES: Array<{
  id: SchedulePreferenceRuleId;
  label: string;
}> = [
  { id: "later-starts", label: "Later starts" },
  { id: "fewer-campus-days", label: "Fewer campus days" },
  { id: "fewer-long-gaps", label: "Fewer long gaps" },
  { id: "earlier-finishes", label: "Earlier finishes" },
];

const RULE_ID_SET = new Set<SchedulePreferenceRuleId>(
  DEFAULT_SCHEDULE_PREFERENCE_ORDER,
);

export function isSchedulePreferenceRuleId(
  value: string,
): value is SchedulePreferenceRuleId {
  return RULE_ID_SET.has(value as SchedulePreferenceRuleId);
}

export function normalizePreferenceOrder(
  values: Iterable<string | null | undefined>,
): SchedulePreferenceRuleId[] {
  const seen = new Set<SchedulePreferenceRuleId>();
  const normalized: SchedulePreferenceRuleId[] = [];

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (!isSchedulePreferenceRuleId(trimmed) || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  for (const ruleId of DEFAULT_SCHEDULE_PREFERENCE_ORDER) {
    if (!seen.has(ruleId)) {
      normalized.push(ruleId);
    }
  }

  return normalized;
}
```

In `web/src/app/schedule-builder/builder-state.ts`, update the imports at the top to:

```ts
import {
  normalizePreferenceOrder,
  type SchedulePreferenceRuleId,
} from "@/app/schedule-builder/preferences";
import {
  DEFAULT_SCHEDULE_LIMIT,
  clampScheduleLimit,
  normalizeCourseDesignation,
  normalizeUniqueCourseDesignations,
} from "@/lib/course-designation";
```

Update the state and payload types:

```ts
export type ScheduleBuilderState = {
  courses: string[];
  lockedSections: LockedSection[];
  excludedSections: ExcludedSection[];
  preferenceOrder: SchedulePreferenceRuleId[];
  limit: number;
};

export type ScheduleRequestPayload = {
  courses: string[];
  lock_packages: string[];
  exclude_packages: string[];
  preference_order: SchedulePreferenceRuleId[];
  limit: number;
};
```

Update `parseBuilderState` so it reads `priority` params:

```ts
export function parseBuilderState(searchParams: URLSearchParams): ScheduleBuilderState {
  const courses = normalizeCourses(searchParams.getAll("course"));
  const excludedSections = normalizeExcludedSections(searchParams.getAll("exclude"));
  const lockedSections = normalizeLockedSections(searchParams.getAll("lock"), excludedSections);

  return {
    courses,
    lockedSections,
    excludedSections,
    preferenceOrder: normalizePreferenceOrder(searchParams.getAll("priority")),
    limit: clampScheduleLimit(parseOptionalInteger(searchParams.get("limit"))),
  };
}
```

Update `serializeBuilderState` so it emits repeated `priority` params before `limit`:

```ts
for (const ruleId of normalizePreferenceOrder(state.preferenceOrder)) {
  searchParams.append("priority", ruleId);
}

searchParams.set("limit", String(clampScheduleLimit(state.limit)));
```

Update `buildScheduleRequestPayload` so it forwards `preference_order`:

```ts
return {
  courses: normalizeCourses(state.courses),
  lock_packages: normalizeLockedSections(
    state.lockedSections.map(({ courseDesignation, sourcePackageId }) => `${courseDesignation}~${sourcePackageId}`),
    excludedSections,
  )
    .map((lockedSection) => lockedSection.sourcePackageId)
    .filter((packageId) => !excludedSectionIdSet.has(packageId)),
  exclude_packages: excludedSectionIds,
  preference_order: normalizePreferenceOrder(state.preferenceOrder),
  limit: clampScheduleLimit(state.limit),
};
```

Add this helper just above `removeCourse`:

```ts
export function movePreferenceRule(
  state: ScheduleBuilderState,
  ruleId: SchedulePreferenceRuleId,
  direction: -1 | 1,
): ScheduleBuilderState {
  const preferenceOrder = normalizePreferenceOrder(state.preferenceOrder);
  const currentIndex = preferenceOrder.indexOf(ruleId);

  if (currentIndex === -1) {
    return {
      ...state,
      preferenceOrder,
    };
  }

  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= preferenceOrder.length) {
    return {
      ...state,
      preferenceOrder,
    };
  }

  const nextOrder = [...preferenceOrder];
  [nextOrder[currentIndex], nextOrder[nextIndex]] = [
    nextOrder[nextIndex],
    nextOrder[currentIndex],
  ];

  return {
    ...state,
    preferenceOrder: nextOrder,
  };
}
```

When you need a default order in tests or state construction, use:

```ts
preferenceOrder: [...DEFAULT_SCHEDULE_PREFERENCE_ORDER],
```

- [ ] **Step 4: Run the focused builder-state tests to verify they pass**

Run: `pnpm --dir web exec tsx --test src/app/schedule-builder/builder-state.test.ts`

Expected: PASS, including the new URL priority assertions, request-signature change test, and `movePreferenceRule` coverage.

- [ ] **Step 5: Commit the state-layer change**

```bash
git add web/src/app/schedule-builder/preferences.ts web/src/app/schedule-builder/builder-state.ts web/src/app/schedule-builder/builder-state.test.ts
git commit -m "feat: add schedule priority builder state"
```

### Task 2: Accept `preference_order` In The Schedule API Route

**Files:**
- Modify: `web/src/app/api/schedules/route.ts`
- Modify: `web/src/app/api/courses/routes.test.ts`
- Test: `web/src/app/api/courses/routes.test.ts`

- [ ] **Step 1: Write the failing API tests**

In `web/src/app/api/courses/routes.test.ts`, update the schedule-route import to:

```ts
import {
  POST as buildSchedules,
  normalizePreferenceOrderInput,
} from "../schedules/route";
```

Add this direct helper test after `schedule route rejects non-object json bodies with 400 json`:

```ts
test("schedule route normalizes preference_order values before reaching the engine", () => {
  assert.deepEqual(normalizePreferenceOrderInput(undefined), [
    "later-starts",
    "fewer-campus-days",
    "fewer-long-gaps",
    "earlier-finishes",
  ]);

  assert.deepEqual(
    normalizePreferenceOrderInput([
      "fewer-long-gaps",
      "later-starts",
      "later-starts",
      "not-a-rule",
    ]),
    [
      "fewer-long-gaps",
      "later-starts",
      "fewer-campus-days",
      "earlier-finishes",
    ],
  );

  assert.equal(normalizePreferenceOrderInput("later-starts"), null);
});
```

Add this request-level test after `schedule route accepts limit zero and returns no schedules`:

```ts
test("schedule route accepts a valid preference_order array", async () => {
  const response = await buildSchedules(
    new Request("https://example.test/api/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courses: ["COMP SCI 577"],
        preference_order: [
          "fewer-long-gaps",
          "later-starts",
          "fewer-campus-days",
          "earlier-finishes",
        ],
        limit: 0,
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    schedules: [],
  });
});
```

- [ ] **Step 2: Run the focused API tests to verify they fail**

Run: `pnpm --dir web exec tsx --test src/app/api/courses/routes.test.ts`

Expected: FAIL because `normalizePreferenceOrderInput` is not exported from the route yet.

- [ ] **Step 3: Implement route normalization and forwarding**

In `web/src/app/api/schedules/route.ts`, add the web-side preference helper import near the top:

```ts
import { normalizePreferenceOrder } from '@/app/schedule-builder/preferences';
```

Extend the request and engine option types:

```ts
type ScheduleRequestBody = {
  courses?: unknown;
  lock_packages?: unknown;
  exclude_packages?: unknown;
  preference_order?: unknown;
  limit?: unknown;
};

type GenerateSchedulesOptions = {
  courses: string[];
  lockPackages: string[];
  excludePackages: string[];
  preferenceOrder: string[];
  limit: number;
};
```

Add this exported helper below `normalizePackageIds`:

```ts
export function normalizePreferenceOrderInput(value: unknown): string[] | null {
  if (value === undefined) {
    return normalizePreferenceOrder([]);
  }

  if (!isStringArray(value)) {
    return null;
  }

  return normalizePreferenceOrder(value);
}
```

In `POST`, read and validate the field:

```ts
const courses = normalizeCourses(body.courses);
const lockPackages = normalizePackageIds(body.lock_packages);
const excludePackages = normalizePackageIds(body.exclude_packages);
const preferenceOrder = normalizePreferenceOrderInput(body.preference_order);
const limit = normalizeLimit(body.limit);

if (!lockPackages || !excludePackages || !preferenceOrder || limit === null) {
  return NextResponse.json({ error: 'Invalid schedule request body.' }, { status: 400 });
}
```

Pass the normalized order into the engine call:

```ts
schedules: generateSchedulesTyped(getDb(), {
  courses,
  lockPackages,
  excludePackages,
  preferenceOrder,
  limit,
}),
```

- [ ] **Step 4: Run the focused API tests to verify they pass**

Run: `pnpm --dir web exec tsx --test src/app/api/courses/routes.test.ts`

Expected: PASS, including the new helper-normalization test and the valid `preference_order` request test.

- [ ] **Step 5: Commit the route change**

```bash
git add web/src/app/api/schedules/route.ts web/src/app/api/courses/routes.test.ts
git commit -m "feat: accept schedule preference order in api"
```

### Task 3: Make The Schedule Engine Ranking Configurable

**Files:**
- Modify: `src/schedule/engine.mjs`
- Modify: `tests/schedule-options.test.mjs`
- Test: `tests/schedule-options.test.mjs`

- [ ] **Step 1: Write the failing engine tests**

In `tests/schedule-options.test.mjs`, replace the existing `buildSchedules still returns the best-ranked schedule when limit is 1` test with these two tests:

```js
test('buildSchedules uses the default preference order when limit is 1', async () => {
  const scheduleEngine = await loadScheduleEngineModule();
  const schedules = scheduleEngine.buildSchedules({
    orderedGroups: [
      {
        courseDesignation: 'COURSE A',
        candidates: [
          makeTestCandidate('a-early-compact', {
            courseDesignation: 'COURSE A',
            campusDayCount: 1,
            earliestStartMinuteLocal: 480,
            latestEndMinuteLocal: 840,
            meetings: [{ days_mask: 1, start_minute_local: 480, end_minute_local: 540, is_online: 0 }],
          }),
          makeTestCandidate('a-late-spread', {
            courseDesignation: 'COURSE A',
            campusDayCount: 3,
            earliestStartMinuteLocal: 720,
            latestEndMinuteLocal: 900,
            meetings: [{ days_mask: 1, start_minute_local: 720, end_minute_local: 780, is_online: 0 }],
          }),
        ],
      },
      {
        courseDesignation: 'COURSE B',
        candidates: [
          makeTestCandidate('b-1', {
            courseDesignation: 'COURSE B',
            meetings: [{ days_mask: 2, start_minute_local: 840, end_minute_local: 900, is_online: 0 }],
          }),
        ],
      },
    ],
    lockedByCourse: new Map(),
    conflicts: new Map(),
    transitions: new Map(),
    limit: 1,
  });

  assert.equal(schedules.length, 1);
  assert.deepEqual(schedules[0].package_ids, ['a-late-spread', 'b-1']);
});

test('buildSchedules changes the top result when preferenceOrder changes', async () => {
  const scheduleEngine = await loadScheduleEngineModule();
  const schedules = scheduleEngine.buildSchedules({
    orderedGroups: [
      {
        courseDesignation: 'COURSE A',
        candidates: [
          makeTestCandidate('a-early-compact', {
            courseDesignation: 'COURSE A',
            campusDayCount: 1,
            earliestStartMinuteLocal: 480,
            latestEndMinuteLocal: 840,
            meetings: [{ days_mask: 1, start_minute_local: 480, end_minute_local: 540, is_online: 0 }],
          }),
          makeTestCandidate('a-late-spread', {
            courseDesignation: 'COURSE A',
            campusDayCount: 3,
            earliestStartMinuteLocal: 720,
            latestEndMinuteLocal: 900,
            meetings: [{ days_mask: 1, start_minute_local: 720, end_minute_local: 780, is_online: 0 }],
          }),
        ],
      },
      {
        courseDesignation: 'COURSE B',
        candidates: [
          makeTestCandidate('b-1', {
            courseDesignation: 'COURSE B',
            meetings: [{ days_mask: 2, start_minute_local: 840, end_minute_local: 900, is_online: 0 }],
          }),
        ],
      },
    ],
    lockedByCourse: new Map(),
    conflicts: new Map(),
    transitions: new Map(),
    preferenceOrder: [
      'fewer-campus-days',
      'later-starts',
      'fewer-long-gaps',
      'earlier-finishes',
    ],
    limit: 1,
  });

  assert.equal(schedules.length, 1);
  assert.deepEqual(schedules[0].package_ids, ['a-early-compact', 'b-1']);
});
```

Add this normalization test immediately after them:

```js
test('normalizePreferenceOrder fills missing rules and ignores unknown values', async () => {
  const scheduleEngine = await loadScheduleEngineModule();

  assert.deepEqual(scheduleEngine.normalizePreferenceOrder(), [
    'later-starts',
    'fewer-campus-days',
    'fewer-long-gaps',
    'earlier-finishes',
  ]);

  assert.deepEqual(
    scheduleEngine.normalizePreferenceOrder([
      'fewer-long-gaps',
      'later-starts',
      'later-starts',
      'not-a-rule',
    ]),
    [
      'fewer-long-gaps',
      'later-starts',
      'fewer-campus-days',
      'earlier-finishes',
    ],
  );
});
```

- [ ] **Step 2: Run the schedule-engine test file to verify it fails**

Run: `node --test tests/schedule-options.test.mjs`

Expected: FAIL because the engine still ranks with the current fixed comparator and does not export `normalizePreferenceOrder`.

- [ ] **Step 3: Implement the preference-driven comparator in the engine**

In `src/schedule/engine.mjs`, add these exports near the top, below `LARGE_IDLE_GAP_MINUTES`:

```js
export const DEFAULT_PREFERENCE_ORDER = [
  'later-starts',
  'fewer-campus-days',
  'fewer-long-gaps',
  'earlier-finishes',
];

const SCHEDULE_PREFERENCE_RULES = {
  'later-starts': (left, right) => compareNullableDescending(
    left.earliest_start_minute_local,
    right.earliest_start_minute_local,
    Number.POSITIVE_INFINITY,
  ),
  'fewer-campus-days': (left, right) => left.campus_day_count - right.campus_day_count,
  'fewer-long-gaps': (left, right) => left.large_idle_gap_count - right.large_idle_gap_count,
  'earlier-finishes': (left, right) => compareNullableAscending(
    left.latest_end_minute_local,
    right.latest_end_minute_local,
    Number.NEGATIVE_INFINITY,
  ),
};

export function normalizePreferenceOrder(preferenceOrder = DEFAULT_PREFERENCE_ORDER) {
  const seen = new Set();
  const normalized = [];

  for (const ruleId of preferenceOrder) {
    if (!Object.hasOwn(SCHEDULE_PREFERENCE_RULES, ruleId) || seen.has(ruleId)) {
      continue;
    }

    seen.add(ruleId);
    normalized.push(ruleId);
  }

  for (const ruleId of DEFAULT_PREFERENCE_ORDER) {
    if (!seen.has(ruleId)) {
      normalized.push(ruleId);
    }
  }

  return normalized;
}
```

Replace the current `compareSchedules` implementation with:

```js
export function compareSchedules(left, right, preferenceOrder = DEFAULT_PREFERENCE_ORDER) {
  for (const ruleId of normalizePreferenceOrder(preferenceOrder)) {
    const comparison = SCHEDULE_PREFERENCE_RULES[ruleId](left, right);
    if (comparison !== 0) {
      return comparison;
    }
  }

  return (
    left.tight_transition_count - right.tight_transition_count ||
    left.total_walking_distance_meters - right.total_walking_distance_meters ||
    right.total_open_seats - left.total_open_seats ||
    left.package_ids.join('\u0000').localeCompare(right.package_ids.join('\u0000'))
  );
}
```

Update `buildSchedules` so it accepts and uses `preferenceOrder`:

```js
export function buildSchedules({
  orderedGroups,
  lockedByCourse,
  conflicts,
  transitions,
  preferenceOrder = DEFAULT_PREFERENCE_ORDER,
  limit,
}) {
```

Then change both internal sorts inside `buildSchedules` to:

```js
schedules.sort((left, right) => compareSchedules(left, right, preferenceOrder));
```

Update `generateSchedules` so it accepts `preferenceOrder` and passes it through:

```js
export function generateSchedules(db, {
  courses,
  lockPackages = [],
  excludePackages = [],
  preferenceOrder = DEFAULT_PREFERENCE_ORDER,
  limit = DEFAULT_LIMIT,
}) {
```

and:

```js
return buildSchedules({
  orderedGroups,
  lockedByCourse,
  conflicts: deriveConflicts(meetingsByPackageId, activePackageIds),
  transitions: deriveTransitions(meetingsByPackageId, activePackageIds),
  preferenceOrder,
  limit,
});
```

- [ ] **Step 4: Run the schedule-engine test file to verify it passes**

Run: `node --test tests/schedule-options.test.mjs`

Expected: PASS, including the new default-order, custom-order, and normalization coverage.

- [ ] **Step 5: Commit the engine change**

```bash
git add src/schedule/engine.mjs tests/schedule-options.test.mjs
git commit -m "feat: make schedule ranking preference aware"
```

### Task 4: Add The Schedule Priorities UI And Wire It Into The Builder

**Files:**
- Create: `web/src/app/components/SchedulePriorityList.tsx`
- Modify: `web/src/app/schedule-builder/ScheduleBuilder.tsx`
- Modify: `web/src/app/schedule-builder/components.test.tsx`
- Test: `web/src/app/schedule-builder/components.test.tsx`

- [ ] **Step 1: Write the failing component test**

In `web/src/app/schedule-builder/components.test.tsx`, add the new import near the top:

```tsx
import { SchedulePriorityList } from "@/app/components/SchedulePriorityList";
```

Add this test after `SelectedCourseList shows its key presentational states`:

```tsx
test("SchedulePriorityList renders ranked rules with move controls", () => {
  const markup = renderToStaticMarkup(
    <SchedulePriorityList
      preferenceOrder={[
        "later-starts",
        "fewer-campus-days",
        "fewer-long-gaps",
        "earlier-finishes",
      ]}
      onMoveRule={() => {}}
    />,
  );

  assert.match(markup, /Schedule priorities/i);
  assert.match(markup, /Schedules are generated using this priority order from top to bottom/i);
  assert.match(markup, /Later starts/);
  assert.match(markup, /Fewer campus days/);
  assert.match(markup, /Fewer long gaps/);
  assert.match(markup, /Earlier finishes/);
  assert.match(markup, /Move up/);
  assert.match(markup, /Move down/);
});
```

- [ ] **Step 2: Run the focused component test file to verify it fails**

Run: `pnpm --dir web exec tsx --test src/app/schedule-builder/components.test.tsx`

Expected: FAIL because `SchedulePriorityList` does not exist yet.

- [ ] **Step 3: Implement the new component and render it in the builder**

Create `web/src/app/components/SchedulePriorityList.tsx` with this content:

```tsx
import React from "react";

import {
  SCHEDULE_PREFERENCE_RULES,
  type SchedulePreferenceRuleId,
} from "@/app/schedule-builder/preferences";

type SchedulePriorityListProps = {
  preferenceOrder: SchedulePreferenceRuleId[];
  onMoveRule: (ruleId: SchedulePreferenceRuleId, direction: -1 | 1) => void;
};

const RULES_BY_ID = new Map(
  SCHEDULE_PREFERENCE_RULES.map((rule) => [rule.id, rule] as const),
);

export function SchedulePriorityList({
  preferenceOrder,
  onMoveRule,
}: SchedulePriorityListProps) {
  return (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-black/10 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">
          Schedule priorities
        </h2>
        <p className="text-sm leading-7 text-black/68 dark:text-white/68">
          Schedules are generated using this priority order from top to bottom.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {preferenceOrder.map((ruleId, index) => {
          const rule = RULES_BY_ID.get(ruleId);
          if (!rule) {
            return null;
          }

          const isFirst = index === 0;
          const isLast = index === preferenceOrder.length - 1;

          return (
            <article
              key={rule.id}
              className="flex flex-col gap-3 rounded-3xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-8 items-center justify-center rounded-full border border-black/10 text-sm font-semibold dark:border-white/10">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold">{rule.label}</h3>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isFirst}
                  onClick={() => onMoveRule(rule.id, -1)}
                  className="min-h-11 rounded-full border border-black/10 px-4 text-sm font-medium transition hover:border-black/20 hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
                >
                  Move up
                </button>
                <button
                  type="button"
                  disabled={isLast}
                  onClick={() => onMoveRule(rule.id, 1)}
                  className="min-h-11 rounded-full border border-black/10 px-4 text-sm font-medium transition hover:border-black/20 hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
                >
                  Move down
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
```

In `web/src/app/schedule-builder/ScheduleBuilder.tsx`, add these imports near the top:

```tsx
import { SchedulePriorityList } from "@/app/components/SchedulePriorityList";
```

and:

```tsx
  movePreferenceRule,
```

to the existing `builder-state` import block.

Inside the left-side column, render the new component immediately before the existing `Settings` card:

```tsx
<SchedulePriorityList
  preferenceOrder={builderState.preferenceOrder}
  onMoveRule={(ruleId, direction) => {
    updateBuilderState((state) => movePreferenceRule(state, ruleId, direction));
  }}
/>
```

Do not add separate local state for preferences. Reuse the existing URL-backed builder state and the existing `buildScheduleRequestSignature(builderState)` call.

- [ ] **Step 4: Run the focused builder component tests to verify they pass**

Run: `pnpm --dir web exec tsx --test src/app/schedule-builder/components.test.tsx src/app/schedule-builder/builder-state.test.ts`

Expected: PASS, including the new `SchedulePriorityList` markup test and the existing builder-state signature-change coverage.

- [ ] **Step 5: Commit the UI change**

```bash
git add web/src/app/components/SchedulePriorityList.tsx web/src/app/schedule-builder/ScheduleBuilder.tsx web/src/app/schedule-builder/components.test.tsx
git commit -m "feat: add schedule priority controls"
```

### Task 5: Run Targeted And Full Verification

**Files:**
- Modify: none
- Test: `web/src/app/schedule-builder/builder-state.test.ts`
- Test: `web/src/app/schedule-builder/components.test.tsx`
- Test: `web/src/app/api/courses/routes.test.ts`
- Test: `tests/schedule-options.test.mjs`

- [ ] **Step 1: Run the directly affected web tests together**

Run: `pnpm --dir web exec tsx --test src/app/schedule-builder/builder-state.test.ts src/app/schedule-builder/components.test.tsx src/app/api/courses/routes.test.ts`

Expected: PASS for all three web-side test files.

- [ ] **Step 2: Run the schedule-engine regression tests**

Run: `node --test tests/schedule-options.test.mjs`

Expected: PASS.

- [ ] **Step 3: Run the full repo test suite**

Run: `pnpm test`

Expected: PASS for the root Node tests and the full `web` workspace suite.

- [ ] **Step 4: Inspect the working tree before finishing**

Run: `git status --short`

Expected: no unexpected changes beyond:

```text
M src/schedule/engine.mjs
M tests/schedule-options.test.mjs
M web/src/app/api/courses/routes.test.ts
M web/src/app/api/schedules/route.ts
M web/src/app/schedule-builder/ScheduleBuilder.tsx
M web/src/app/schedule-builder/builder-state.test.ts
M web/src/app/schedule-builder/builder-state.ts
M web/src/app/schedule-builder/components.test.tsx
A web/src/app/components/SchedulePriorityList.tsx
A web/src/app/schedule-builder/preferences.ts
```

- [ ] **Step 5: Commit a follow-up only if verification required extra edits**

If verification required no further changes, do not create an extra commit. If a small follow-up fix was required during verification, commit it with:

```bash
git add src/schedule/engine.mjs tests/schedule-options.test.mjs web/src/app/api/courses/routes.test.ts web/src/app/api/schedules/route.ts web/src/app/components/SchedulePriorityList.tsx web/src/app/schedule-builder/ScheduleBuilder.tsx web/src/app/schedule-builder/builder-state.test.ts web/src/app/schedule-builder/builder-state.ts web/src/app/schedule-builder/components.test.tsx web/src/app/schedule-builder/preferences.ts
git commit -m "test: verify schedule priority ranking flow"
```

## Self-Review

- Spec coverage: the plan adds URL-backed priority ordering, a dedicated settings UI, API normalization, backend comparator configuration, fallback behavior, and `limit = 1` verification that ranking affects which schedules survive generation.
- Placeholder scan: every task names exact files, exact code snippets, and exact commands with expected pass/fail outcomes.
- Type consistency: the plan uses `preferenceOrder` in builder state, `preference_order` in the API request body, and `preferenceOrder` in engine options consistently across all tasks.
