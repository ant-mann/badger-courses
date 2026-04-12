export const GRADE_COUNT_FIELDS = Object.freeze([
  'A+',
  'A',
  'AB',
  'B',
  'BC',
  'C',
  'D',
  'F',
  'S',
  'U',
  'CR',
  'N',
  'P',
  'I',
  'NR',
  'W',
  'WP',
  'WF',
  'DR',
  'X',
]);

function normalizeImportedAt(importedAt) {
  if (importedAt instanceof Date) {
    return importedAt.toISOString();
  }

  return String(importedAt ?? '').trim() || new Date().toISOString();
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getDistributionEntries(distribution = {}) {
  const seen = new Set();
  const orderedKeys = [];

  for (const field of GRADE_COUNT_FIELDS) {
    if (Object.hasOwn(distribution, field)) {
      seen.add(field);
      orderedKeys.push(field);
    }
  }

  for (const key of Object.keys(distribution)) {
    if (seen.has(key)) continue;
    orderedKeys.push(key);
  }

  return orderedKeys.flatMap((gradeCode) => {
    const studentCount = toFiniteNumber(distribution[gradeCode]);
    if (studentCount == null) return [];

    return [{ gradeCode, studentCount }];
  });
}

export function sumGradeCounts(distribution = {}) {
  return getDistributionEntries(distribution).reduce((total, entry) => total + entry.studentCount, 0);
}

function gpaFromDistribution(distribution = {}) {
  const entries = Object.fromEntries(
    getDistributionEntries(distribution).map((entry) => [String(entry.gradeCode).toLowerCase(), entry.studentCount]),
  );
  const gradedStudents = (
    Number(entries.a ?? 0)
    + Number(entries.ab ?? 0)
    + Number(entries.b ?? 0)
    + Number(entries.bc ?? 0)
    + Number(entries.c ?? 0)
    + Number(entries.d ?? 0)
    + Number(entries.f ?? 0)
  );

  if (gradedStudents <= 0) {
    return 0;
  }

  const qualityPoints = (
    Number(entries.a ?? 0) * 4
    + Number(entries.ab ?? 0) * 3.5
    + Number(entries.b ?? 0) * 3
    + Number(entries.bc ?? 0) * 2.5
    + Number(entries.c ?? 0) * 2
    + Number(entries.d ?? 0) * 1
  );

  return qualityPoints / gradedStudents;
}

export function makeMadgradesCourseRow(course = {}, index = 0) {
  return {
    madgrades_course_id: Number(course.madgradesCourseId ?? course.madgrades_course_id ?? index + 1),
    subject_code: course.subjectCode ?? course.subject_code ?? course.subject ?? null,
    catalog_number: course.catalogNumber ?? course.catalog_number ?? course.number ?? null,
    course_designation:
      course.courseDesignation
      ?? course.course_designation
      ?? course.abbreviation
      ?? [course.subjectCode ?? course.subject ?? null, course.catalogNumber ?? course.number ?? null]
        .filter(Boolean)
        .join(' ')
        .trim(),
  };
}

export function makeMadgradesInstructorRow(instructor = {}, index = 0) {
  return {
    madgrades_instructor_id: Number(instructor.madgradesInstructorId ?? instructor.madgrades_instructor_id ?? instructor.id ?? index + 1),
    display_name: instructor.displayName ?? instructor.display_name ?? instructor.name ?? null,
  };
}

export function makeMadgradesCourseGradeRow(grade = {}, { refreshRunId = 1, index = 0 } = {}) {
  return {
    madgrades_course_grade_id: Number(grade.madgradesCourseGradeId ?? grade.madgrades_course_grade_id ?? grade.id ?? index + 1),
    madgrades_refresh_run_id: refreshRunId,
    madgrades_course_id: Number(grade.madgradesCourseId ?? grade.madgrades_course_id),
    term_code: grade.termCode ?? grade.term_code ?? grade.term ?? null,
    student_count: Number(grade.studentCount ?? grade.student_count ?? sumGradeCounts(grade.grades ?? grade.distributions ?? {})),
    avg_gpa: Number(grade.avgGpa ?? grade.avg_gpa ?? grade.averageGpa ?? grade.average_gpa ?? 0),
  };
}

export function makeMadgradesInstructorGradeRow(grade = {}, { refreshRunId = 1, index = 0 } = {}) {
  return {
    madgrades_instructor_grade_id: Number(grade.madgradesInstructorGradeId ?? grade.madgrades_instructor_grade_id ?? grade.id ?? index + 1),
    madgrades_refresh_run_id: refreshRunId,
    madgrades_instructor_id: Number(grade.madgradesInstructorId ?? grade.madgrades_instructor_id ?? grade.instructorId ?? grade.instructor_id),
    term_code: grade.termCode ?? grade.term_code ?? grade.term ?? null,
    student_count: Number(grade.studentCount ?? grade.student_count ?? sumGradeCounts(grade.grades ?? grade.distributions ?? {})),
    avg_gpa: Number(grade.avgGpa ?? grade.avg_gpa ?? grade.averageGpa ?? grade.average_gpa ?? 0),
  };
}

export function makeMadgradesCourseOfferingRow(offering = {}, index = 0) {
  return {
    madgrades_course_offering_id: Number(offering.madgradesCourseOfferingId ?? offering.madgrades_course_offering_id ?? offering.id ?? index + 1),
    madgrades_course_id: Number(offering.madgradesCourseId ?? offering.madgrades_course_id),
    madgrades_instructor_id: Number(offering.madgradesInstructorId ?? offering.madgrades_instructor_id ?? offering.instructorId ?? offering.instructor_id),
    term_code: offering.termCode ?? offering.term_code ?? offering.term ?? null,
    section_type: offering.sectionType ?? offering.section_type ?? null,
    student_count: Number(offering.studentCount ?? offering.student_count ?? 0),
    avg_gpa: Number(offering.avgGpa ?? offering.avg_gpa ?? offering.averageGpa ?? offering.average_gpa ?? 0),
  };
}

export function makeMadgradesCourseGradeDistributionRows(distribution = {}, { startId = 1 } = {}) {
  const madgradesCourseGradeId = Number(
    distribution.madgradesCourseGradeId ?? distribution.madgrades_course_grade_id,
  );

  return getDistributionEntries(distribution.grades ?? distribution.distributions ?? {}).map((entry, index) => ({
    madgrades_course_grade_distribution_id: startId + index,
    madgrades_course_grade_id: madgradesCourseGradeId,
    grade_code: entry.gradeCode,
    student_count: entry.studentCount,
  }));
}

export function makeMadgradesInstructorGradeDistributionRows(distribution = {}, { startId = 1 } = {}) {
  const madgradesInstructorGradeId = Number(
    distribution.madgradesInstructorGradeId ?? distribution.madgrades_instructor_grade_id,
  );

  return getDistributionEntries(distribution.grades ?? distribution.distributions ?? {}).map((entry, index) => ({
    madgrades_instructor_grade_distribution_id: startId + index,
    madgrades_instructor_grade_id: madgradesInstructorGradeId,
    grade_code: entry.gradeCode,
    student_count: entry.studentCount,
  }));
}

export function makeMadgradesCourseMatchRow(match = {}) {
  return {
    term_code: match.termCode ?? match.term_code ?? null,
    course_id: match.courseId ?? match.course_id ?? null,
    madgrades_course_id:
      match.madgradesCourseId == null && match.madgrades_course_id == null
        ? null
        : Number(match.madgradesCourseId ?? match.madgrades_course_id),
    match_status: match.matchStatus ?? match.match_status ?? 'unmatched',
    matched_at: match.matchedAt ?? match.matched_at ?? null,
  };
}

export function makeMadgradesInstructorMatchRow(match = {}) {
  return {
    instructor_key: match.instructorKey ?? match.instructor_key ?? null,
    madgrades_instructor_id:
      match.madgradesInstructorId == null && match.madgrades_instructor_id == null
        ? null
        : Number(match.madgradesInstructorId ?? match.madgrades_instructor_id),
    match_status: match.matchStatus ?? match.match_status ?? 'unmatched',
    matched_at: match.matchedAt ?? match.matched_at ?? null,
  };
}

export function replaceMadgradesTables(db, snapshot, importedAt) {
  const importedAtIso = normalizeImportedAt(importedAt);
  const refreshRunRow = {
    madgrades_refresh_run_id: 1,
    snapshot_run_at: snapshot?.manifest?.generatedAt ?? importedAtIso,
    last_refreshed_at: importedAtIso,
    source_term_code: snapshot?.manifest?.sourceTermCode ?? null,
    notes: snapshot?.manifest?.source ?? null,
  };
  const courseRows = (snapshot?.courses ?? []).map(makeMadgradesCourseRow);
  const instructorRows = (snapshot?.instructors ?? []).map(makeMadgradesInstructorRow);
  const courseDistributionCountByGradeId = new Map(
    (snapshot?.courseGradeDistributions ?? []).map((distribution) => [
      Number(distribution.madgradesCourseGradeId ?? distribution.madgrades_course_grade_id),
      sumGradeCounts(distribution.grades ?? distribution.distributions ?? {}),
    ]),
  );
  const courseDistributionGpaByGradeId = new Map(
    (snapshot?.courseGradeDistributions ?? []).map((distribution) => [
      Number(distribution.madgradesCourseGradeId ?? distribution.madgrades_course_grade_id),
      gpaFromDistribution(distribution.grades ?? distribution.distributions ?? {}),
    ]),
  );
  const instructorDistributionCountByGradeId = new Map(
    (snapshot?.instructorGradeDistributions ?? []).map((distribution) => [
      Number(distribution.madgradesInstructorGradeId ?? distribution.madgrades_instructor_grade_id),
      sumGradeCounts(distribution.grades ?? distribution.distributions ?? {}),
    ]),
  );
  const instructorDistributionGpaByGradeId = new Map(
    (snapshot?.instructorGradeDistributions ?? []).map((distribution) => [
      Number(distribution.madgradesInstructorGradeId ?? distribution.madgrades_instructor_grade_id),
      gpaFromDistribution(distribution.grades ?? distribution.distributions ?? {}),
    ]),
  );
  const courseGradeRows = (snapshot?.courseGrades ?? []).map((row, index) => {
    const normalizedRow = makeMadgradesCourseGradeRow(row, {
      refreshRunId: refreshRunRow.madgrades_refresh_run_id,
      index,
    });
    const distributionStudentCount = courseDistributionCountByGradeId.get(normalizedRow.madgrades_course_grade_id);
    const distributionGpa = courseDistributionGpaByGradeId.get(normalizedRow.madgrades_course_grade_id);

    if (distributionStudentCount != null) {
      normalizedRow.student_count = distributionStudentCount;
    }

    if (distributionGpa != null && distributionGpa > 0 && Number(normalizedRow.avg_gpa) === 0) {
      normalizedRow.avg_gpa = distributionGpa;
    }

    return normalizedRow;
  });
  const instructorGradeRows = (snapshot?.instructorGrades ?? []).map((row, index) => {
    const normalizedRow = makeMadgradesInstructorGradeRow(row, {
      refreshRunId: refreshRunRow.madgrades_refresh_run_id,
      index,
    });
    const distributionStudentCount = instructorDistributionCountByGradeId.get(normalizedRow.madgrades_instructor_grade_id);
    const distributionGpa = instructorDistributionGpaByGradeId.get(normalizedRow.madgrades_instructor_grade_id);

    if (distributionStudentCount != null) {
      normalizedRow.student_count = distributionStudentCount;
    }

    if (distributionGpa != null && distributionGpa > 0 && Number(normalizedRow.avg_gpa) === 0) {
      normalizedRow.avg_gpa = distributionGpa;
    }

    return normalizedRow;
  });
  const courseOfferingRows = (snapshot?.courseOfferings ?? []).map(makeMadgradesCourseOfferingRow);
  const courseMatchRows = (snapshot?.matchReport?.courseMatches ?? []).map(makeMadgradesCourseMatchRow);
  const instructorMatchRows = (snapshot?.matchReport?.instructorMatches ?? []).map(makeMadgradesInstructorMatchRow);

  let nextCourseDistributionId = 1;
  const courseDistributionRows = (snapshot?.courseGradeDistributions ?? []).flatMap((distribution) => {
    const rows = makeMadgradesCourseGradeDistributionRows(distribution, { startId: nextCourseDistributionId });
    nextCourseDistributionId += rows.length;
    return rows;
  });

  let nextInstructorDistributionId = 1;
  const instructorDistributionRows = (snapshot?.instructorGradeDistributions ?? []).flatMap((distribution) => {
    const rows = makeMadgradesInstructorGradeDistributionRows(distribution, { startId: nextInstructorDistributionId });
    nextInstructorDistributionId += rows.length;
    return rows;
  });

  const deleteStatements = [
    'DELETE FROM madgrades_course_grade_distributions',
    'DELETE FROM madgrades_instructor_grade_distributions',
    'DELETE FROM madgrades_course_offerings',
    'DELETE FROM madgrades_course_grades',
    'DELETE FROM madgrades_instructor_grades',
    'DELETE FROM madgrades_course_matches',
    'DELETE FROM madgrades_instructor_matches',
    'DELETE FROM madgrades_courses',
    'DELETE FROM madgrades_instructors',
    'DELETE FROM madgrades_refresh_runs',
  ];

  const insertRefreshRun = db.prepare(`
    INSERT INTO madgrades_refresh_runs (
      madgrades_refresh_run_id,
      snapshot_run_at,
      last_refreshed_at,
      source_term_code,
      notes
    ) VALUES (
      @madgrades_refresh_run_id,
      @snapshot_run_at,
      @last_refreshed_at,
      @source_term_code,
      @notes
    )
  `);
  const insertCourse = db.prepare(`
    INSERT INTO madgrades_courses (
      madgrades_course_id,
      subject_code,
      catalog_number,
      course_designation
    ) VALUES (
      @madgrades_course_id,
      @subject_code,
      @catalog_number,
      @course_designation
    )
  `);
  const insertInstructor = db.prepare(`
    INSERT INTO madgrades_instructors (
      madgrades_instructor_id,
      display_name
    ) VALUES (
      @madgrades_instructor_id,
      @display_name
    )
  `);
  const insertCourseGrade = db.prepare(`
    INSERT INTO madgrades_course_grades (
      madgrades_course_grade_id,
      madgrades_refresh_run_id,
      madgrades_course_id,
      term_code,
      student_count,
      avg_gpa
    ) VALUES (
      @madgrades_course_grade_id,
      @madgrades_refresh_run_id,
      @madgrades_course_id,
      @term_code,
      @student_count,
      @avg_gpa
    )
  `);
  const insertInstructorGrade = db.prepare(`
    INSERT INTO madgrades_instructor_grades (
      madgrades_instructor_grade_id,
      madgrades_refresh_run_id,
      madgrades_instructor_id,
      term_code,
      student_count,
      avg_gpa
    ) VALUES (
      @madgrades_instructor_grade_id,
      @madgrades_refresh_run_id,
      @madgrades_instructor_id,
      @term_code,
      @student_count,
      @avg_gpa
    )
  `);
  const insertCourseOffering = db.prepare(`
    INSERT INTO madgrades_course_offerings (
      madgrades_course_offering_id,
      madgrades_course_id,
      madgrades_instructor_id,
      term_code,
      section_type,
      student_count,
      avg_gpa
    ) VALUES (
      @madgrades_course_offering_id,
      @madgrades_course_id,
      @madgrades_instructor_id,
      @term_code,
      @section_type,
      @student_count,
      @avg_gpa
    )
  `);
  const insertCourseDistribution = db.prepare(`
    INSERT INTO madgrades_course_grade_distributions (
      madgrades_course_grade_distribution_id,
      madgrades_course_grade_id,
      grade_code,
      student_count
    ) VALUES (
      @madgrades_course_grade_distribution_id,
      @madgrades_course_grade_id,
      @grade_code,
      @student_count
    )
  `);
  const insertInstructorDistribution = db.prepare(`
    INSERT INTO madgrades_instructor_grade_distributions (
      madgrades_instructor_grade_distribution_id,
      madgrades_instructor_grade_id,
      grade_code,
      student_count
    ) VALUES (
      @madgrades_instructor_grade_distribution_id,
      @madgrades_instructor_grade_id,
      @grade_code,
      @student_count
    )
  `);
  const insertCourseMatch = db.prepare(`
    INSERT INTO madgrades_course_matches (
      term_code,
      course_id,
      madgrades_course_id,
      match_status,
      matched_at
    ) VALUES (
      @term_code,
      @course_id,
      @madgrades_course_id,
      @match_status,
      @matched_at
    )
  `);
  const insertInstructorMatch = db.prepare(`
    INSERT INTO madgrades_instructor_matches (
      instructor_key,
      madgrades_instructor_id,
      match_status,
      matched_at
    ) VALUES (
      @instructor_key,
      @madgrades_instructor_id,
      @match_status,
      @matched_at
    )
  `);

  db.transaction(() => {
    for (const statement of deleteStatements) {
      db.prepare(statement).run();
    }

    insertRefreshRun.run(refreshRunRow);

    for (const row of courseRows) insertCourse.run(row);
    for (const row of instructorRows) insertInstructor.run(row);
    for (const row of courseGradeRows) insertCourseGrade.run(row);
    for (const row of instructorGradeRows) insertInstructorGrade.run(row);
    for (const row of courseOfferingRows) insertCourseOffering.run(row);
    for (const row of courseDistributionRows) insertCourseDistribution.run(row);
    for (const row of instructorDistributionRows) insertInstructorDistribution.run(row);
    for (const row of courseMatchRows) insertCourseMatch.run(row);
    for (const row of instructorMatchRows) insertInstructorMatch.run(row);
  })();

  return {
    refreshRuns: 1,
    courses: courseRows.length,
    instructors: instructorRows.length,
    courseGrades: courseGradeRows.length,
    instructorGrades: instructorGradeRows.length,
    courseOfferings: courseOfferingRows.length,
    courseGradeDistributions: courseDistributionRows.length,
    instructorGradeDistributions: instructorDistributionRows.length,
    courseMatches: courseMatchRows.length,
    instructorMatches: instructorMatchRows.length,
  };
}
