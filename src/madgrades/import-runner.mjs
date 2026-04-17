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

function normalizeMadgradesCourseForMatching(course) {
  const primarySubject = Array.isArray(course?.subjects) ? course.subjects[0] : null;
  const normalizedSubjectAliases = Array.isArray(course?.subjects)
    ? [...new Set(course.subjects.flatMap((subject) => [subject?.abbreviation, subject?.code].filter(Boolean)))]
    : null;

  return {
    ...course,
    subject: course?.subject ?? primarySubject?.code ?? null,
    subjectAliases: normalizedSubjectAliases,
    number: course?.number != null ? String(course.number) : null,
    name: course?.name ?? null,
  };
}

function gradeCountsFromLiveDistribution(distribution = {}) {
  const counts = {};

  for (const [key, value] of Object.entries(distribution ?? {})) {
    if (key === 'total') continue;
    if (value == null) continue;
    counts[key === 'nwCount' ? 'W' : key.replace(/Count$/, '')] = value;
  }

  return counts;
}

function gpaFromLiveDistribution(distribution = {}) {
  const total = Number(distribution?.total ?? 0);
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }

  const aCount = Number(distribution?.A ?? distribution?.a ?? distribution?.aCount ?? 0);
  const abCount = Number(distribution?.AB ?? distribution?.ab ?? distribution?.abCount ?? 0);
  const bCount = Number(distribution?.B ?? distribution?.b ?? distribution?.bCount ?? 0);
  const bcCount = Number(distribution?.BC ?? distribution?.bc ?? distribution?.bcCount ?? 0);
  const cCount = Number(distribution?.C ?? distribution?.c ?? distribution?.cCount ?? 0);
  const dCount = Number(distribution?.D ?? distribution?.d ?? distribution?.dCount ?? 0);
  const fCount = Number(distribution?.F ?? distribution?.f ?? distribution?.fCount ?? 0);

  const qualityPoints = (
    aCount * 4
    + abCount * 3.5
    + bCount * 3
    + bcCount * 2.5
    + cCount * 2
    + dCount * 1
    + fCount * 0
  );

  return qualityPoints / total;
}

function mergeGradeCounts(target, counts) {
  for (const [gradeCode, studentCount] of Object.entries(counts ?? {})) {
    target[gradeCode] = Number(target[gradeCode] ?? 0) + Number(studentCount ?? 0);
  }

  return target;
}

function normalizeCourseSnapshot(detailPayload, courseGradesPayload, courseIdMap, counters) {
  const course = detailPayload?.course ?? detailPayload ?? {};
  const madgradesCourseId = courseIdMap.get(course.uuid);
  const grades = [];
  const gradeDistributions = [];
  const offerings = [];
  const liveGradeOfferings = Array.isArray(courseGradesPayload?.courseOfferings)
    ? courseGradesPayload.courseOfferings
    : null;

  if (liveGradeOfferings) {
    for (const offering of liveGradeOfferings) {
      const madgradesCourseGradeId = counters.nextCourseGradeId;
      counters.nextCourseGradeId += 1;
      const gradeCounts = gradeCountsFromLiveDistribution(offering?.cumulative ?? {});

      grades.push({
        madgradesCourseGradeId,
        madgradesCourseId,
        termCode: String(offering?.termCode ?? ''),
        avgGpa: gpaFromLiveDistribution(offering?.cumulative ?? {}),
        studentCount: Number(offering?.cumulative?.total ?? sumGradeCounts(gradeCounts)),
      });
      gradeDistributions.push({
        madgradesCourseGradeDistributionId: counters.nextCourseDistributionId,
        madgradesCourseGradeId,
        grades: gradeCounts,
      });
      counters.nextCourseDistributionId += 1;

      for (const section of offering?.sections ?? []) {
        for (const instructor of section?.instructors ?? []) {
          offerings.push({
            madgradesCourseOfferingId: counters.nextCourseOfferingId,
            madgradesCourseId,
            madgradesInstructorId: instructor.id,
            termCode: String(offering?.termCode ?? ''),
            sectionType: section?.sectionType ?? null,
            studentCount: Number(section?.total ?? 0),
            avgGpa: gpaFromLiveDistribution(section ?? {}),
          });
          counters.nextCourseOfferingId += 1;
        }
      }
    }
  }

  if (!liveGradeOfferings) {
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
  }

  const primarySubject = Array.isArray(course?.subjects) ? course.subjects[0] : null;

  return {
    course: makeMadgradesCourseRow({
      madgradesCourseId,
      subjectCode: course.subject ?? primarySubject?.code,
      catalogNumber: course.number,
      courseDesignation:
        course.abbreviation
        ?? [primarySubject?.abbreviation ?? course.subject ?? null, course.number ?? null]
          .filter(Boolean)
          .join(' ')
          .trim(),
    }),
    grades,
    gradeDistributions,
    offerings,
  };
}

function normalizeInstructorSnapshot(detailPayload, instructorGradesPayload, counters) {
  const instructor = detailPayload?.instructor ?? detailPayload ?? {};
  const grades = [];
  const gradeDistributions = [];

  const liveGradeOfferings = Array.isArray(instructorGradesPayload?.courseOfferings)
    ? instructorGradesPayload.courseOfferings
    : null;

  if (liveGradeOfferings) {
    const gradesByTerm = new Map();

    for (const offering of liveGradeOfferings) {
      const termCode = String(offering?.termCode ?? '');
      const gradeCounts = gradeCountsFromLiveDistribution(offering?.cumulative ?? {});
      const existing = gradesByTerm.get(termCode);

      if (existing) {
        mergeGradeCounts(existing.gradeCounts, gradeCounts);
        existing.studentCount += Number(offering?.cumulative?.total ?? sumGradeCounts(gradeCounts));
        continue;
      }

      gradesByTerm.set(termCode, {
        madgradesInstructorGradeId: counters.nextInstructorGradeId,
        madgradesInstructorId: instructor.id ?? instructorGradesPayload?.instructorId,
        termCode,
        studentCount: Number(offering?.cumulative?.total ?? sumGradeCounts(gradeCounts)),
        gradeCounts,
      });
      counters.nextInstructorGradeId += 1;
    }

    for (const grade of gradesByTerm.values()) {
      grades.push({
        madgradesInstructorGradeId: grade.madgradesInstructorGradeId,
        madgradesInstructorId: grade.madgradesInstructorId,
        termCode: grade.termCode,
        avgGpa: gpaFromLiveDistribution({
          ...grade.gradeCounts,
          total: grade.studentCount,
        }),
        studentCount: grade.studentCount,
      });
      gradeDistributions.push({
        madgradesInstructorGradeDistributionId: counters.nextInstructorDistributionId,
        madgradesInstructorGradeId: grade.madgradesInstructorGradeId,
        grades: grade.gradeCounts,
      });
      counters.nextInstructorDistributionId += 1;
    }
  }

  if (!liveGradeOfferings) {
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

async function mapWithConcurrency(items, limit, iteratee) {
  if (items.length === 0) {
    return [];
  }

  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await iteratee(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

const DETAIL_FETCH_CONCURRENCY = 12;
const DETAIL_FETCH_PROGRESS_INTERVAL = 100;

function makeProgressReporter({ onProgress, label, total }) {
  if (total <= 0) {
    return () => {};
  }

  let completed = 0;

  return () => {
    completed += 1;
    if (completed === total || completed % DETAIL_FETCH_PROGRESS_INTERVAL === 0) {
      onProgress(`${label} (${completed}/${total})...`);
    }
  };
}

export async function buildSnapshotFromApi({ db, snapshotRoot, token, fetchImpl, baseUrl, now, onProgress = () => {} }) {
  onProgress('Loading local DB identities...');
  const localCourses = loadLocalCourses(db);
  const localInstructors = loadLocalInstructors(db);
  const sourceTermCode = loadCurrentSourceTermCode(db);
  const snapshotId = makeMadgradesSnapshotId(now);
  const matchedAt = toIsoString(now);
  onProgress(`Loaded ${localCourses.length} local courses and ${localInstructors.length} local instructors.`);

  onProgress('Fetching Madgrades course index...');
  const [madgradesCourses, madgradesInstructors] = await Promise.all([
    fetchMadgradesPagedResults({ token, path: '/courses', fetchImpl, baseUrl }),
    fetchMadgradesPagedResults({ token, path: '/instructors', fetchImpl, baseUrl }),
  ]);
  onProgress(`Fetched Madgrades indexes: ${madgradesCourses.length} courses, ${madgradesInstructors.length} instructors.`);
  onProgress('Normalizing Madgrades course index for matching...');
  const normalizedMadgradesCourses = madgradesCourses.map(normalizeMadgradesCourseForMatching);

  onProgress('Matching local records against Madgrades indexes...');
  const courseMatches = localCourses.map((course) => matchLocalCourse(course, normalizedMadgradesCourses));
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
  onProgress(`Matched ${matchedCourseResults.length} courses and ${matchedInstructorResults.length} instructors.`);
  onProgress(`Deduped to ${uniqueMatchedCourseResults.length} unique course fetches and ${uniqueMatchedInstructorResults.length} unique instructor fetches.`);
  const courseIdMap = new Map(uniqueMatchedCourseResults.map((match, index) => [match.madgradesCourseUuid, index + 1]));
  const counters = {
    nextCourseGradeId: 1,
    nextCourseDistributionId: 1,
    nextCourseOfferingId: 1,
    nextInstructorGradeId: 1,
    nextInstructorDistributionId: 1,
  };

  onProgress(`Fetching course grades for ${uniqueMatchedCourseResults.length} matched courses...`);
  const matchedCourseIndexRows = new Map(
    normalizedMadgradesCourses.map((course) => [course.uuid, course]),
  );
  const reportCourseProgress = makeProgressReporter({
    onProgress,
    label: 'Fetched course grades',
    total: uniqueMatchedCourseResults.length,
  });
  onProgress(`Fetching instructor grades for ${uniqueMatchedInstructorResults.length} matched instructors...`);
  const matchedInstructorIndexRows = new Map(
    madgradesInstructors.map((instructor) => [instructor.id, instructor]),
  );
  const reportInstructorProgress = makeProgressReporter({
    onProgress,
    label: 'Fetched instructor grades',
    total: uniqueMatchedInstructorResults.length,
  });
  const [coursePayloads, instructorPayloads] = await Promise.all([
    mapWithConcurrency(
      uniqueMatchedCourseResults,
      DETAIL_FETCH_CONCURRENCY,
      async (match) => {
        const indexRow = matchedCourseIndexRows.get(match.madgradesCourseUuid);
        if (Array.isArray(indexRow?.subjects)) {
          const payload = {
            detail: indexRow,
            grades: await fetchMadgradesJson({
              token,
              path: `/courses/${match.madgradesCourseUuid}/grades`,
              fetchImpl,
              baseUrl,
            }),
          };

          reportCourseProgress();
          return payload;
        }

        const detail = await fetchMadgradesJson({
          token,
          path: `/courses/${match.madgradesCourseUuid}`,
          fetchImpl,
          baseUrl,
        });

        const payload = {
          detail,
          grades: Array.isArray(detail?.grades)
            ? null
            : await fetchMadgradesJson({
              token,
              path: `/courses/${match.madgradesCourseUuid}/grades`,
              fetchImpl,
              baseUrl,
            }),
        };

        reportCourseProgress();
        return payload;
      },
    ),
    mapWithConcurrency(
      uniqueMatchedInstructorResults,
      DETAIL_FETCH_CONCURRENCY,
      async (match) => {
        const indexRow = matchedInstructorIndexRows.get(match.madgradesInstructorId);
        if (typeof indexRow?.url === 'string') {
          const payload = {
            detail: indexRow,
            grades: await fetchMadgradesJson({
              token,
              path: `/instructors/${match.madgradesInstructorId}/grades`,
              fetchImpl,
              baseUrl,
            }),
          };

          reportInstructorProgress();
          return payload;
        }

        const detail = await fetchMadgradesJson({
          token,
          path: `/instructors/${match.madgradesInstructorId}`,
          fetchImpl,
          baseUrl,
        });

        const payload = {
          detail,
          grades: Array.isArray(detail?.grades)
            ? null
            : await fetchMadgradesJson({
              token,
              path: `/instructors/${match.madgradesInstructorId}/grades`,
              fetchImpl,
              baseUrl,
            }),
        };

        reportInstructorProgress();
        return payload;
      },
    ),
  ]);

  onProgress(`Normalizing ${coursePayloads.length} matched courses...`);
  const reportCourseNormalizationProgress = makeProgressReporter({
    onProgress,
    label: 'Normalized courses',
    total: coursePayloads.length,
  });
  onProgress(`Normalizing ${instructorPayloads.length} matched instructors...`);
  const reportInstructorNormalizationProgress = makeProgressReporter({
    onProgress,
    label: 'Normalized instructors',
    total: instructorPayloads.length,
  });

  const normalizedCourses = coursePayloads.map(({ detail, grades }) => {
    const normalized = normalizeCourseSnapshot(
      detail,
      grades,
      courseIdMap,
      counters,
    );
    normalized.offerings = dedupeCourseOfferings(
      normalized.offerings.filter((offering) =>
        importedInstructorIds.has(offering.madgradesInstructorId),
      ),
    );
    reportCourseNormalizationProgress();
    return normalized;
  });
  const normalizedInstructors = instructorPayloads.map(({ detail, grades }) => {
    const normalized = normalizeInstructorSnapshot(
      detail,
      grades,
      counters,
    );
    reportInstructorNormalizationProgress();
    return normalized;
  });

  const snapshotCourses = normalizedCourses.map((entry) => entry.course);
  const snapshotCourseGrades = normalizedCourses.flatMap((entry) => entry.grades);
  const snapshotCourseOfferings = normalizedCourses.flatMap((entry) => entry.offerings);
  const snapshotCourseGradeDistributions = normalizedCourses.flatMap((entry) => entry.gradeDistributions);
  const snapshotInstructors = normalizedInstructors.map((entry) => entry.instructor);
  const snapshotInstructorGrades = normalizedInstructors.flatMap((entry) => entry.grades);
  const snapshotInstructorGradeDistributions = normalizedInstructors.flatMap((entry) => entry.gradeDistributions);

  onProgress(
    'Prepared snapshot rows: '
      + `${snapshotCourses.length} courses, `
      + `${snapshotCourseGrades.length} course grades, `
      + `${snapshotCourseOfferings.length} course offerings, `
      + `${snapshotInstructors.length} instructors, `
      + `${snapshotInstructorGrades.length} instructor grades.`,
  );

  const snapshot = {
    manifest: {
      generatedAt: matchedAt,
      source: 'madgrades-api',
      sourceTermCode,
      matchedCourseCount: matchedCourseResults.length,
      matchedInstructorCount: matchedInstructorResults.length,
    },
    courses: snapshotCourses,
    courseGrades: snapshotCourseGrades,
    courseOfferings: snapshotCourseOfferings,
    courseGradeDistributions: snapshotCourseGradeDistributions,
    instructors: snapshotInstructors,
    instructorGrades: snapshotInstructorGrades,
    instructorGradeDistributions: snapshotInstructorGradeDistributions,
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

  onProgress('Writing Madgrades snapshot...');
  await writeMadgradesSnapshot({ snapshotRoot, snapshotId, snapshot });
  onProgress('Snapshot written.');

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
  onProgress = () => {},
} = {}) {
  const db = new Database(dbPath);

  try {
    let snapshot;
    let snapshotId;

    if (refreshApi) {
      onProgress('Refreshing snapshot from Madgrades API...');
      const built = await buildSnapshotFromApi({ db, snapshotRoot, token, fetchImpl, baseUrl, now, onProgress });
      snapshot = built.snapshot;
      snapshotId = built.snapshotId;
    } else {
      onProgress('Loading latest Madgrades snapshot...');
      const latestSnapshot = await readLatestMadgradesSnapshot({ snapshotRoot });
      snapshot = latestSnapshot;
      snapshotId = latestSnapshot.snapshotId;
      onProgress(`Loaded snapshot ${snapshotId}.`);
    }

    onProgress('Importing snapshot into SQLite...');
    const counts = replaceMadgradesTables(db, snapshot, now);
    onProgress('Madgrades import complete.');

    return {
      snapshotId,
      ...counts,
    };
  } finally {
    db.close();
  }
}
