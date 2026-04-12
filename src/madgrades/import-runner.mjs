import Database from 'better-sqlite3';

import { fetchMadgradesJson, fetchMadgradesPagedResults } from './api-client.mjs';
import {
  makeMadgradesCourseMatchRow,
  makeMadgradesCourseRow,
  makeMadgradesInstructorMatchRow,
  makeMadgradesInstructorRow,
  replaceMadgradesTables,
  sumGradeCounts,
} from './import-helpers.mjs';
import { matchLocalCourse, matchLocalInstructor } from './match-helpers.mjs';
import {
  makeMadgradesSnapshotId,
  readLatestMadgradesSnapshot,
  writeMadgradesSnapshot,
} from './snapshot-helpers.mjs';

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : new Date(value ?? Date.now()).toISOString();
}

function loadLocalCourses(db) {
  const groupedCourses = db.prepare(`
    SELECT
      c.term_code,
      c.course_id,
      c.title,
      COALESCE(ccl.subject_code, c.subject_code) AS subject_code,
      COALESCE(ccl.catalog_number, c.catalog_number) AS catalog_number
    FROM courses c
    LEFT JOIN course_cross_listings ccl
      ON ccl.term_code = c.term_code
     AND ccl.course_id = c.course_id
    ORDER BY c.term_code, c.course_id, ccl.is_primary DESC, ccl.subject_code, ccl.catalog_number
  `).all().reduce((courses, row) => {
    const key = `${row.term_code}:${row.course_id}`;
    const existing = courses.get(key);
    const subjectCatalogPair = {
      subjectCode: row.subject_code,
      catalogNumber: row.catalog_number,
    };

    if (!existing) {
      courses.set(key, {
        termCode: row.term_code,
        courseId: row.course_id,
        title: row.title,
        subjectCatalogPairs: [subjectCatalogPair],
      });
      return courses;
    }

    if (!existing.subjectCatalogPairs.some(
      (pair) => pair.subjectCode === subjectCatalogPair.subjectCode && pair.catalogNumber === subjectCatalogPair.catalogNumber,
    )) {
      existing.subjectCatalogPairs.push(subjectCatalogPair);
    }

    return courses;
  }, new Map());

  return Array.from(groupedCourses.values());
}

function loadLocalInstructors(db) {
  return db.prepare(`
    SELECT
      instructor_key,
      TRIM(COALESCE(first_name || ' ', '') || COALESCE(last_name, '')) AS display_name
    FROM instructors
    ORDER BY instructor_key
  `).all().map((row) => ({
    instructorKey: row.instructor_key,
    displayName: row.display_name,
  }));
}

function loadCurrentSourceTermCode(db) {
  return db.prepare(`
    SELECT MAX(source_term_code) AS source_term_code
    FROM refresh_runs
  `).get()?.source_term_code ?? null;
}

function normalizeCourseSnapshot(detailPayload, courseIdMap, counters) {
  const course = detailPayload?.course ?? {};
  const madgradesCourseId = courseIdMap.get(course.uuid);
  const grades = [];
  const gradeDistributions = [];
  const offerings = [];

  for (const grade of detailPayload?.grades ?? []) {
    const madgradesCourseGradeId = counters.nextCourseGradeId;
    counters.nextCourseGradeId += 1;

    grades.push({
      madgradesCourseGradeId,
      madgradesCourseId,
      termCode: grade.term,
      avgGpa: grade.average_gpa,
      studentCount: sumGradeCounts(grade.distributions ?? {}),
    });
    gradeDistributions.push({
      madgradesCourseGradeDistributionId: counters.nextCourseDistributionId,
      madgradesCourseGradeId,
      grades: grade.distributions ?? {},
    });
    counters.nextCourseDistributionId += 1;
  }

  for (const offering of detailPayload?.offerings ?? []) {
    offerings.push({
      madgradesCourseOfferingId: counters.nextCourseOfferingId,
      madgradesCourseId,
      madgradesInstructorId: offering.instructor_id,
      termCode: offering.term,
      sectionType: offering.section_type,
      studentCount: offering.student_count,
      avgGpa: offering.average_gpa,
    });
    counters.nextCourseOfferingId += 1;
  }

  return {
    course: makeMadgradesCourseRow({
      madgradesCourseId,
      subjectCode: course.subject,
      catalogNumber: course.number,
      courseDesignation: course.abbreviation ?? `${course.subject ?? ''} ${course.number ?? ''}`.trim(),
    }),
    grades,
    gradeDistributions,
    offerings,
  };
}

function normalizeInstructorSnapshot(detailPayload, counters) {
  const instructor = detailPayload?.instructor ?? {};
  const grades = [];
  const gradeDistributions = [];

  for (const grade of detailPayload?.grades ?? []) {
    const madgradesInstructorGradeId = counters.nextInstructorGradeId;
    counters.nextInstructorGradeId += 1;

    grades.push({
      madgradesInstructorGradeId,
      madgradesInstructorId: instructor.id,
      termCode: grade.term,
      avgGpa: grade.average_gpa,
      studentCount: sumGradeCounts(grade.distributions ?? {}),
    });
    gradeDistributions.push({
      madgradesInstructorGradeDistributionId: counters.nextInstructorDistributionId,
      madgradesInstructorGradeId,
      grades: grade.distributions ?? {},
    });
    counters.nextInstructorDistributionId += 1;
  }

  return {
    instructor: makeMadgradesInstructorRow({
      madgradesInstructorId: instructor.id,
      displayName: instructor.name,
    }),
    grades,
    gradeDistributions,
  };
}

function dedupeCourseOfferings(offerings) {
  const bySchemaKey = new Map();

  for (const offering of offerings) {
    const key = [
      offering.madgradesCourseId,
      offering.madgradesInstructorId,
      offering.termCode,
      offering.sectionType,
    ].join(':');

    if (!bySchemaKey.has(key)) {
      bySchemaKey.set(key, offering);
    }
  }

  return [...bySchemaKey.values()];
}

async function buildSnapshotFromApi({ db, snapshotRoot, token, fetchImpl, baseUrl, now }) {
  const localCourses = loadLocalCourses(db);
  const localInstructors = loadLocalInstructors(db);
  const sourceTermCode = loadCurrentSourceTermCode(db);
  const snapshotId = makeMadgradesSnapshotId(now);
  const matchedAt = toIsoString(now);

  const [madgradesCourses, madgradesInstructors] = await Promise.all([
    fetchMadgradesPagedResults({ token, path: '/courses', fetchImpl, baseUrl }),
    fetchMadgradesPagedResults({ token, path: '/instructors', fetchImpl, baseUrl }),
  ]);

  const courseMatches = localCourses.map((course) => matchLocalCourse(course, madgradesCourses));
  const instructorMatches = localInstructors.map((instructor) => matchLocalInstructor(instructor, madgradesInstructors));
  const matchedCourseResults = courseMatches.filter((match) => match.matchStatus === 'matched');
  const matchedInstructorResults = instructorMatches.filter((match) => match.matchStatus === 'matched');
  const uniqueMatchedCourseResults = [...matchedCourseResults.reduce((byUuid, match) => {
    if (!byUuid.has(match.madgradesCourseUuid)) {
      byUuid.set(match.madgradesCourseUuid, match);
    }
    return byUuid;
  }, new Map()).values()];
  const uniqueMatchedInstructorResults = [...matchedInstructorResults.reduce((byId, match) => {
    if (!byId.has(match.madgradesInstructorId)) {
      byId.set(match.madgradesInstructorId, match);
    }
    return byId;
  }, new Map()).values()];
  const importedInstructorIds = new Set(uniqueMatchedInstructorResults.map((match) => match.madgradesInstructorId));
  const courseIdMap = new Map(uniqueMatchedCourseResults.map((match, index) => [match.madgradesCourseUuid, index + 1]));
  const counters = {
    nextCourseGradeId: 1,
    nextCourseDistributionId: 1,
    nextCourseOfferingId: 1,
    nextInstructorGradeId: 1,
    nextInstructorDistributionId: 1,
  };

  const courseDetails = [];
  for (const match of uniqueMatchedCourseResults) {
    courseDetails.push(await fetchMadgradesJson({
      token,
      path: `/explore/courses/${match.madgradesCourseUuid}`,
      fetchImpl,
      baseUrl,
    }));
  }

  const instructorDetails = [];
  for (const match of uniqueMatchedInstructorResults) {
    instructorDetails.push(await fetchMadgradesJson({
      token,
      path: `/explore/instructors/${match.madgradesInstructorId}`,
      fetchImpl,
      baseUrl,
    }));
  }

  const normalizedCourses = courseDetails.map((detail) => {
    const normalized = normalizeCourseSnapshot(detail, courseIdMap, counters);
    normalized.offerings = dedupeCourseOfferings(
      normalized.offerings.filter((offering) =>
        importedInstructorIds.has(offering.madgradesInstructorId),
      ),
    );
    return normalized;
  });
  const normalizedInstructors = instructorDetails.map((detail) => normalizeInstructorSnapshot(detail, counters));

  const snapshot = {
    manifest: {
      generatedAt: matchedAt,
      source: 'madgrades-api',
      sourceTermCode,
      matchedCourseCount: matchedCourseResults.length,
      matchedInstructorCount: matchedInstructorResults.length,
    },
    courses: normalizedCourses.map((entry) => entry.course),
    courseGrades: normalizedCourses.flatMap((entry) => entry.grades),
    courseOfferings: normalizedCourses.flatMap((entry) => entry.offerings),
    courseGradeDistributions: normalizedCourses.flatMap((entry) => entry.gradeDistributions),
    instructors: normalizedInstructors.map((entry) => entry.instructor),
    instructorGrades: normalizedInstructors.flatMap((entry) => entry.grades),
    instructorGradeDistributions: normalizedInstructors.flatMap((entry) => entry.gradeDistributions),
    matchReport: {
      courseMatches: courseMatches.map((match) => makeMadgradesCourseMatchRow({
        termCode: match.termCode,
        courseId: match.courseId,
        madgradesCourseId:
          match.matchStatus === 'matched'
            ? courseIdMap.get(match.madgradesCourseUuid)
            : null,
        matchStatus: match.matchStatus,
        matchedAt: match.matchStatus === 'matched' ? matchedAt : null,
      })),
      instructorMatches: instructorMatches.map((match) => makeMadgradesInstructorMatchRow({
        instructorKey: match.instructorKey,
        madgradesInstructorId: match.matchStatus === 'matched' ? match.madgradesInstructorId : null,
        matchStatus: match.matchStatus,
        matchedAt: match.matchStatus === 'matched' ? matchedAt : null,
      })),
    },
  };

  await writeMadgradesSnapshot({ snapshotRoot, snapshotId, snapshot });

  return { snapshotId, snapshot };
}

export async function runMadgradesImport({
  dbPath,
  snapshotRoot,
  refreshApi = false,
  token = process.env.MADGRADES_API_TOKEN,
  fetchImpl = fetch,
  baseUrl,
  now = new Date(),
} = {}) {
  const db = new Database(dbPath);

  try {
    let snapshot;
    let snapshotId;

    if (refreshApi) {
      const built = await buildSnapshotFromApi({ db, snapshotRoot, token, fetchImpl, baseUrl, now });
      snapshot = built.snapshot;
      snapshotId = built.snapshotId;
    } else {
      const latestSnapshot = await readLatestMadgradesSnapshot({ snapshotRoot });
      snapshot = latestSnapshot;
      snapshotId = latestSnapshot.snapshotId;
    }

    const counts = replaceMadgradesTables(db, snapshot, now);

    return {
      snapshotId,
      ...counts,
    };
  } finally {
    db.close();
  }
}
