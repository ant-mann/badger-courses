function toIntFlag(value) {
  return value ? 1 : 0;
}

function getPackageId(pkg) {
  return String(pkg.packageId ?? pkg.id);
}

function getPackageFreshness(pkg) {
  return {
    lastUpdated: pkg.lastUpdated ?? null,
    packageId: getPackageId(pkg),
  };
}

function isFresherPackageSource(candidate, current) {
  const candidateUpdated = candidate.lastUpdated ?? -1;
  const currentUpdated = current.lastUpdated ?? -1;

  if (candidateUpdated !== currentUpdated) {
    return candidateUpdated > currentUpdated;
  }

  return candidate.packageId > current.packageId;
}

function normalizeKeyPart(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  return normalized || null;
}

function getInstructorNameParts(instructor = {}) {
  return {
    firstName: normalizeKeyPart(instructor.name?.first ?? instructor.first_name),
    lastName: normalizeKeyPart(instructor.name?.last ?? instructor.last_name),
  };
}

function hashSyntheticSectionNumber(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return -((hash >>> 0) + 1);
}

function makeSyntheticSectionBaseSeed(pkg, section) {
  const courseId = normalizeKeyPart(section.courseId ?? pkg.courseId) ?? 'unknown-course';
  const termCode = normalizeKeyPart(section.classUniqueId?.termCode ?? pkg.termCode) ?? 'unknown-term';
  const sectionNumber = normalizeKeyPart(section.sectionNumber) ?? 'unknown-section';
  const sectionType = normalizeKeyPart(section.type) ?? 'unknown-type';
  const sessionCode = normalizeKeyPart(section.sessionCode) ?? 'unknown-session';

  return [
    termCode,
    courseId,
    sectionNumber,
    sectionType,
    sessionCode,
  ].join(':');
}

function getSectionClassNumbers(pkg) {
  const usedClassNumbers = new Set();
  const syntheticIdentityCounts = new Map();
  const syntheticSeedCounts = new Map();

  for (const section of pkg.sections ?? []) {
    if (section.classUniqueId?.classNumber != null) continue;

    const syntheticSeedBase = makeSyntheticSectionBaseSeed(pkg, section);
    syntheticIdentityCounts.set(
      syntheticSeedBase,
      (syntheticIdentityCounts.get(syntheticSeedBase) ?? 0) + 1,
    );
  }

  return (pkg.sections ?? []).map((section) => {
    const classNumber = section.classUniqueId?.classNumber;
    if (classNumber != null) {
      usedClassNumbers.add(classNumber);
      return classNumber;
    }

    const syntheticSeedBase = makeSyntheticSectionBaseSeed(pkg, section);
    const syntheticSeedCount = syntheticSeedCounts.get(syntheticSeedBase) ?? 0;
    syntheticSeedCounts.set(syntheticSeedBase, syntheticSeedCount + 1);

    const syntheticSeed =
      (syntheticIdentityCounts.get(syntheticSeedBase) ?? 0) > 1
        ? `${syntheticSeedBase}:package:${getPackageId(pkg)}:occurrence:${syntheticSeedCount}`
        : `${syntheticSeedBase}:occurrence:${syntheticSeedCount}`;
    let syntheticClassNumber = hashSyntheticSectionNumber(syntheticSeed);

    while (usedClassNumbers.has(syntheticClassNumber)) {
      syntheticClassNumber -= 1;
    }

    usedClassNumbers.add(syntheticClassNumber);
    return syntheticClassNumber;
  });
}

export function getInstructorIdentityTokens(instructor = {}) {
  const netid = normalizeKeyPart(instructor.netid);
  const email = normalizeKeyPart(instructor.email);
  const { firstName, lastName } = getInstructorNameParts(instructor);
  const tokens = [];

  if (netid) tokens.push(`netid:${netid}`);
  if (email) tokens.push(`email:${email}`);
  if (firstName || lastName) {
    tokens.push(`name:${firstName ?? ''}:${lastName ?? ''}`);
  }

  return tokens;
}

function getStrongInstructorIdentityTokens(tokens) {
  return [...tokens].filter((token) => token.startsWith('netid:') || token.startsWith('email:'));
}

export function makeInstructorKey(instructor, fallbackKey) {
  const [netidToken, emailToken, nameToken] = getInstructorIdentityTokens(instructor);
  return netidToken ?? emailToken ?? nameToken ?? fallbackKey;
}

export function mergeInstructorRecord(preferred, fallback) {
  if (preferred == null) return fallback ?? preferred;
  if (fallback == null) return preferred;

  const merged = { ...fallback, ...preferred };
  const firstName = preferred.name?.first ?? preferred.first_name ?? fallback.name?.first ?? fallback.first_name;
  const lastName = preferred.name?.last ?? preferred.last_name ?? fallback.name?.last ?? fallback.last_name;

  merged.netid = preferred.netid ?? fallback.netid ?? null;
  merged.email = preferred.email ?? fallback.email ?? null;

  if ('name' in preferred || 'name' in fallback) {
    merged.name = {};
    if (firstName != null) merged.name.first = firstName;
    if (lastName != null) merged.name.last = lastName;
    if (Object.keys(merged.name).length === 0) {
      delete merged.name;
    }
  } else {
    merged.first_name = firstName ?? null;
    merged.last_name = lastName ?? null;
  }

  return merged;
}

function hasSharedInstructorIdentity(leftTokens, rightTokens) {
  if (leftTokens.size === 0 || rightTokens.size === 0) return false;

  const leftStrongTokens = getStrongInstructorIdentityTokens(leftTokens);
  const rightStrongTokens = getStrongInstructorIdentityTokens(rightTokens);

  for (const token of leftStrongTokens) {
    if (rightTokens.has(token)) {
      return true;
    }
  }

  if (leftStrongTokens.length > 0 || rightStrongTokens.length > 0) {
    return false;
  }

  for (const token of leftTokens) {
    if (token.startsWith('name:') && rightTokens.has(token)) {
      return true;
    }
  }

  return false;
}

export function collapseInstructorIdentities(
  records,
  {
    fallbackKeyFactory = (_record, index) => `instructor:${index}`,
    mergeRecord = mergeInstructorRecord,
  } = {},
) {
  const groups = [];

  for (const [index, record] of (records ?? []).entries()) {
    let pendingGroup = {
      merged: record,
      members: [{ record, index }],
      tokens: new Set(getInstructorIdentityTokens(record)),
      fallbackKey: fallbackKeyFactory(record, index),
    };

    let mergedExistingGroup = true;
    while (mergedExistingGroup) {
      mergedExistingGroup = false;

      for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
        const group = groups[groupIndex];
        if (!hasSharedInstructorIdentity(pendingGroup.tokens, group.tokens)) continue;

        const mergedRecord = mergeRecord(pendingGroup.merged, group.merged);
        const mergedTokens = new Set([
          ...pendingGroup.tokens,
          ...group.tokens,
          ...getInstructorIdentityTokens(mergedRecord),
        ]);

        pendingGroup = {
          merged: mergedRecord,
          members: [...group.members, ...pendingGroup.members],
          tokens: mergedTokens,
          fallbackKey: pendingGroup.fallbackKey ?? group.fallbackKey,
        };
        groups.splice(groupIndex, 1);
        mergedExistingGroup = true;
        break;
      }
    }

    groups.push(pendingGroup);
  }

  return groups.map((group, index) => ({
    ...group,
    canonicalKey: makeInstructorKey(group.merged, group.fallbackKey ?? fallbackKeyFactory(group.merged, index)),
  }));
}

export function mergeInstructorRecords(preferredRecords = [], fallbackRecords = []) {
  return collapseInstructorIdentities(
    [...(fallbackRecords ?? []), ...(preferredRecords ?? [])],
    {
      fallbackKeyFactory: (_record, index) => `section-instructor:${index}`,
      mergeRecord: mergeInstructorRecord,
    },
  ).map((group) => group.merged);
}

export function summarizeAvailability(status = {}) {
  const openSeats = status.openSeats;
  const waitlistCurrentSize = status.waitlistCurrentSize;

  return {
    has_open_seats: openSeats == null ? null : toIntFlag(openSeats > 0),
    has_waitlist: waitlistCurrentSize == null ? null : toIntFlag(waitlistCurrentSize > 0),
    is_full: openSeats == null ? null : toIntFlag(openSeats <= 0),
  };
}

export function makeCourseRow(course) {
  return {
    term_code: course.termCode,
    course_id: course.courseId,
    subject_code: course.subject?.subjectCode ?? null,
    subject_short_description: course.subject?.shortDescription ?? null,
    subject_description: course.subject?.description ?? null,
    catalog_number: course.catalogNumber ?? null,
    course_designation: course.courseDesignation ?? null,
    title: course.title ?? null,
    description: course.description ?? null,
    minimum_credits: course.minimumCredits ?? null,
    maximum_credits: course.maximumCredits ?? null,
    enrollment_prerequisites: course.enrollmentPrerequisites ?? null,
    currently_taught: toIntFlag(course.currentlyTaught),
    last_taught: course.lastTaught ?? null,
  };
}

export function makePackageRow(pkg) {
  const summary = summarizeAvailability(pkg.enrollmentStatus ?? {});

  return {
    package_id: getPackageId(pkg),
    term_code: pkg.termCode,
    subject_code: pkg.subjectCode,
    course_id: pkg.courseId,
    package_last_updated: pkg.lastUpdated ?? null,
    enrollment_class_number: pkg.enrollmentClassNumber ?? null,
    package_status: pkg.packageEnrollmentStatus?.status ?? null,
    package_available_seats: pkg.packageEnrollmentStatus?.availableSeats ?? null,
    package_waitlist_total: pkg.packageEnrollmentStatus?.waitlistTotal ?? null,
    online_only: toIntFlag(pkg.onlineOnly),
    is_asynchronous: toIntFlag(pkg.isAsynchronous),
    open_seats: pkg.enrollmentStatus?.openSeats ?? null,
    waitlist_current_size: pkg.enrollmentStatus?.waitlistCurrentSize ?? null,
    capacity: pkg.enrollmentStatus?.capacity ?? null,
    currently_enrolled: pkg.enrollmentStatus?.currentlyEnrolled ?? null,
    ...summary,
  };
}

export function makeSectionRows(pkg) {
  const packageId = getPackageId(pkg);
  const sectionClassNumbers = getSectionClassNumbers(pkg);

  return (pkg.sections ?? []).map((section, sectionIndex) => ({
    package_id: packageId,
    section_class_number: sectionClassNumbers[sectionIndex],
    term_code: section.classUniqueId?.termCode ?? pkg.termCode,
    course_id: section.courseId ?? pkg.courseId,
    section_number: section.sectionNumber ?? null,
    section_type: section.type ?? null,
    instruction_mode: section.instructionMode ?? null,
    session_code: section.sessionCode ?? null,
    published: toIntFlag(section.published),
    open_seats: section.enrollmentStatus?.openSeats ?? null,
    waitlist_current_size: section.enrollmentStatus?.waitlistCurrentSize ?? null,
    capacity: section.enrollmentStatus?.capacity ?? null,
    currently_enrolled: section.enrollmentStatus?.currentlyEnrolled ?? null,
    ...summarizeAvailability(section.enrollmentStatus ?? {}),
  }));
}

export function makeMeetingRows(pkg) {
  const sectionClassNumbers = getSectionClassNumbers(pkg);

  return (pkg.sections ?? []).flatMap((section, sectionIndex) =>
    (section.classMeetings ?? []).map((meeting, index) => ({
      package_id: getPackageId(pkg),
      section_class_number: sectionClassNumbers[sectionIndex],
      meeting_index: index,
      meeting_type: meeting.meetingType ?? null,
      meeting_time_start: meeting.meetingTimeStart ?? null,
      meeting_time_end: meeting.meetingTimeEnd ?? null,
      meeting_days: meeting.meetingDays ?? null,
      start_date: meeting.startDate ?? null,
      end_date: meeting.endDate ?? null,
      exam_date: meeting.examDate ?? null,
      room: meeting.room ?? null,
      building_code: meeting.building?.buildingCode ?? null,
      building_name: meeting.building?.buildingName ?? null,
      street_address: meeting.building?.streetAddress ?? null,
      latitude: meeting.building?.latitude ?? null,
      longitude: meeting.building?.longitude ?? null,
      is_exam: toIntFlag(meeting.meetingType === 'EXAM'),
      location_known: toIntFlag(meeting.building?.latitude != null && meeting.building?.longitude != null),
    })),
  );
}

export function makeInstructorRows(pkg) {
  const packageId = getPackageId(pkg);
  const sectionClassNumbers = getSectionClassNumbers(pkg);

  return (pkg.sections ?? []).flatMap((section, sectionIndex) => {
    const sectionClassNumber = sectionClassNumbers[sectionIndex];
    const sourceInstructors =
      Array.isArray(section.instructors) && section.instructors.length > 0
        ? section.instructors
        : section.instructor
          ? [section.instructor]
          : [];

    return collapseInstructorIdentities(sourceInstructors, {
      fallbackKeyFactory: (_instructor, instructorIndex) =>
        `section:${packageId}:${sectionClassNumber ?? sectionIndex}:${instructorIndex}`,
      mergeRecord: mergeInstructorRecord,
    }).map(({ merged, canonicalKey }) => ({
      instructor_key: canonicalKey,
      netid: merged.netid ?? null,
      email: merged.email ?? null,
      first_name: merged.name?.first ?? merged.first_name ?? null,
      last_name: merged.name?.last ?? merged.last_name ?? null,
      package_id: packageId,
      section_class_number: sectionClassNumber,
    }));
  });
}

export function makeBuildingRows(packages) {
  const byCode = new Map();

  for (const pkg of packages) {
    const source = getPackageFreshness(pkg);

    for (const meeting of makeMeetingRows(pkg)) {
      if (!meeting.building_code) continue;
      const existing = byCode.get(meeting.building_code);
      if (!existing) {
        byCode.set(meeting.building_code, {
          building_code: meeting.building_code,
          building_name: meeting.building_name,
          street_address: meeting.street_address,
          latitude: meeting.latitude,
          longitude: meeting.longitude,
          _source: source,
        });
        continue;
      }

      const fromFresherSource = isFresherPackageSource(source, existing._source);

      if (fromFresherSource && meeting.building_name != null) {
        existing.building_name = meeting.building_name;
      } else {
        existing.building_name ??= meeting.building_name;
      }

      if (fromFresherSource && meeting.street_address != null) {
        existing.street_address = meeting.street_address;
      } else {
        existing.street_address ??= meeting.street_address;
      }

      if (fromFresherSource && meeting.latitude != null) {
        existing.latitude = meeting.latitude;
      } else {
        existing.latitude ??= meeting.latitude;
      }

      if (fromFresherSource && meeting.longitude != null) {
        existing.longitude = meeting.longitude;
      } else {
        existing.longitude ??= meeting.longitude;
      }

      if (fromFresherSource) {
        existing._source = source;
      }
    }
  }

  return [...byCode.values()].map(({ _source, ...building }) => building);
}

export function makePrerequisiteRuleRow(rule) {
  return {
    rule_id: rule.ruleId,
    term_code: rule.termCode,
    course_id: rule.courseId,
    raw_text: rule.rawText,
    parse_status: rule.parseStatus,
    parse_confidence: rule.parseConfidence,
    root_node_id: rule.rootNodeId ?? null,
    unparsed_text: rule.unparsedText ?? null,
  };
}

export function makePrerequisiteNodeRows(nodes = [], ruleId) {
  return nodes.map((node) => ({
    node_id: node.id,
    rule_id: ruleId,
    node_type: node.node_type,
    value: node.raw_value ?? null,
    normalized_value: node.normalized_value ?? null,
    position_start: null,
    position_end: null,
  }));
}

export function makePrerequisiteEdgeRows(edges = [], ruleId) {
  return edges.map((edge, index) => ({
    rule_id: ruleId,
    parent_node_id: edge.source,
    child_node_id: edge.target,
    sort_order: index,
  }));
}
