import { countBits, haversineMeters } from '../db/schedule-helpers.mjs';

export const DEFAULT_LIMIT = 25;
export const LARGE_IDLE_GAP_MINUTES = 90;
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
      if (!meetingsShareDateRange(dayMeetings[index], dayMeetings[index - 1])) {
        continue;
      }

      const gapMinutes = dayMeetings[index].start_minute_local - dayMeetings[index - 1].end_minute_local;
      if (gapMinutes >= LARGE_IDLE_GAP_MINUTES) {
        largeIdleGapCount += 1;
      }
    }
  }

  return largeIdleGapCount;
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
    tight_transition_count: tightTransitionCount,
    total_walking_distance_meters: totalWalkingDistanceMeters,
    total_open_seats: totalOpenSeats,
    latest_end_minute_local: latestEndMinuteLocal,
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

export function buildSchedules({
  orderedGroups,
  lockedByCourse,
  conflicts,
  transitions,
  preferenceOrder = DEFAULT_PREFERENCE_ORDER,
  limit,
}) {
  const schedules = [];
  const selectedCandidates = [];
  const selectedPackageIds = new Set();

  function visit(index) {
    if (index >= orderedGroups.length) {
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

      schedules.push({
        package_ids: packageIds,
        packages,
        conflict_count: 0,
        ...buildScheduleMetrics(selectedCandidates, transitions),
      });
      if (schedules.length > limit) {
        schedules.sort((left, right) => compareSchedules(left, right, preferenceOrder));
        schedules.length = limit;
      }

      return false;
    }

    const group = orderedGroups[index];
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
  schedules.sort((left, right) => compareSchedules(left, right, preferenceOrder));
  return schedules.slice(0, limit);
}

export function generateSchedules(
  db,
  {
    courses,
    lockPackages = [],
    excludePackages = [],
    preferenceOrder = DEFAULT_PREFERENCE_ORDER,
    limit = DEFAULT_LIMIT,
  },
) {
  if (!Array.isArray(courses) || courses.length === 0) {
    return [];
  }

  const excludedPackageIds = new Set(excludePackages);
  const candidateRows = loadCandidates(db, courses);
  const packageIds = [...new Set(candidateRows.map((row) => row.source_package_id))];
  const meetingsByPackageId = loadMeetings(db, packageIds);
  const { groups, candidatesById } = buildCandidateGroups(candidateRows, meetingsByPackageId, excludedPackageIds);
  const lockedByCourse = buildLockedByCourse(lockPackages, candidatesById);

  if (!lockedByCourse) {
    return [];
  }

  const requiredGroups = courses.map((courseDesignation) => ({
    courseDesignation,
    candidates: groups.get(courseDesignation) ?? [],
  }));
  if (requiredGroups.some((group) => group.candidates.length === 0)) {
    return [];
  }

  const orderedGroups = requiredGroups
    .map((group) => ({
      ...group,
      candidates: [...group.candidates].sort((left, right) => left.packageId.localeCompare(right.packageId)),
    }))
    .sort((left, right) => left.candidates.length - right.candidates.length || left.courseDesignation.localeCompare(right.courseDesignation));

  const activePackageIds = [...new Set(requiredGroups.flatMap((group) => group.candidates.map((candidate) => candidate.packageId)))];
  return buildSchedules({
    orderedGroups,
    lockedByCourse,
    conflicts: deriveConflicts(meetingsByPackageId, activePackageIds),
    transitions: deriveTransitions(meetingsByPackageId, activePackageIds),
    preferenceOrder,
    limit,
  });
}
