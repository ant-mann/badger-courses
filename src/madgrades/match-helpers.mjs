export function normalizeMadgradesText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function buildCourseResult(localCourse, overrides) {
  return {
    termCode: localCourse.termCode,
    courseId: localCourse.courseId,
    matchStatus: overrides.matchStatus,
    matchMethod: overrides.matchMethod ?? null,
    madgradesCourseUuid: overrides.madgradesCourseUuid ?? null,
    matchNote: overrides.matchNote ?? null,
  };
}

function buildInstructorResult(localInstructor, overrides) {
  return {
    instructorKey: localInstructor.instructorKey,
    matchStatus: overrides.matchStatus,
    matchMethod: overrides.matchMethod ?? null,
    madgradesInstructorId: overrides.madgradesInstructorId ?? null,
    matchNote: overrides.matchNote ?? null,
  };
}

function matchesSubjectCatalogPair(course, pair) {
  return normalizeMadgradesText(course?.subject) === normalizeMadgradesText(pair?.subjectCode)
    && normalizeMadgradesText(course?.number) === normalizeMadgradesText(pair?.catalogNumber);
}

export function matchLocalCourse(localCourse, madgradesCourses) {
  const subjectCatalogPairs = Array.isArray(localCourse.subjectCatalogPairs)
    ? localCourse.subjectCatalogPairs
    : [];
  const pairCandidates = madgradesCourses.filter((course) =>
    subjectCatalogPairs.some((pair) => matchesSubjectCatalogPair(course, pair)),
  );

  if (pairCandidates.length === 0) {
    return buildCourseResult(localCourse, {
      matchStatus: 'unmatched',
      matchNote: 'No Madgrades course matched any subject/code pair',
    });
  }

  if (pairCandidates.length === 1) {
    return buildCourseResult(localCourse, {
      matchStatus: 'matched',
      matchMethod: 'subject-code+catalog-number',
      madgradesCourseUuid: pairCandidates[0].uuid,
    });
  }

  const normalizedTitle = normalizeMadgradesText(localCourse.title);
  const titleCandidates = pairCandidates.filter(
    (course) => normalizeMadgradesText(course?.name) === normalizedTitle,
  );

  if (titleCandidates.length === 1) {
    return buildCourseResult(localCourse, {
      matchStatus: 'matched',
      matchMethod: 'subject-code+catalog-number+title',
      madgradesCourseUuid: titleCandidates[0].uuid,
    });
  }

  if (titleCandidates.length > 1) {
    return buildCourseResult(localCourse, {
      matchStatus: 'ambiguous',
      matchNote: 'Multiple Madgrades courses matched subject/code and title filters',
    });
  }

  return buildCourseResult(localCourse, {
    matchStatus: 'unmatched',
    matchNote: 'No Madgrades course matched the normalized title after subject/code filtering',
  });
}

export function matchLocalInstructor(localInstructor, madgradesInstructors) {
  const normalizedDisplayName = normalizeMadgradesText(localInstructor.displayName);
  const candidates = madgradesInstructors.filter(
    (instructor) => normalizeMadgradesText(instructor?.name) === normalizedDisplayName,
  );

  if (candidates.length === 0) {
    return buildInstructorResult(localInstructor, {
      matchStatus: 'unmatched',
      matchNote: 'No Madgrades instructor matched the normalized full name',
    });
  }

  if (candidates.length === 1) {
    return buildInstructorResult(localInstructor, {
      matchStatus: 'matched',
      matchMethod: 'normalized-name-exact',
      madgradesInstructorId: candidates[0].id,
    });
  }

  return buildInstructorResult(localInstructor, {
    matchStatus: 'ambiguous',
    matchNote: 'Multiple Madgrades instructors matched the normalized full name',
  });
}
