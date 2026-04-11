import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import {
  collapseInstructorIdentities,
  makeBuildingRows,
  makeCourseRow,
  makeInstructorRows,
  makeMeetingRows,
  makeInstructorKey,
  makePrerequisiteCourseSummaryRow,
  makePersistedPrerequisiteNodeId,
  makePackageRow,
  makePrerequisiteEdgeRows,
  makePrerequisiteNodeRows,
  makePrerequisiteRuleRow,
  mergeInstructorRecords,
  makeSectionRows,
} from './import-helpers.mjs';
import { PARSE_STATUS, parsePrerequisiteText } from './prerequisite-helpers.mjs';
import { summarizePrerequisiteForAi } from './prerequisite-summary-helpers.mjs';
import {
  SCHEDULE_TIMEZONE,
  countBits,
  deriveDurationMinutes,
  formatLocalDate,
  formatMinutesLocal,
  isOnlineInstructionMode,
  makeDaysMask,
  meetingTimeToMinutes,
  parseTemporaryRestrictionFlag,
  summarizeSchedulableMeetings,
} from './schedule-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const coursesPath = path.join(repoRoot, 'data', 'fall-2026-courses.json');
const packageSnapshotPath = path.join(repoRoot, 'data', 'fall-2026-enrollment-packages.json');
const dbPath = path.join(repoRoot, 'data', 'fall-2026.sqlite');
const schemaPath = path.join(__dirname, 'schema.sql');

function getPrerequisiteParseConfidence(parseStatus) {
  if (parseStatus === PARSE_STATUS.PARSED) return 1;
  if (parseStatus === PARSE_STATUS.PARTIAL) return 0.5;
  return 0;
}

function buildPrerequisiteRows(courseRows) {
  const rules = [];
  const summaries = [];
  const nodes = [];
  const edges = [];
  const rootUpdates = [];

  for (const courseRow of courseRows) {
    const rawText = courseRow.enrollment_prerequisites?.trim();
    if (!rawText) continue;

    const parsed = parsePrerequisiteText(rawText);
    const ruleId = `rule:${courseRow.term_code}:${courseRow.course_id}`;
    const rootNodeId =
      parsed.parseStatus === PARSE_STATUS.PARSED && parsed.nodes.length > 0
        ? parsed.nodes[0].id
        : null;

    rules.push(
      makePrerequisiteRuleRow({
        ruleId,
        termCode: courseRow.term_code,
        courseId: courseRow.course_id,
        rawText,
        parseStatus: parsed.parseStatus,
        parseConfidence: getPrerequisiteParseConfidence(parsed.parseStatus),
        rootNodeId,
        unparsedText: parsed.unparsedText,
      }),
    );
    summaries.push(
      makePrerequisiteCourseSummaryRow({
        ruleId,
        termCode: courseRow.term_code,
        courseId: courseRow.course_id,
        ...summarizePrerequisiteForAi(parsed, { rawText }),
      }),
    );
    nodes.push(...makePrerequisiteNodeRows(parsed.nodes, ruleId));
    edges.push(...makePrerequisiteEdgeRows(parsed.edges, ruleId));

    if (rootNodeId) {
      rootUpdates.push({
        rule_id: ruleId,
        root_node_id: makePersistedPrerequisiteNodeId(ruleId, rootNodeId),
      });
    }
  }

  return { rules, summaries, nodes, edges, rootUpdates };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function derivePackageId(pkg, entry, entryIndex, packageIndex) {
  const termCode = entry.course?.termCode ?? pkg.termCode ?? 'unknown-term';
  const subjectCode = entry.course?.subjectCode ?? pkg.subjectCode ?? 'unknown-subject';
  const courseId = entry.course?.courseId ?? pkg.courseId ?? 'unknown-course';
  const packageDiscriminator =
    pkg.id ?? pkg.enrollmentClassNumber ?? pkg.sequenceNumber ?? pkg.docId ?? `${entryIndex}-${packageIndex}`;

  return [termCode, subjectCode, courseId, packageDiscriminator].join(':');
}

function normalizePackageRecord(pkg, entry, entryIndex, packageIndex, defaultTermCode) {
  return {
    ...pkg,
    packageId: derivePackageId(pkg, entry, entryIndex, packageIndex),
    termCode: pkg.termCode ?? entry.course?.termCode ?? defaultTermCode ?? null,
    subjectCode: pkg.subjectCode ?? entry.course?.subjectCode ?? null,
    courseId: pkg.courseId ?? entry.course?.courseId ?? null,
  };
}

function isMissing(value) {
  return value == null;
}

function countDefinedValues(value) {
  if (value == null) return 0;
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countDefinedValues(item), value.length > 0 ? 1 : 0);
  }
  if (typeof value === 'object') {
    return Object.values(value).reduce(
      (total, item) => total + countDefinedValues(item),
      Object.keys(value).length > 0 ? 1 : 0,
    );
  }
  return 1;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item) ?? 'null').join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .flatMap((key) => {
        const serialized = stableStringify(value[key]);
        return serialized === undefined ? [] : [`${JSON.stringify(key)}:${serialized}`];
      })
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function comparePackageRecordPriority(left, right) {
  const updatedDelta = (left?.lastUpdated ?? Number.NEGATIVE_INFINITY) - (right?.lastUpdated ?? Number.NEGATIVE_INFINITY);
  if (updatedDelta !== 0) return updatedDelta;

  const definedValueDelta = countDefinedValues(left) - countDefinedValues(right);
  if (definedValueDelta !== 0) return definedValueDelta;

  return stableStringify(left).localeCompare(stableStringify(right));
}

function mergeUniqueArrays(preferred = [], fallback = [], getKey = (value, index) => `${index}:${JSON.stringify(value)}`) {
  const merged = new Map();

  for (const item of fallback ?? []) {
    merged.set(getKey(item, merged.size), item);
  }

  for (const item of preferred ?? []) {
    const key = getKey(item, merged.size);
    if (!merged.has(key)) {
      merged.set(key, item);
    } else {
      merged.set(key, item);
    }
  }

  return [...merged.values()];
}

function mergeObjects(preferred, fallback) {
  if (preferred == null) return fallback ?? preferred;
  if (fallback == null) return preferred;
  if (Array.isArray(preferred) || Array.isArray(fallback)) {
    return preferred;
  }
  if (typeof preferred !== 'object' || typeof fallback !== 'object') {
    return isMissing(preferred) ? fallback : preferred;
  }

  const merged = { ...fallback, ...preferred };
  for (const key of new Set([...Object.keys(fallback), ...Object.keys(preferred)])) {
    const preferredValue = preferred[key];
    const fallbackValue = fallback[key];

    if (Array.isArray(preferredValue) || Array.isArray(fallbackValue)) {
      merged[key] = Array.isArray(preferredValue) && preferredValue.length > 0 ? preferredValue : (fallbackValue ?? preferredValue);
      continue;
    }

    if (
      preferredValue &&
      fallbackValue &&
      typeof preferredValue === 'object' &&
      typeof fallbackValue === 'object'
    ) {
      merged[key] = mergeObjects(preferredValue, fallbackValue);
      continue;
    }

    merged[key] = isMissing(preferredValue) ? fallbackValue : preferredValue;
  }

  return merged;
}

function normalizeMeetingIdentityPart(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized || null;
  }
  return value;
}

function makeLogicalMeetingMergeKey(meeting) {
  const meetingType = normalizeMeetingIdentityPart(meeting?.meetingType);
  const meetingTimeStart = normalizeMeetingIdentityPart(meeting?.meetingTimeStart);
  const meetingTimeEnd = normalizeMeetingIdentityPart(meeting?.meetingTimeEnd);
  const meetingDays = normalizeMeetingIdentityPart(meeting?.meetingDays);
  const startDate = normalizeMeetingIdentityPart(meeting?.startDate);
  const endDate = normalizeMeetingIdentityPart(meeting?.endDate);
  const examDate = normalizeMeetingIdentityPart(meeting?.examDate);

  if (meetingType && examDate != null) {
    return ['exam', meetingType, examDate].join(':');
  }

  if (
    meetingType &&
    meetingTimeStart != null &&
    meetingTimeEnd != null &&
    meetingDays &&
    startDate != null &&
    endDate != null
  ) {
    return ['class', meetingType, meetingTimeStart, meetingTimeEnd, meetingDays, startDate, endDate].join(':');
  }

  return null;
}

function mapMeetingsByLogicalKey(meetings = [], excludeIndexes = new Set()) {
  const keyedMeetings = new Map();
  const ambiguousKeys = new Set();

  for (const [index, meeting] of meetings.entries()) {
    if (excludeIndexes.has(index)) continue;

    const key = makeLogicalMeetingMergeKey(meeting);
    if (!key) continue;
    if (keyedMeetings.has(key)) {
      keyedMeetings.delete(key);
      ambiguousKeys.add(key);
      continue;
    }
    if (!ambiguousKeys.has(key)) {
      keyedMeetings.set(key, { index, meeting });
    }
  }

  return keyedMeetings;
}

function mergeMeetingRecords(preferred, fallback) {
  return mergeObjects(preferred, fallback);
}

function mergeMeetingArrays(preferred = [], fallback = []) {
  const matchedFallbackByPreferredIndex = new Map();
  const matchedFallbackIndexes = new Set();
  const preferredByKey = mapMeetingsByLogicalKey(preferred);
  const fallbackByKey = mapMeetingsByLogicalKey(fallback);

  for (const [key, preferredEntry] of preferredByKey) {
    const fallbackEntry = fallbackByKey.get(key);
    if (!fallbackEntry) continue;

    matchedFallbackByPreferredIndex.set(preferredEntry.index, fallbackEntry.meeting);
    matchedFallbackIndexes.add(fallbackEntry.index);
  }

  const mergedMeetings = preferred.map((meeting, index) => {
    const fallbackMeeting = matchedFallbackByPreferredIndex.get(index);
    return fallbackMeeting ? mergeMeetingRecords(meeting, fallbackMeeting) : meeting;
  });

  for (const [index, meeting] of fallback.entries()) {
    if (!matchedFallbackIndexes.has(index)) {
      mergedMeetings.push(meeting);
    }
  }

  return mergedMeetings;
}

function mergeSectionRecords(preferred, fallback) {
  const merged = mergeObjects(preferred, fallback);
  const preferredInstructors =
    Array.isArray(preferred.instructors) && preferred.instructors.length > 0
      ? preferred.instructors
      : preferred.instructor
        ? [preferred.instructor]
        : [];
  const fallbackInstructors =
    Array.isArray(fallback.instructors) && fallback.instructors.length > 0
      ? fallback.instructors
      : fallback.instructor
        ? [fallback.instructor]
        : [];

  merged.classMeetings = mergeMeetingArrays(preferred.classMeetings, fallback.classMeetings);
  merged.instructors = mergeInstructorRecords(preferredInstructors, fallbackInstructors);
  merged.classMaterials = mergeUniqueArrays(
    preferred.classMaterials,
    fallback.classMaterials,
    (material, index) => material?.classUniqueId?.classNumber ?? `material:${index}`,
  );

  merged.instructor = merged.instructors[0] ?? null;

  return merged;
}

function normalizeSectionIdentityPart(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  return normalized || null;
}

function getPackageCourseScope(pkg) {
  const packageId = normalizeSectionIdentityPart(pkg?.packageId);
  const packageIdParts = packageId?.split(':') ?? [];
  const packageTermCode = packageIdParts[0] ?? null;
  const packageCourseId = packageIdParts[2] ?? null;
  const termCode = normalizeSectionIdentityPart(pkg?.termCode) ?? packageTermCode;
  const courseId = normalizeSectionIdentityPart(pkg?.courseId) ?? packageCourseId;

  if (!termCode && !courseId) return packageId ? `package:${packageId}` : null;
  return `${termCode ?? ''}:${courseId ?? ''}`;
}

function getSectionCourseScope(section, pkg) {
  const termCode = normalizeSectionIdentityPart(
    section?.classUniqueId?.termCode ?? section?.termCode,
  );
  const courseId = normalizeSectionIdentityPart(section?.courseId);
  const packageCourseScope = getPackageCourseScope(pkg);

  if (!termCode && !courseId) return packageCourseScope;

  const [packageTermCode = '', packageCourseId = ''] = packageCourseScope?.split(':') ?? [];
  return `${termCode ?? packageTermCode}:${courseId ?? packageCourseId}`;
}

function makeSectionMergeKey(
  section,
  pkg,
  strategy,
  { allowRealClassNumberForIdentity = false } = {},
) {
  const classNumber = section?.classUniqueId?.classNumber;
  if (strategy === 'class-number') {
    if (classNumber == null) return null;
    return `class-number:${classNumber}`;
  }

  if (classNumber != null && !allowRealClassNumberForIdentity) return null;

  const courseScope = getSectionCourseScope(section, pkg);
  if (!courseScope) return null;

  const sectionNumber = normalizeSectionIdentityPart(section?.sectionNumber);
  const type = normalizeSectionIdentityPart(section?.type);
  const sessionCode = normalizeSectionIdentityPart(section?.sessionCode);

  if (strategy === 'identity:full') {
    if (!sectionNumber || !type || !sessionCode) return null;
    return ['identity', courseScope, sectionNumber, type, sessionCode].join(':');
  }

  if (strategy === 'identity:section-type') {
    if (!sectionNumber || !type) return null;
    return ['identity', courseScope, 'section-type', sectionNumber, type].join(':');
  }

  if (strategy === 'identity:section-session') {
    if (!sectionNumber || !sessionCode) return null;
    return ['identity', courseScope, 'section-session', sectionNumber, sessionCode].join(':');
  }

  return null;
}

function reuseRealClassNumbersForMatchingSections(packages = []) {
  const groupsByKey = new Map();

  for (const [packageIndex, pkg] of packages.entries()) {
    for (const [sectionIndex, section] of (pkg.sections ?? []).entries()) {
      const key = makeSectionMergeKey(section, pkg, 'identity:full', {
        allowRealClassNumberForIdentity: true,
      });
      if (!key) continue;

      let group = groupsByKey.get(key);
      if (!group) {
        group = {
          entries: [],
          realClassNumbers: new Set(),
          packageSectionCounts: new Map(),
        };
        groupsByKey.set(key, group);
      }

      group.entries.push({ packageIndex, sectionIndex, section });
      group.packageSectionCounts.set(packageIndex, (group.packageSectionCounts.get(packageIndex) ?? 0) + 1);

      const classNumber = section?.classUniqueId?.classNumber;
      if (classNumber != null) {
        group.realClassNumbers.add(classNumber);
      }
    }
  }

  for (const group of groupsByKey.values()) {
    if (group.realClassNumbers.size !== 1) continue;
    if (![...group.packageSectionCounts.values()].every((count) => count === 1)) continue;

    const realClassNumber = [...group.realClassNumbers][0];
    let hasMissingClassNumber = false;
    let hasRealClassNumber = false;

    for (const entry of group.entries) {
      const classNumber = entry.section?.classUniqueId?.classNumber;
      if (classNumber == null) {
        hasMissingClassNumber = true;
      } else if (classNumber === realClassNumber) {
        hasRealClassNumber = true;
      }
    }

    if (!hasMissingClassNumber || !hasRealClassNumber) continue;

    for (const entry of group.entries) {
      if (entry.section?.classUniqueId?.classNumber != null) continue;
      entry.section.classUniqueId = {
        ...(entry.section.classUniqueId ?? {}),
        classNumber: realClassNumber,
      };
    }
  }
}

function mapSectionsByStableKey(sections = [], pkg, strategy, excludeIndexes = new Set()) {
  const keyedSections = new Map();
  const ambiguousKeys = new Set();

  for (const [index, section] of sections.entries()) {
    if (excludeIndexes.has(index)) continue;

    const key = makeSectionMergeKey(section, pkg, strategy);
    if (!key) continue;
    if (keyedSections.has(key)) {
      keyedSections.delete(key);
      ambiguousKeys.add(key);
      continue;
    }
    if (!ambiguousKeys.has(key)) {
      keyedSections.set(key, { index, section });
    }
  }

  return keyedSections;
}

function matchSectionsByStableIdentity(
  preferredSections = [],
  preferredPackage,
  fallbackSections = [],
  fallbackPackage,
) {
  const matchedFallbackByPreferredIndex = new Map();
  const matchedFallbackIndexes = new Set();
  const strategies = [
    'class-number',
    'identity:full',
    'identity:section-type',
    'identity:section-session',
  ];

  for (const strategy of strategies) {
    const preferredByKey = mapSectionsByStableKey(
      preferredSections,
      preferredPackage,
      strategy,
      new Set(matchedFallbackByPreferredIndex.keys()),
    );
    const fallbackByKey = mapSectionsByStableKey(
      fallbackSections,
      fallbackPackage,
      strategy,
      matchedFallbackIndexes,
    );

    for (const [key, preferredEntry] of preferredByKey) {
      const fallbackEntry = fallbackByKey.get(key);
      if (!fallbackEntry) continue;

      matchedFallbackByPreferredIndex.set(preferredEntry.index, fallbackEntry.section);
      matchedFallbackIndexes.add(fallbackEntry.index);
    }
  }

  return matchedFallbackByPreferredIndex;
}

export function mergePackageRecords(existing, incoming) {
  const preferred = comparePackageRecordPriority(incoming, existing) > 0 ? incoming : existing;
  const fallback = preferred === incoming ? existing : incoming;
  const merged = mergeObjects(preferred, fallback);
  const fallbackSectionsByPreferredIndex = matchSectionsByStableIdentity(
    preferred.sections,
    preferred,
    fallback.sections,
    fallback,
  );

  merged.sections = (preferred.sections ?? []).map((section, index) => {
    const fallbackSection = fallbackSectionsByPreferredIndex.get(index);
    return fallbackSection ? mergeSectionRecords(section, fallbackSection) : section;
  });
  merged.classMeetings = mergeMeetingArrays(preferred.classMeetings, fallback.classMeetings);
  merged.nestedClassMeetings = mergeMeetingArrays(
    preferred.nestedClassMeetings,
    fallback.nestedClassMeetings,
  );
  merged.modesOfInstruction = mergeUniqueArrays(
    preferred.modesOfInstruction,
    fallback.modesOfInstruction,
    (value, index) => `${value ?? ''}:${index}`,
  );

  return merged;
}

function uniqueRows(rows, getKey) {
  const byKey = new Map();

  for (const row of rows) {
    const key = getKey(row);
    if (!byKey.has(key)) {
      byKey.set(key, row);
    }
  }

  return [...byKey.values()];
}

function toIsoString(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === 'string' && value) {
    return value;
  }

  return fallback;
}

function makeCourseIdentityKey(course) {
  const termCode = course?.termCode ?? course?.term_code;
  const courseId = course?.courseId ?? course?.course_id;
  if (!termCode || !courseId) return null;
  return `${termCode}:${courseId}`;
}

function pickPreferredPackageMetadata(packages = []) {
  return (packages ?? []).reduce((preferred, candidate) => {
    if (!preferred) return candidate;
    return comparePackageRecordPriority(candidate, preferred) > 0 ? candidate : preferred;
  }, null);
}

function synthesizeCourseFromPackageEntry(entry, defaultTermCode) {
  const packageMetadata = pickPreferredPackageMetadata(entry?.packages);
  const course = entry?.course ?? {};
  const termCode = course.termCode ?? packageMetadata?.termCode ?? defaultTermCode ?? null;
  const courseId = course.courseId ?? packageMetadata?.courseId ?? null;

  if (!termCode || !courseId) return null;

  return {
    termCode,
    courseId,
    catalogNumber: course.catalogNumber ?? packageMetadata?.catalogNumber ?? null,
    courseDesignation: course.courseDesignation ?? packageMetadata?.courseDesignation ?? null,
    title: course.title ?? packageMetadata?.title ?? null,
    description: course.description ?? packageMetadata?.description ?? null,
    minimumCredits: course.minimumCredits ?? null,
    maximumCredits: course.maximumCredits ?? null,
    enrollmentPrerequisites: course.enrollmentPrerequisites ?? null,
    currentlyTaught: course.currentlyTaught ?? true,
    lastTaught: course.lastTaught ?? null,
    subject: {
      subjectCode:
        course.subjectCode ??
        course.subject?.subjectCode ??
        packageMetadata?.subjectCode ??
        packageMetadata?.subject?.subjectCode ??
        null,
      shortDescription: course.subject?.shortDescription ?? packageMetadata?.subject?.shortDescription ?? null,
      description: course.subject?.description ?? packageMetadata?.subject?.description ?? null,
    },
  };
}

function normalizeTextList(values) {
  return (values ?? [])
    .flatMap((value) => {
      if (typeof value === 'string') return [value.trim()];
      if (value == null) return [];
      return [String(value).trim()];
    })
    .filter(Boolean);
}

function collectRestrictionNotesForPackage(pkg, courseByKey) {
  const course = courseByKey.get(`${pkg.termCode}:${pkg.courseId}`);
  const notes = new Set();

  for (const note of normalizeTextList([course?.enrollmentPrerequisites])) {
    notes.add(note);
  }

  for (const note of normalizeTextList(course?.subject?.footnotes)) {
    notes.add(note);
  }

  for (const group of pkg.enrollmentRequirementGroups?.catalogRequirementGroups ?? []) {
    for (const note of normalizeTextList([group?.description])) {
      notes.add(note);
    }
  }

  for (const group of pkg.enrollmentRequirementGroups?.classAssociationRequirementGroups ?? []) {
    for (const note of normalizeTextList([group?.description])) {
      notes.add(note);
    }
  }

  for (const section of pkg.sections ?? []) {
    for (const note of normalizeTextList(section?.footnotes)) {
      notes.add(note);
    }

    for (const note of normalizeTextList(section?.subject?.footnotes)) {
      notes.add(note);
    }

    for (const material of section?.classMaterials ?? []) {
      for (const note of normalizeTextList([material?.sectionNotes])) {
        notes.add(note);
      }
    }
  }

  for (const detailField of ['instructorDescription', 'typicalTopicsAndOrSchedule', 'format']) {
    for (const note of normalizeTextList([pkg.instructorProvidedClassDetails?.[detailField]])) {
      notes.add(note);
    }
  }

  return [...notes].join(' | ') || null;
}

function makeSectionBundleLabel(pkg, courseByKey) {
  const sectionTypeOrder = new Map([
    ['LEC', 0],
    ['SEM', 1],
    ['LAB', 2],
    ['DIS', 3],
    ['QUIZ', 4],
  ]);
  const course = courseByKey.get(`${pkg.termCode}:${pkg.courseId}`);
  const designation = course?.courseDesignation ?? pkg.courseDesignation ?? `${pkg.subjectCode ?? ''} ${pkg.courseId ?? ''}`.trim();
  const bundle = (pkg.sections ?? [])
    .map((section) => ({
      sectionType: section.type ?? 'SEC',
      sectionNumber: section.sectionNumber ?? '???',
      sectionClassNumber: section.classUniqueId?.classNumber ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) => {
      const leftTypeOrder = sectionTypeOrder.get(left.sectionType) ?? 99;
      const rightTypeOrder = sectionTypeOrder.get(right.sectionType) ?? 99;
      if (leftTypeOrder !== rightTypeOrder) return leftTypeOrder - rightTypeOrder;

      const typeCompare = left.sectionType.localeCompare(right.sectionType);
      if (typeCompare !== 0) {
        return typeCompare;
      }

      const numberCompare = left.sectionNumber.localeCompare(right.sectionNumber, undefined, { numeric: true });
      if (numberCompare !== 0) return numberCompare;
      return left.sectionClassNumber - right.sectionClassNumber;
    })
    .map((section) => `${section.sectionType} ${section.sectionNumber}`)
    .join(' + ');

  return bundle ? `${designation} ${bundle}` : designation;
}

function buildPackageMetadata(mergedPackageRecords, courseRecordsByKey) {
  const metadata = new Map();

  for (const pkg of mergedPackageRecords) {
    const restrictionNote = collectRestrictionNotesForPackage(pkg, courseRecordsByKey);
    metadata.set(pkg.packageId, {
      restriction_note: restrictionNote,
      has_temporary_restriction: parseTemporaryRestrictionFlag(restrictionNote),
      section_bundle_label: makeSectionBundleLabel(pkg, courseRecordsByKey),
    });
  }

  return metadata;
}

function materializeCanonicalSections(db) {
  db.prepare(`
    INSERT INTO canonical_sections (
      term_code,
      subject_code,
      catalog_number,
      course_id,
      course_designation,
      title,
      minimum_credits,
      maximum_credits,
      section_class_number,
      source_package_id,
      source_package_last_updated,
      section_number,
      section_type,
      instruction_mode,
      session_code,
      open_seats,
      waitlist_current_size,
      capacity,
      currently_enrolled,
      has_open_seats,
      has_waitlist,
      is_full
    )
    SELECT
      so.term_code,
      so.subject_code,
      so.catalog_number,
      so.course_id,
      so.course_designation,
      so.title,
      c.minimum_credits,
      c.maximum_credits,
      so.section_class_number,
      so.source_package_id,
      so.source_package_last_updated,
      so.section_number,
      so.section_type,
      so.instruction_mode,
      so.session_code,
      so.open_seats,
      so.waitlist_current_size,
      so.capacity,
      so.currently_enrolled,
      so.has_open_seats,
      so.has_waitlist,
      so.is_full
    FROM section_overview_v so
    JOIN courses c
      ON c.term_code = so.term_code
     AND c.course_id = so.course_id
  `).run();
}

function buildCanonicalMeetingRows(db) {
  const rows = db.prepare(`
    SELECT
      s.package_id,
      cs.source_package_id,
      cs.section_class_number,
      m.meeting_index,
      m.meeting_type,
      m.meeting_time_start,
      m.meeting_time_end,
      m.meeting_days,
      m.start_date,
      m.end_date,
      m.exam_date,
      m.room,
      m.building_code,
      b.building_name,
      b.street_address,
      b.latitude,
      b.longitude,
      m.location_known,
      s.instruction_mode
    FROM canonical_sections cs
    JOIN sections s
      ON s.term_code = cs.term_code
     AND s.course_id = cs.course_id
     AND s.section_class_number = cs.section_class_number
    JOIN meetings m
      ON m.package_id = s.package_id
     AND m.section_class_number = cs.section_class_number
    LEFT JOIN buildings b
      ON b.building_code = m.building_code
    ORDER BY s.package_id, cs.section_class_number, m.meeting_index
  `).all();

  return rows.map((row) => {
    const startMinute = meetingTimeToMinutes(row.meeting_time_start);
    const endMinute = meetingTimeToMinutes(row.meeting_time_end);
    const isOnline = Number(isOnlineInstructionMode(row.instruction_mode));

    return {
      ...row,
      timezone_name: SCHEDULE_TIMEZONE,
      days_mask: makeDaysMask(row.meeting_days),
      start_minute_local: startMinute,
      end_minute_local: endMinute,
      duration_minutes: deriveDurationMinutes(startMinute, endMinute),
      is_online: isOnline,
    };
  });
}

function materializeCanonicalMeetings(db) {
  const insertCanonicalMeeting = db.prepare(`
    INSERT INTO canonical_meetings (
      package_id,
      source_package_id,
      section_class_number,
      meeting_index,
      meeting_type,
      meeting_time_start,
      meeting_time_end,
      meeting_days,
      start_date,
      end_date,
      exam_date,
      room,
      building_code,
      building_name,
      street_address,
      latitude,
      longitude,
      timezone_name,
      days_mask,
      start_minute_local,
      end_minute_local,
      duration_minutes,
      is_online,
      location_known
    ) VALUES (
      @package_id,
      @source_package_id,
      @section_class_number,
      @meeting_index,
      @meeting_type,
      @meeting_time_start,
      @meeting_time_end,
      @meeting_days,
      @start_date,
      @end_date,
      @exam_date,
      @room,
      @building_code,
      @building_name,
      @street_address,
      @latitude,
      @longitude,
      @timezone_name,
      @days_mask,
      @start_minute_local,
      @end_minute_local,
      @duration_minutes,
      @is_online,
      @location_known
    )
  `);

  for (const row of buildCanonicalMeetingRows(db)) {
    insertCanonicalMeeting.run(row);
  }
}

function buildSchedulablePackageRows(db, packageMetadata) {
  const packageRows = db.prepare(`
    SELECT
      p.package_id AS source_package_id,
      p.term_code,
      p.course_id,
      c.course_designation,
      c.title,
      p.open_seats,
      p.is_full,
      p.has_waitlist
    FROM packages p
    JOIN courses c
      ON c.term_code = p.term_code
     AND c.course_id = p.course_id
    ORDER BY p.package_id
  `).all();

  const meetingsByPackage = db.prepare(`
    SELECT *
    FROM canonical_meetings
    ORDER BY package_id, meeting_index
  `).all().reduce((grouped, meeting) => {
    const rows = grouped.get(meeting.package_id) ?? [];
    rows.push(meeting);
    grouped.set(meeting.package_id, rows);
    return grouped;
  }, new Map());

  return packageRows.map((row) => {
    const meetings = meetingsByPackage.get(row.source_package_id) ?? [];
    const classMeetings = meetings.filter((meeting) => meeting.meeting_type === 'CLASS');
    const scheduledMeetings = classMeetings.filter(
      (meeting) => meeting.days_mask != null && meeting.start_minute_local != null && meeting.end_minute_local != null,
    );
    const campusMeetings = scheduledMeetings.filter((meeting) => meeting.is_online !== 1);
    const combinedMask = campusMeetings.reduce((mask, meeting) => mask | meeting.days_mask, 0);
    const metadata = packageMetadata.get(row.source_package_id) ?? {
      restriction_note: null,
      has_temporary_restriction: 0,
      section_bundle_label: `${row.course_designation ?? row.course_id} package`,
    };

    return {
      source_package_id: row.source_package_id,
      term_code: row.term_code,
      course_id: row.course_id,
      course_designation: row.course_designation,
      title: row.title,
      section_bundle_label: metadata.section_bundle_label,
      open_seats: row.open_seats,
      is_full: row.is_full,
      has_waitlist: row.has_waitlist,
      meeting_count: classMeetings.length,
      campus_day_count: countBits(combinedMask),
      earliest_start_minute_local:
        scheduledMeetings.length > 0
          ? Math.min(...scheduledMeetings.map((meeting) => meeting.start_minute_local))
          : null,
      latest_end_minute_local:
        scheduledMeetings.length > 0
          ? Math.max(...scheduledMeetings.map((meeting) => meeting.end_minute_local))
          : null,
      has_online_meeting: Number(classMeetings.some((meeting) => meeting.is_online === 1)),
      has_unknown_location: Number(classMeetings.some((meeting) => meeting.is_online !== 1 && meeting.location_known !== 1)),
      restriction_note: metadata.restriction_note,
      has_temporary_restriction: metadata.has_temporary_restriction,
      meeting_summary_local: summarizeSchedulableMeetings(scheduledMeetings),
    };
  });
}

function materializeSchedulablePackages(db, packageMetadata) {
  const insertSchedulablePackage = db.prepare(`
    INSERT INTO schedulable_packages (
      source_package_id,
      term_code,
      course_id,
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
    ) VALUES (
      @source_package_id,
      @term_code,
      @course_id,
      @course_designation,
      @title,
      @section_bundle_label,
      @open_seats,
      @is_full,
      @has_waitlist,
      @meeting_count,
      @campus_day_count,
      @earliest_start_minute_local,
      @latest_end_minute_local,
      @has_online_meeting,
      @has_unknown_location,
      @restriction_note,
      @has_temporary_restriction,
      @meeting_summary_local
    )
  `);

  for (const row of buildSchedulablePackageRows(db, packageMetadata)) {
    insertSchedulablePackage.run(row);
  }
}

function materializeScheduleReadModel(db, packageMetadata) {
  materializeCanonicalSections(db);
  materializeCanonicalMeetings(db);
  materializeSchedulablePackages(db, packageMetadata);
}

export function buildCourseDatabase({
  sourceCoursesPath = coursesPath,
  sourcePackageSnapshotPath = packageSnapshotPath,
  outputDbPath = dbPath,
  sourceSchemaPath = schemaPath,
} = {}) {
  const courses = readJson(sourceCoursesPath);
  const packageSnapshot = readJson(sourcePackageSnapshotPath);
  const schemaSql = fs.readFileSync(sourceSchemaPath, 'utf8');

  const packageRecords = (packageSnapshot.results ?? []).flatMap((entry, entryIndex) =>
    (entry.packages ?? []).map((pkg, packageIndex) =>
      normalizePackageRecord(pkg, entry, entryIndex, packageIndex, packageSnapshot.termCode),
    ),
  );
  reuseRealClassNumbersForMatchingSections(packageRecords);
  const mergedPackageRecords = [...packageRecords.reduce((byId, pkg) => {
    const existing = byId.get(pkg.packageId);
    byId.set(pkg.packageId, existing ? mergePackageRecords(existing, pkg) : pkg);
    return byId;
  }, new Map()).values()];

  const courseRecordsByKey = new Map(
    courses
      .map((course) => [makeCourseIdentityKey(course), course])
      .filter(([key]) => key != null),
  );
  for (const entry of packageSnapshot.results ?? []) {
    const synthesizedCourse = synthesizeCourseFromPackageEntry(entry, packageSnapshot.termCode);
    const courseKey = makeCourseIdentityKey(synthesizedCourse);
    if (!courseKey || courseRecordsByKey.has(courseKey)) continue;
    courseRecordsByKey.set(courseKey, synthesizedCourse);
  }

  const courseRows = uniqueRows(
    [...courseRecordsByKey.values()].map(makeCourseRow),
    (row) => `${row.term_code}:${row.course_id}`,
  );
  const packageRows = mergedPackageRecords.map(makePackageRow);
  const sectionRows = uniqueRows(
    mergedPackageRecords.flatMap(makeSectionRows),
    (row) => `${row.package_id}:${row.section_class_number}`,
  );
  const meetingRows = uniqueRows(
    mergedPackageRecords.flatMap(makeMeetingRows),
    (row) => `${row.package_id}:${row.section_class_number}:${row.meeting_index}`,
  );
  const buildingRows = makeBuildingRows(mergedPackageRecords);
  const instructorRows = mergedPackageRecords.flatMap(makeInstructorRows);
  const collapsedInstructorRows = collapseInstructorIdentities(instructorRows, {
    fallbackKeyFactory: (row, index) => row.instructor_key ?? `instructor-row:${index}`,
    mergeRecord: (preferred, fallback) => ({
      ...fallback,
      ...preferred,
      instructor_key: preferred.instructor_key ?? fallback.instructor_key,
      netid: preferred.netid ?? fallback.netid ?? null,
      email: preferred.email ?? fallback.email ?? null,
      first_name: preferred.first_name ?? fallback.first_name ?? null,
      last_name: preferred.last_name ?? fallback.last_name ?? null,
      package_id: preferred.package_id ?? fallback.package_id,
      section_class_number: preferred.section_class_number ?? fallback.section_class_number,
    }),
  });
  const instructorKeyAliases = new Map();
  for (const group of collapsedInstructorRows) {
    const canonicalKey = makeInstructorKey(group.merged, group.canonicalKey);
    for (const member of group.members) {
      instructorKeyAliases.set(member.record.instructor_key, canonicalKey);
    }
  }
  const uniqueInstructorRows = collapsedInstructorRows.map((group) => ({
    instructor_key: makeInstructorKey(group.merged, group.canonicalKey),
    netid: group.merged.netid ?? null,
    email: group.merged.email ?? null,
    first_name: group.merged.first_name ?? null,
    last_name: group.merged.last_name ?? null,
  }));
  const sectionInstructorRows = uniqueRows(
    instructorRows.map((row) => ({
      package_id: row.package_id,
      section_class_number: row.section_class_number,
      instructor_key: instructorKeyAliases.get(row.instructor_key) ?? row.instructor_key,
    })),
    (row) => `${row.package_id}:${row.section_class_number}:${row.instructor_key}`,
  );

  const allTimestamps = [
    ...courses.map((course) => course.lastUpdated).filter((value) => typeof value === 'number'),
    ...mergedPackageRecords.map((pkg) => pkg.lastUpdated).filter((value) => typeof value === 'number'),
  ];
  const snapshotRunAt = toIsoString(
    allTimestamps.length > 0 ? Math.max(...allTimestamps) : null,
    new Date().toISOString(),
  );
  const sourceTermCode = packageSnapshot.termCode ?? courses[0]?.termCode ?? mergedPackageRecords[0]?.termCode ?? 'unknown';
  const packageMetadata = buildPackageMetadata(mergedPackageRecords, courseRecordsByKey);
  const prerequisiteRows = buildPrerequisiteRows(courseRows);

  fs.mkdirSync(path.dirname(outputDbPath), { recursive: true });

  const db = new Database(outputDbPath);

  try {
    db.exec(schemaSql);

    const insertCourse = db.prepare(`
    INSERT INTO courses (
      term_code, course_id, subject_code, subject_short_description, subject_description,
      catalog_number, course_designation, title, description, minimum_credits,
      maximum_credits, enrollment_prerequisites, currently_taught, last_taught
    ) VALUES (
      @term_code, @course_id, @subject_code, @subject_short_description, @subject_description,
      @catalog_number, @course_designation, @title, @description, @minimum_credits,
      @maximum_credits, @enrollment_prerequisites, @currently_taught, @last_taught
    )
    `);
    const insertPackage = db.prepare(`
    INSERT INTO packages (
      package_id, term_code, subject_code, course_id, package_last_updated, enrollment_class_number,
      package_status, package_available_seats, package_waitlist_total, online_only,
      is_asynchronous, open_seats, waitlist_current_size, capacity, currently_enrolled,
      has_open_seats, has_waitlist, is_full
    ) VALUES (
      @package_id, @term_code, @subject_code, @course_id, @package_last_updated, @enrollment_class_number,
      @package_status, @package_available_seats, @package_waitlist_total, @online_only,
      @is_asynchronous, @open_seats, @waitlist_current_size, @capacity, @currently_enrolled,
      @has_open_seats, @has_waitlist, @is_full
    )
    `);
    const insertSection = db.prepare(`
    INSERT INTO sections (
      package_id, section_class_number, term_code, course_id, section_number,
      section_type, instruction_mode, session_code, published, open_seats,
      waitlist_current_size, capacity, currently_enrolled, has_open_seats,
      has_waitlist, is_full
    ) VALUES (
      @package_id, @section_class_number, @term_code, @course_id, @section_number,
      @section_type, @instruction_mode, @session_code, @published, @open_seats,
      @waitlist_current_size, @capacity, @currently_enrolled, @has_open_seats,
      @has_waitlist, @is_full
    )
    `);
    const insertBuilding = db.prepare(`
    INSERT INTO buildings (
      building_code, building_name, street_address, latitude, longitude
    ) VALUES (
      @building_code, @building_name, @street_address, @latitude, @longitude
    )
    `);
    const insertMeeting = db.prepare(`
    INSERT INTO meetings (
      package_id, section_class_number, meeting_index, meeting_type, meeting_time_start,
      meeting_time_end, meeting_days, start_date, end_date, exam_date,
      room, building_code, is_exam, location_known
    ) VALUES (
      @package_id, @section_class_number, @meeting_index, @meeting_type, @meeting_time_start,
      @meeting_time_end, @meeting_days, @start_date, @end_date, @exam_date,
      @room, @building_code, @is_exam, @location_known
    )
    `);
    const insertInstructor = db.prepare(`
    INSERT INTO instructors (
      instructor_key, netid, email, first_name, last_name
    ) VALUES (
      @instructor_key, @netid, @email, @first_name, @last_name
    )
    `);
    const insertSectionInstructor = db.prepare(`
    INSERT INTO section_instructors (
      package_id, section_class_number, instructor_key
    ) VALUES (
      @package_id, @section_class_number, @instructor_key
    )
    `);
    const insertRefreshRun = db.prepare(`
    INSERT INTO refresh_runs (
      snapshot_run_at, last_refreshed_at, source_term_code, snapshot_kind
    ) VALUES (
      @snapshot_run_at, @last_refreshed_at, @source_term_code, @snapshot_kind
    )
    `);
    const insertPrerequisiteRule = db.prepare(`
    INSERT INTO prerequisite_rules (
      rule_id, term_code, course_id, raw_text, parse_status,
      parse_confidence, root_node_id, unparsed_text
    ) VALUES (
      @rule_id, @term_code, @course_id, @raw_text, @parse_status,
      @parse_confidence, @root_node_id, @unparsed_text
    )
    `);
    const insertPrerequisiteNode = db.prepare(`
      INSERT INTO prerequisite_nodes (
        node_id, rule_id, node_type, value, normalized_value, position_start, position_end
    ) VALUES (
      @node_id, @rule_id, @node_type, @value, @normalized_value, @position_start, @position_end
    )
    `);
    const insertPrerequisiteEdge = db.prepare(`
      INSERT INTO prerequisite_edges (
        rule_id, parent_node_id, child_node_id, sort_order
    ) VALUES (
      @rule_id, @parent_node_id, @child_node_id, @sort_order
    )
    `);
    const updatePrerequisiteRuleRoot = db.prepare(`
    UPDATE prerequisite_rules
    SET root_node_id = @root_node_id
    WHERE rule_id = @rule_id
    `);
    const insertPrerequisiteCourseSummary = db.prepare(`
    INSERT INTO prerequisite_course_summaries (
      rule_id, term_code, course_id, summary_status, course_groups_json, escape_clauses_json
    ) VALUES (
      @rule_id, @term_code, @course_id, @summary_status, @course_groups_json, @escape_clauses_json
    )
    `);

    const insertAll = db.transaction(() => {
      for (const row of courseRows) insertCourse.run(row);
      for (const row of prerequisiteRows.rules) insertPrerequisiteRule.run(row);
      for (const row of prerequisiteRows.summaries) insertPrerequisiteCourseSummary.run(row);
      for (const row of prerequisiteRows.nodes) insertPrerequisiteNode.run(row);
      for (const row of prerequisiteRows.edges) insertPrerequisiteEdge.run(row);
      for (const row of prerequisiteRows.rootUpdates) updatePrerequisiteRuleRoot.run(row);
      for (const row of packageRows) insertPackage.run(row);
      for (const row of sectionRows) insertSection.run(row);
      for (const row of buildingRows) insertBuilding.run(row);
      for (const row of uniqueInstructorRows) insertInstructor.run(row);
      for (const row of meetingRows) insertMeeting.run(row);
      for (const row of sectionInstructorRows) insertSectionInstructor.run(row);
      materializeScheduleReadModel(db, packageMetadata);
      insertRefreshRun.run({
        snapshot_run_at: snapshotRunAt,
        last_refreshed_at: new Date().toISOString(),
        source_term_code: sourceTermCode,
        snapshot_kind: 'fall-2026-enrollment-packages',
      });
    });

    insertAll();

    return {
      dbPath: outputDbPath,
      courses: courseRows.length,
      packages: packageRows.length,
      sections: sectionRows.length,
      buildings: buildingRows.length,
      instructors: uniqueInstructorRows.length,
      section_instructors: sectionInstructorRows.length,
      meetings: meetingRows.length,
      refresh_runs: 1,
    };
  } finally {
    db.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log(JSON.stringify(buildCourseDatabase()));
}
