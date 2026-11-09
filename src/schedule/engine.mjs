import { countBits, haversineMeters } from '../db/schedule-helpers.mjs';

export const DEFAULT_LIMIT = 25;
export const LARGE_IDLE_GAP_MINUTES = 90;
export const DEFAULT_PREFERENCE_ORDER = [
  'later-starts',
  'fewer-campus-days',
  'less-time-between-classes',
  'shorter-walks',
  'more-open-seats',
  'earlier-finishes',
];

const LEGACY_PREFERENCE_RULE_ALIASES = {
  'fewer-long-gaps': 'less-time-between-classes',
};

const SCHEDULE_PREFERENCE_RULES = {
  'later-starts': (left, right) => compareNullableDescending(
    left.earliest_start_minute_local,
    right.earliest_start_minute_local,
    Number.POSITIVE_INFINITY,
  ),
  'fewer-campus-days': (left, right) => (left.campus_day_count ?? 0) - (right.campus_day_count ?? 0),
  'less-time-between-classes': (left, right) =>
    (left.total_between_class_minutes ?? 0) - (right.total_between_class_minutes ?? 0),
  'more-time-between-classes': (left, right) =>
    (right.total_between_class_minutes ?? 0) - (left.total_between_class_minutes ?? 0),
  'shorter-walks': (left, right) =>
    (left.total_walking_distance_meters ?? 0) - (right.total_walking_distance_meters ?? 0),
  'more-open-seats': (left, right) => (right.total_open_seats ?? 0) - (left.total_open_seats ?? 0),
  'earlier-finishes': (left, right) => compareNullableAscending(
    left.latest_end_minute_local,
    right.latest_end_minute_local,
    Number.NEGATIVE_INFINITY,
  ),
};

export function makePlaceholders(values) {
  return values.map(() => '?').join(', ');
}

export function queryRows(db, sql, values) {
  if (values.length === 0) {
    return [];
  }

  return db.prepare(sql.replaceAll('__PLACEHOLDERS__', makePlaceholders(values))).all(...values);
}

export function loadCandidates(db, courseDesignations) {
  return queryRows(
    db,
    `
      SELECT
        source_package_id,
        course_designation,
        title,
        section_bundle_label,
        open_seats,
        is_full,
        has_waitlist,
        meeting_count,
        campus_day_count,
        earliest_start_minute_local,
        latest_end_minute_local,
        has_online_meeting,
        has_unknown_location,
        restriction_note,
        has_temporary_restriction,
        meeting_summary_local
      FROM schedule_candidates_v
      WHERE course_designation IN (__PLACEHOLDERS__)
      ORDER BY course_designation, source_package_id
    `,
    courseDesignations,
  );
}

export function loadMeetings(db, packageIds) {
  const rows = queryRows(
    db,
    `
      SELECT
        package_id AS source_package_id,
        days_mask,
        start_minute_local,
        end_minute_local,
        start_date,
        end_date,
        exam_date,
        is_online,
        location_known,
        latitude,
        longitude
      FROM canonical_meetings
      WHERE meeting_type = 'CLASS'
        AND source_package_id IN (__PLACEHOLDERS__)
        AND days_mask IS NOT NULL
        AND start_minute_local IS NOT NULL
        AND end_minute_local IS NOT NULL
      ORDER BY source_package_id, start_minute_local, end_minute_local
    `,
    packageIds,
  );
  const meetingsByPackageId = new Map();

  for (const row of rows) {
    const meetings = meetingsByPackageId.get(row.source_package_id) ?? [];
    meetings.push(row);
    meetingsByPackageId.set(row.source_package_id, meetings);
  }

  return meetingsByPackageId;
}

export function meetingsShareDateRange(left, right) {
  const leftStart = left.start_date ?? Number.NEGATIVE_INFINITY;
  const leftEnd = left.end_date ?? left.exam_date ?? Number.POSITIVE_INFINITY;
  const rightStart = right.start_date ?? Number.NEGATIVE_INFINITY;
  const rightEnd = right.end_date ?? right.exam_date ?? Number.POSITIVE_INFINITY;

  return leftStart <= rightEnd && rightStart <= leftEnd;
}

export function buildMeetingsByDay(meetingsByPackageId, packageIds, filter = () => true) {
  const meetingsByDay = new Map();

  for (const packageId of packageIds) {
    const meetings = meetingsByPackageId.get(packageId) ?? [];

    for (const meeting of meetings) {
      if (!filter(meeting)) {
        continue;
      }

      for (let bit = 1; bit <= 64; bit <<= 1) {
        if ((meeting.days_mask & bit) === 0) {
          continue;
        }

        const dayMeetings = meetingsByDay.get(bit) ?? [];
        dayMeetings.push(meeting);
        meetingsByDay.set(bit, dayMeetings);
      }
    }
  }

  for (const dayMeetings of meetingsByDay.values()) {
    dayMeetings.sort((left, right) => {
      const startCompare = left.start_minute_local - right.start_minute_local;
      if (startCompare !== 0) return startCompare;
      const endCompare = left.end_minute_local - right.end_minute_local;
      if (endCompare !== 0) return endCompare;
      return left.source_package_id.localeCompare(right.source_package_id);
    });
  }

  return meetingsByDay;
}

export function deriveConflicts(meetingsByPackageId, packageIds) {
  const conflicts = new Map();
  const meetingsByDay = buildMeetingsByDay(meetingsByPackageId, packageIds);

  for (const dayMeetings of meetingsByDay.values()) {
    let windowStart = 0;

    for (let index = 0; index < dayMeetings.length; index += 1) {
      const current = dayMeetings[index];

      while (windowStart < index && dayMeetings[windowStart].end_minute_local <= current.start_minute_local) {
        windowStart += 1;
      }

      for (let previousIndex = windowStart; previousIndex < index; previousIndex += 1) {
        const previous = dayMeetings[previousIndex];
        if (previous.source_package_id === current.source_package_id) {
          continue;
        }
        if (!meetingsShareDateRange(previous, current)) {
          continue;
        }

        const overlapStart = Math.max(previous.start_minute_local, current.start_minute_local);
        const overlapEnd = Math.min(previous.end_minute_local, current.end_minute_local);
        if (overlapStart >= overlapEnd) {
          continue;
        }

        const left = conflicts.get(previous.source_package_id) ?? new Set();
        left.add(current.source_package_id);
        conflicts.set(previous.source_package_id, left);

        const right = conflicts.get(current.source_package_id) ?? new Set();
        right.add(previous.source_package_id);
        conflicts.set(current.source_package_id, right);
      }
    }
  }

  return conflicts;
}

export function deriveTransitions(meetingsByPackageId, packageIds) {
  const transitions = new Map();
  const meetingsByDay = buildMeetingsByDay(
    meetingsByPackageId,
    packageIds,
    (meeting) => meeting.is_online !== 1 && meeting.location_known === 1,
  );

  for (const [dayBit, dayMeetings] of meetingsByDay) {
    let windowStart = 0;

    for (let index = 0; index < dayMeetings.length; index += 1) {
      const current = dayMeetings[index];

      while (windowStart < index && dayMeetings[windowStart].end_minute_local < current.start_minute_local - 45) {
        windowStart += 1;
      }

      for (let previousIndex = windowStart; previousIndex < index; previousIndex += 1) {
        const previous = dayMeetings[previousIndex];
        if (previous.source_package_id === current.source_package_id) {
          continue;
        }
        if (!meetingsShareDateRange(previous, current)) {
          continue;
        }
        if (previous.end_minute_local > current.start_minute_local) {
          continue;
        }

        const gapMinutes = current.start_minute_local - previous.end_minute_local;
        if (gapMinutes < 0 || gapMinutes > 45) {
          continue;
        }

        const walkingDistanceMeters = haversineMeters(previous, current);
        const key = `${previous.source_package_id}:${current.source_package_id}`;
        const existing = transitions.get(key);
        const existingDistance = existing?.walking_distance_meters ?? 2147483647;
        const nextDistance = walkingDistanceMeters ?? 2147483647;

        if (
          !existing ||
          gapMinutes < existing.gap_minutes ||
          (gapMinutes === existing.gap_minutes && nextDistance < existingDistance)
        ) {
          transitions.set(key, {
            from_package_id: previous.source_package_id,
            to_package_id: current.source_package_id,
            shared_days_mask: (existing?.shared_days_mask ?? 0) | dayBit,
            gap_minutes: gapMinutes,
            walking_distance_meters: walkingDistanceMeters,
            is_tight_transition: Number(
              gapMinutes < 10 || (gapMinutes < 15 && (walkingDistanceMeters ?? 0) > 200),
            ),
          });
          continue;
        }

        existing.shared_days_mask |= dayBit;
      }
    }
  }

  return transitions;
}

export function buildCandidateGroups(candidateRows, meetingsByPackageId, excludedPackageIds) {
  const groups = new Map();
  const candidatesById = new Map();

  for (const row of candidateRows) {
    if (excludedPackageIds.has(row.source_package_id)) {
      continue;
    }

    const candidate = {
      packageId: row.source_package_id,
      courseDesignation: row.course_designation,
      title: row.title,
      sectionBundleLabel: row.section_bundle_label,
      openSeats: row.open_seats ?? 0,
      isFull: row.is_full ?? 0,
      hasWaitlist: row.has_waitlist ?? 0,
      meetingCount: row.meeting_count ?? 0,
      campusDayCount: row.campus_day_count ?? 0,
      earliestStartMinuteLocal: row.earliest_start_minute_local,
      latestEndMinuteLocal: row.latest_end_minute_local,
      hasOnlineMeeting: row.has_online_meeting ?? 0,
      hasUnknownLocation: row.has_unknown_location ?? 0,
      restrictionNote: row.restriction_note ?? null,
      hasTemporaryRestriction: row.has_temporary_restriction ?? 0,
      meetingSummaryLocal: row.meeting_summary_local ?? null,
      meetings: meetingsByPackageId.get(row.source_package_id) ?? [],
    };
    candidatesById.set(candidate.packageId, candidate);

    const group = groups.get(candidate.courseDesignation) ?? [];
    group.push(candidate);
    groups.set(candidate.courseDesignation, group);
  }

  return { groups, candidatesById };
}

export function buildLockedByCourse(lockPackageIds, candidatesById) {
  const lockedByCourse = new Map();

  for (const packageId of lockPackageIds) {
    const candidate = candidatesById.get(packageId);
    if (!candidate) {
      return null;
    }

    const existing = lockedByCourse.get(candidate.courseDesignation);
    if (existing && existing !== packageId) {
      return null;
    }

    lockedByCourse.set(candidate.courseDesignation, packageId);
  }

  return lockedByCourse;
}

export function countLargeIdleGaps(candidates) {
  const meetingsByDay = new Map();

  for (const candidate of candidates) {
    for (const meeting of candidate.meetings) {
      for (let bit = 1; bit <= 64; bit <<= 1) {
        if ((meeting.days_mask & bit) === 0) {
          continue;
        }

        const dayMeetings = meetingsByDay.get(bit) ?? [];
        dayMeetings.push(meeting);
        meetingsByDay.set(bit, dayMeetings);
      }
    }
  }

  let largeIdleGapCount = 0;
  for (const dayMeetings of meetingsByDay.values()) {
    dayMeetings.sort((left, right) => left.start_minute_local - right.start_minute_local);

    for (let index = 1; index < dayMeetings.length; index += 1) {
      const currentMeeting = dayMeetings[index];
      let latestRelevantPriorEnd = null;

      for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
        const previousMeeting = dayMeetings[previousIndex];
        if (!meetingsShareDateRange(currentMeeting, previousMeeting)) {
          continue;
        }

        latestRelevantPriorEnd = Math.max(
          latestRelevantPriorEnd ?? Number.NEGATIVE_INFINITY,
          previousMeeting.end_minute_local,
        );
      }

      if (latestRelevantPriorEnd == null) {
        continue;
      }

      const gapMinutes = currentMeeting.start_minute_local - latestRelevantPriorEnd;
      if (gapMinutes >= LARGE_IDLE_GAP_MINUTES) {
        largeIdleGapCount += 1;
      }
    }
  }

  return largeIdleGapCount;
}

export function countTotalBetweenClassMinutes(candidates) {
  const meetingsByDay = new Map();

  for (const candidate of candidates) {
    for (const meeting of candidate.meetings) {
      for (let bit = 1; bit <= 64; bit <<= 1) {
        if ((meeting.days_mask & bit) === 0) {
          continue;
        }

        const dayMeetings = meetingsByDay.get(bit) ?? [];
        dayMeetings.push(meeting);
        meetingsByDay.set(bit, dayMeetings);
      }
    }
  }

  let totalBetweenClassMinutes = 0;
  for (const dayMeetings of meetingsByDay.values()) {
    dayMeetings.sort((left, right) => left.start_minute_local - right.start_minute_local);

    for (let index = 1; index < dayMeetings.length; index += 1) {
      const currentMeeting = dayMeetings[index];
      let latestRelevantPriorEnd = null;

      for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
        const previousMeeting = dayMeetings[previousIndex];
        if (!meetingsShareDateRange(currentMeeting, previousMeeting)) {
          continue;
        }

        latestRelevantPriorEnd = Math.max(
          latestRelevantPriorEnd ?? Number.NEGATIVE_INFINITY,
          previousMeeting.end_minute_local,
        );
      }

      if (latestRelevantPriorEnd == null) {
        continue;
      }

      const gapMinutes = currentMeeting.start_minute_local - latestRelevantPriorEnd;
      if (gapMinutes > 0) {
        totalBetweenClassMinutes += gapMinutes;
      }
    }
  }

  return totalBetweenClassMinutes;
}

export function buildScheduleMetrics(candidates, transitions) {
  let campusDaysMask = 0;
  let earliestStartMinuteLocal = null;
  let latestEndMinuteLocal = null;
  let totalOpenSeats = 0;

  for (const candidate of candidates) {
    totalOpenSeats += candidate.openSeats;

    for (const meeting of candidate.meetings) {
      earliestStartMinuteLocal = earliestStartMinuteLocal == null
        ? meeting.start_minute_local
        : Math.min(earliestStartMinuteLocal, meeting.start_minute_local);
      latestEndMinuteLocal = latestEndMinuteLocal == null
        ? meeting.end_minute_local
        : Math.max(latestEndMinuteLocal, meeting.end_minute_local);

      if (meeting.is_online !== 1) {
        campusDaysMask |= meeting.days_mask;
      }
    }
  }

  let tightTransitionCount = 0;
  let totalWalkingDistanceMeters = 0;
  for (const fromCandidate of candidates) {
    for (const toCandidate of candidates) {
      if (fromCandidate.packageId === toCandidate.packageId) {
        continue;
      }

      const transition = transitions.get(`${fromCandidate.packageId}:${toCandidate.packageId}`);
      if (!transition) {
        continue;
      }

      tightTransitionCount += transition.is_tight_transition ?? 0;
      totalWalkingDistanceMeters += transition.walking_distance_meters ?? 0;
    }
  }

  return {
    campus_day_count: countBits(campusDaysMask),
    earliest_start_minute_local: earliestStartMinuteLocal,
    large_idle_gap_count: countLargeIdleGaps(candidates),
    total_between_class_minutes: countTotalBetweenClassMinutes(candidates),
    tight_transition_count: tightTransitionCount,
    total_walking_distance_meters: totalWalkingDistanceMeters,
    total_open_seats: totalOpenSeats,
    latest_end_minute_local: latestEndMinuteLocal,
  };
}

function buildConservativeHardFilterSchedule(schedule, packages) {
  return {
    ...schedule,
    campus_day_count: Math.max(
      schedule.campus_day_count ?? 0,
      ...packages.map((pkg) => pkg.campus_day_count ?? 0),
    ),
    earliest_start_minute_local: packages.reduce(
      (earliest, pkg) => {
        if (pkg.earliest_start_minute_local == null) {
          return earliest;
        }

        return earliest == null
          ? pkg.earliest_start_minute_local
          : Math.min(earliest, pkg.earliest_start_minute_local);
      },
      schedule.earliest_start_minute_local,
    ),
    latest_end_minute_local: packages.reduce(
      (latest, pkg) => {
        if (pkg.latest_end_minute_local == null) {
          return latest;
        }

        return latest == null
          ? pkg.latest_end_minute_local
          : Math.max(latest, pkg.latest_end_minute_local);
      },
      schedule.latest_end_minute_local,
    ),
  };
}

export function compareNullableAscending(left, right, nullValue) {
  const resolvedLeft = left ?? nullValue;
  const resolvedRight = right ?? nullValue;
  if (resolvedLeft === resolvedRight) {
    return 0;
  }

  return resolvedLeft - resolvedRight;
}

export function compareNullableDescending(left, right, nullValue) {
  const resolvedLeft = left ?? nullValue;
  const resolvedRight = right ?? nullValue;
  if (resolvedLeft === resolvedRight) {
    return 0;
  }

  return resolvedRight - resolvedLeft;
}

export function normalizePreferenceOrder(preferenceOrder = DEFAULT_PREFERENCE_ORDER) {
  const seen = new Set();
  const normalized = [];

  for (const ruleId of preferenceOrder) {
    const normalizedRuleId = LEGACY_PREFERENCE_RULE_ALIASES[ruleId] ?? ruleId;
    if (!Object.hasOwn(SCHEDULE_PREFERENCE_RULES, normalizedRuleId) || seen.has(normalizedRuleId)) {
      continue;
    }

    seen.add(normalizedRuleId);
    normalized.push(normalizedRuleId);
  }

  return normalized;
}

export function compareSchedules(left, right, preferenceOrder = DEFAULT_PREFERENCE_ORDER) {
  for (const ruleId of normalizePreferenceOrder(preferenceOrder)) {
    const comparison = SCHEDULE_PREFERENCE_RULES[ruleId](left, right);
    if (comparison !== 0) {
      return comparison;
    }
  }

  return (
    left.tight_transition_count - right.tight_transition_count ||
    left.package_ids.join('\u0000').localeCompare(right.package_ids.join('\u0000'))
  );
}

export function passesHardFilters(schedule, options) {
  if (options.maxCampusDays != null && schedule.campus_day_count > options.maxCampusDays) {
    return false;
  }

  if (
    options.startAfterMinuteLocal != null &&
    schedule.earliest_start_minute_local != null &&
    schedule.earliest_start_minute_local < options.startAfterMinuteLocal
  ) {
    return false;
  }

  if (
    options.endBeforeMinuteLocal != null &&
    schedule.latest_end_minute_local != null &&
    schedule.latest_end_minute_local > options.endBeforeMinuteLocal
  ) {
    return false;
  }

  return true;
}

export function hasConflict(conflicts, packageId, selectedPackageIds) {
  const conflictSet = conflicts.get(packageId);
  if (!conflictSet) {
    return false;
  }

  for (const selectedPackageId of selectedPackageIds) {
    if (conflictSet.has(selectedPackageId)) {
      return true;
    }
  }

  return false;
}

function makeVisiblePackageKey(pkg) {
  return [
    pkg.courseDesignation ?? pkg.course_designation ?? '',
    pkg.sectionBundleLabel ?? pkg.section_bundle_label ?? '',
    pkg.meetingSummaryLocal ?? pkg.meeting_summary_local ?? '',
  ].join('\u0000');
}

function makeScheduleVisibilityKey(packages) {
  return [...packages]
    .map((pkg) => makeVisiblePackageKey(pkg))
    .sort()
    .join('\u0001');
}

function isCandidateAvailabilityEligible(candidate, {
  includeWaitlisted = false,
  includeClosed = false,
  isLocked = false,
}) {
  if (isLocked || candidate.openSeats > 0) {
    return true;
  }

  if (candidate.hasWaitlist) {
    return includeWaitlisted;
  }

  return includeClosed;
}

export function buildSchedules({
  orderedGroups,
  lockedByCourse,
  conflicts,
  transitions,
  preferenceOrder = DEFAULT_PREFERENCE_ORDER,
  includeWaitlisted = false,
  includeClosed = false,
  limit,
  maxCampusDays = null,
  startAfterMinuteLocal = null,
  endBeforeMinuteLocal = null,
  onScheduleBuilt = null,
}) {
  const eligibleGroups = orderedGroups.map((group) => {
    const lockedPackageId = lockedByCourse.get(group.courseDesignation) ?? null;

    return {
      ...group,
      candidates: group.candidates.filter((candidate) => isCandidateAvailabilityEligible(candidate, {
        includeWaitlisted,
        includeClosed,
        isLocked: lockedPackageId === candidate.packageId,
      })),
    };
  });

  if (eligibleGroups.some((group) => group.candidates.length === 0)) {
    return [];
  }

  const schedules = [];
  const scheduleIndexByVisibilityKey = new Map();
  const selectedCandidates = [];
  const selectedPackageIds = new Set();
  const hardFilterOptions = {
    maxCampusDays,
    startAfterMinuteLocal,
    endBeforeMinuteLocal,
  };

  function trimSchedulesToLimit() {
    schedules.sort((left, right) => compareSchedules(left, right, preferenceOrder));
    if (schedules.length > limit) {
      schedules.length = limit;
    }

    scheduleIndexByVisibilityKey.clear();
    schedules.forEach((schedule, index) => {
      scheduleIndexByVisibilityKey.set(makeScheduleVisibilityKey(schedule.packages), index);
    });
  }

  function visit(index) {
    if (index >= eligibleGroups.length) {
      const packageIds = selectedCandidates.map((candidate) => candidate.packageId).sort();
      const packages = [...selectedCandidates]
        .sort((left, right) => left.packageId.localeCompare(right.packageId))
        .map((candidate) => ({
          source_package_id: candidate.packageId,
          course_designation: candidate.courseDesignation,
          title: candidate.title,
          section_bundle_label: candidate.sectionBundleLabel,
          open_seats: candidate.openSeats,
          is_full: candidate.isFull,
          has_waitlist: candidate.hasWaitlist,
          meeting_count: candidate.meetingCount,
          campus_day_count: candidate.campusDayCount,
          earliest_start_minute_local: candidate.earliestStartMinuteLocal,
          latest_end_minute_local: candidate.latestEndMinuteLocal,
          has_online_meeting: candidate.hasOnlineMeeting,
          has_unknown_location: candidate.hasUnknownLocation,
          restriction_note: candidate.restrictionNote,
          has_temporary_restriction: candidate.hasTemporaryRestriction,
          meeting_summary_local: candidate.meetingSummaryLocal,
        }));

      const schedule = {
        package_ids: packageIds,
        packages,
        conflict_count: 0,
        ...buildScheduleMetrics(selectedCandidates, transitions),
      };
      onScheduleBuilt?.(schedule);
      if (!passesHardFilters(buildConservativeHardFilterSchedule(schedule, packages), hardFilterOptions)) {
        return false;
      }

      const visibilityKey = makeScheduleVisibilityKey(packages);
      const existingIndex = scheduleIndexByVisibilityKey.get(visibilityKey);

      if (existingIndex !== undefined) {
        if (compareSchedules(schedule, schedules[existingIndex], preferenceOrder) < 0) {
          schedules[existingIndex] = schedule;
          trimSchedulesToLimit();
        }

        return false;
      }

      schedules.push(schedule);
      scheduleIndexByVisibilityKey.set(visibilityKey, schedules.length - 1);
      if (schedules.length > limit) {
        trimSchedulesToLimit();
      }

      return false;
    }

    const group = eligibleGroups[index];
    const lockedPackageId = lockedByCourse.get(group.courseDesignation) ?? null;

    for (const candidate of group.candidates) {
      if (lockedPackageId && candidate.packageId !== lockedPackageId) {
        continue;
      }

      if (hasConflict(conflicts, candidate.packageId, selectedPackageIds)) {
        continue;
      }

      selectedCandidates.push(candidate);
      selectedPackageIds.add(candidate.packageId);
      visit(index + 1);
      selectedPackageIds.delete(candidate.packageId);
      selectedCandidates.pop();
    }

    return false;
  }

  if (limit === 0) {
    return [];
  }

  visit(0);
  trimSchedulesToLimit();
  return schedules.slice(0, limit);
}

/**
 * @typedef {object} ScheduleGenerationOptions
 * @property {string[]} courses
 * @property {string[]} [lockPackages]
 * @property {string[]} [excludePackages]
 * @property {string[]} [preferenceOrder]
 * @property {boolean} [includeWaitlisted]
 * @property {boolean} [includeClosed]
 * @property {number} [limit]
 * @property {number | null} [maxCampusDays]
 * @property {number | null} [startAfterMinuteLocal]
 * @property {number | null} [endBeforeMinuteLocal]
 */

/**
 * @typedef {object} ScheduleGenerationResult
 * @property {Array<Record<string, unknown>>} schedules
 * @property {'constraints' | 'hard-filters' | null} emptyStateReason
 */

/**
 * @param {unknown} db
 * @param {ScheduleGenerationOptions} options
 * @returns {ScheduleGenerationResult}
 */
export function generateSchedulesWithMetadata(
  db,
  {
    courses,
    lockPackages = [],
    excludePackages = [],
    preferenceOrder = DEFAULT_PREFERENCE_ORDER,
    includeWaitlisted = false,
    includeClosed = false,
    limit = DEFAULT_LIMIT,
    maxCampusDays = null,
    startAfterMinuteLocal = null,
    endBeforeMinuteLocal = null,
  },
) {
  if (!Array.isArray(courses) || courses.length === 0) {
    return {
      schedules: [],
      emptyStateReason: 'constraints',
    };
  }

  const excludedPackageIds = new Set(excludePackages);
  const candidateRows = loadCandidates(db, courses);
  const packageIds = [...new Set(candidateRows.map((row) => row.source_package_id))];
  const meetingsByPackageId = loadMeetings(db, packageIds);
  const { groups, candidatesById } = buildCandidateGroups(candidateRows, meetingsByPackageId, excludedPackageIds);
  const lockedByCourse = buildLockedByCourse(lockPackages, candidatesById);

  if (!lockedByCourse) {
    return {
      schedules: [],
      emptyStateReason: 'constraints',
    };
  }

  const requiredGroups = courses.map((courseDesignation) => ({
    courseDesignation,
    candidates: groups.get(courseDesignation) ?? [],
  }));
  if (requiredGroups.some((group) => group.candidates.length === 0)) {
    return {
      schedules: [],
      emptyStateReason: 'constraints',
    };
  }

  const orderedGroups = requiredGroups
    .map((group) => ({
      ...group,
      candidates: [...group.candidates].sort((left, right) => left.packageId.localeCompare(right.packageId)),
    }))
    .sort((left, right) => left.candidates.length - right.candidates.length || left.courseDesignation.localeCompare(right.courseDesignation));

  const activePackageIds = [...new Set(requiredGroups.flatMap((group) => group.candidates.map((candidate) => candidate.packageId)))];
  let preFilterScheduleCount = 0;
  const schedules = buildSchedules({
    orderedGroups,
    lockedByCourse,
    conflicts: deriveConflicts(meetingsByPackageId, activePackageIds),
    transitions: deriveTransitions(meetingsByPackageId, activePackageIds),
    preferenceOrder,
    includeWaitlisted,
    includeClosed,
    limit,
    maxCampusDays,
    startAfterMinuteLocal,
    endBeforeMinuteLocal,
    onScheduleBuilt: () => {
      preFilterScheduleCount += 1;
    },
  });

  return {
    schedules,
    emptyStateReason:
      schedules.length === 0 ? (preFilterScheduleCount > 0 ? 'hard-filters' : 'constraints') : null,
  };
}

/**
 * @param {unknown} db
 * @param {ScheduleGenerationOptions} options
 */
export function generateSchedules(db, options) {
  return generateSchedulesWithMetadata(db, options).schedules;
}
